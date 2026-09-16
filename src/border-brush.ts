// ===== Border Brush mode =====
// Entered from the Border Brush tab of a menu's border scope chooser. The tab's
// Border color, Border Style and Border Weight load a brush instead of applying
// anything; every subsequent click on a cell edge paints that one segment, in
// any bloom-table on the page. The menu stays open while the user paints, so
// the brush can be reloaded between strokes; the popup's grip strip drags it
// aside when it covers the table.
//
// Escape, another tab, closing the menu, or a press outside every table and the
// popup exits.

import { applyBorderToEdge, type CellSide } from "./formatting-commands";
import { kBorderBrushCursorUrl } from "./menu-icons";
import { setBorderBrushExiter } from "./prepare-for-save";
import type {
  BorderStyle,
  BorderWeight,
} from "./components/BorderControl/logic/types";

export type BorderBrush = {
  style: BorderStyle;
  weight: BorderWeight;
  color: string;
};

// How far from a cell edge a press still counts as that edge. Wider than
// drag-to-resize's 5px band, because painting an edge is the only thing a
// press does in this mode, while a resize has to leave room for the caret.
export const kBrushBandPx = 6;

let brushMode: { brush: BorderBrush; owner: HTMLElement } | null = null;

export function isBorderBrushModeActive(): boolean {
  return !!brushMode;
}

/** The side of `cell` whose band holds the point, or null for a point in the
 *  cell's middle or outside it. Ties favour top over bottom and left over
 *  right. Pure, so the hit test is testable without a laid-out document.
 *
 *  The measurement is the cell's own rect, so the visible right or bottom edge
 *  of a spanning cell is that cell's edge; applyCellPerimeter maps it onto the
 *  right track. */
export function edgeAtPoint(
  cell: HTMLElement,
  clientX: number,
  clientY: number,
  band: number = kBrushBandPx,
): CellSide | null {
  const r = cell.getBoundingClientRect();
  if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom)
    return null;
  const distances: Array<[CellSide, number]> = [
    ["top", clientY - r.top],
    ["bottom", r.bottom - clientY],
    ["left", clientX - r.left],
    ["right", r.right - clientX],
  ];
  let best: CellSide | null = null;
  let bestDistance = Infinity;
  for (const [side, d] of distances) {
    // Strict less-than, and the list is ordered top, bottom, left, right, so a
    // tie goes to the earlier side.
    if (d <= band && d < bestDistance) {
      best = side;
      bestDistance = d;
    }
  }
  return best;
}

// ---- Cursor -----------------------------------------------------------------
// Scoped to tables rather than the whole body: the menu stays open and usable
// while the mode runs, so its own controls keep their pointer.
const kBrushStyleTag = "border-brush-style";
function ensureBorderBrushStyle(): void {
  // Test for the element itself rather than remembering that we installed it:
  // the <style> is tagged data-table-overlay, so prepare-for-save removes it,
  // and a remembered flag would then stop the cursor coming back on re-entry.
  if (document.head.querySelector(`style[data-table-overlay="${kBrushStyleTag}"]`))
    return;
  const style = document.createElement("style");
  style.setAttribute("data-table-overlay", kBrushStyleTag);
  // Cells carry inline cursor styles, so the rule needs !important to win.
  style.textContent = `
    body.bloom-border-brush .bloom-table, body.bloom-border-brush .bloom-table * { cursor: ${kBorderBrushCursorUrl} !important; }
  `;
  document.head.appendChild(style);
}

// ---- Preview ----------------------------------------------------------------
// Two overlays on the hovered segment: a wash strip saying which edge the next
// click takes, and above it a line drawn in the loaded brush, so the user sees
// the stroke before committing it. An erasing brush (style "none" or weight 0)
// shows the wash alone, because its stroke is nothing.

const kPreviewTag = "border-brush-preview";
const kWashThicknessPx = 11;
const kWashColor = "#8ecad280";

let previewFor: { cell: HTMLElement; side: CellSide } | null = null;

function clearPreview(): void {
  document
    .querySelectorAll(`[data-table-overlay="${kPreviewTag}"]`)
    .forEach((el) => el.remove());
  previewFor = null;
}

function makePreviewLayer(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("data-table-overlay", kPreviewTag);
  Object.assign(el.style, {
    position: "absolute",
    pointerEvents: "none",
    zIndex: "2147483646",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  return el;
}

function showPreview(cell: HTMLElement, side: CellSide): void {
  if (!brushMode) return;
  clearPreview();
  previewFor = { cell, side };
  const r = cell.getBoundingClientRect();
  const horizontal = side === "top" || side === "bottom";
  const edgeX = side === "left" ? r.left : r.right;
  const edgeY = side === "top" ? r.top : r.bottom;

  const wash = makePreviewLayer();
  wash.style.background = kWashColor;
  if (horizontal) {
    wash.style.left = `${window.scrollX + r.left}px`;
    wash.style.top = `${window.scrollY + edgeY - kWashThicknessPx / 2}px`;
    wash.style.width = `${r.width}px`;
    wash.style.height = `${kWashThicknessPx}px`;
  } else {
    wash.style.left = `${window.scrollX + edgeX - kWashThicknessPx / 2}px`;
    wash.style.top = `${window.scrollY + r.top}px`;
    wash.style.width = `${kWashThicknessPx}px`;
    wash.style.height = `${r.height}px`;
  }
  document.body.appendChild(wash);

  const { style, weight, color } = brushMode.brush;
  if (style === "none" || weight === 0) return;
  // The renderer clamps a "double" edge to at least 4px so its two lines are
  // visible (design/model.md, "Double style minimum width"), so the preview
  // has to clamp it too or it would promise a thinner stroke than it paints.
  const painted = style === "double" && weight < 4 ? 4 : weight;
  const line = makePreviewLayer();
  if (horizontal) {
    line.style.borderTop = `${painted}px ${style} ${color}`;
    line.style.left = `${window.scrollX + r.left}px`;
    line.style.top = `${window.scrollY + edgeY - painted / 2}px`;
    line.style.width = `${r.width}px`;
    line.style.height = "0";
  } else {
    line.style.borderLeft = `${painted}px ${style} ${color}`;
    line.style.left = `${window.scrollX + edgeX - painted / 2}px`;
    line.style.top = `${window.scrollY + r.top}px`;
    line.style.width = "0";
    line.style.height = `${r.height}px`;
  }
  document.body.appendChild(line);
}

// ---- Listeners --------------------------------------------------------------

// The cell a point lies in, when that cell is a paintable cell of a table. A
// spanned-over placeholder is display:none and owns no rendered sides.
function paintableCellAt(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const cell = target.closest(".bloom-cell") as HTMLElement | null;
  if (!cell || cell.classList.contains("bloom-skip")) return null;
  return cell.closest(".bloom-table") ? cell : null;
}

function onBrushPointerMove(e: Event): void {
  if (!brushMode) return;
  const cell = paintableCellAt(e.target);
  if (!cell) {
    clearPreview();
    return;
  }
  const me = e as PointerEvent;
  const side = edgeAtPoint(cell, me.clientX, me.clientY);
  if (!side) {
    clearPreview();
    return;
  }
  if (previewFor && previewFor.cell === cell && previewFor.side === side) return;
  showPreview(cell, side);
}

function onBrushPointerDown(e: Event): void {
  if (!brushMode) return;
  const cell = paintableCellAt(e.target);
  if (!cell) {
    // A press on the brush's owner (the choosers that loaded it) or inside the
    // library's popup belongs to the menu: it is how the brush is reloaded. A
    // press inside a table but off every cell (a gap between cells, the
    // table's padding) is neither a stroke nor a way out. A press anywhere
    // else ends the mode and is left alone, so it still does whatever the user
    // pressed it for.
    const target = e.target instanceof Element ? e.target : null;
    const stays =
      !!target &&
      (brushMode.owner.contains(target) ||
        !!target.closest("[data-btable-menu], .bloom-table"));
    if (e.type === "pointerdown" && !stays) exitBorderBrushMode();
    return;
  }
  const table = cell.closest(".bloom-table") as HTMLElement;
  // The press belongs to the brush whether or not it lands on an edge: a press
  // in a cell's middle must not move the caret or change the selection.
  e.preventDefault();
  e.stopPropagation();
  if (e.type !== "pointerdown") return;
  const button = (e as MouseEvent).button;
  if (typeof button === "number" && button !== 0) return;
  const me = e as PointerEvent;
  const side = edgeAtPoint(cell, me.clientX, me.clientY);
  if (!side) return;
  applyBorderToEdge(table, cell, side, brushMode.brush);
  // The stroke can change the cell's size, so the preview is measured again
  // against the table as it now stands.
  showPreview(cell, side);
}

function onBrushKeyDown(e: KeyboardEvent): void {
  if (e.key !== "Escape") return;
  e.stopPropagation();
  exitBorderBrushMode();
}

/** Load the brush and take over presses on cell edges. `owner` is the element
 *  holding the choosers that loaded the brush (the menu's border scope group):
 *  a press inside it reloads the brush rather than ending the mode, whichever
 *  menu the group is mounted in, the library's popup or a host's own. The
 *  brush paints any bloom-table on the page, as Paint Format does. */
export function enterBorderBrushMode(owner: HTMLElement, brush: BorderBrush): void {
  exitBorderBrushMode();
  ensureBorderBrushStyle();
  brushMode = { brush, owner };
  document.body.classList.add("bloom-border-brush");
  document.addEventListener("pointerdown", onBrushPointerDown, true);
  document.addEventListener("mousedown", onBrushPointerDown, true);
  document.addEventListener("click", onBrushPointerDown, true);
  document.addEventListener("keydown", onBrushKeyDown, true);
  document.addEventListener("pointermove", onBrushPointerMove, true);
}

/** Reload the brush from the menu's choosers. The mode keeps running; only the
 *  next stroke changes. */
export function updateBorderBrush(brush: BorderBrush): void {
  if (!brushMode) return;
  brushMode.brush = brush;
  // The preview shows the loaded brush, so it is redrawn with the new one
  // rather than left promising the old stroke.
  if (previewFor) showPreview(previewFor.cell, previewFor.side);
}

export function exitBorderBrushMode(): void {
  if (!brushMode) return;
  clearPreview();
  brushMode = null;
  document.body.classList.remove("bloom-border-brush");
  document.removeEventListener("pointerdown", onBrushPointerDown, true);
  document.removeEventListener("mousedown", onBrushPointerDown, true);
  document.removeEventListener("click", onBrushPointerDown, true);
  document.removeEventListener("keydown", onBrushKeyDown, true);
  document.removeEventListener("pointermove", onBrushPointerMove, true);
}

// Saving strips this mode's preview overlays, cursor <style> and body class, so
// the mode itself has to go with them; prepare-for-save calls this without
// importing this module (see setBorderBrushExiter).
setBorderBrushExiter(exitBorderBrushMode);
