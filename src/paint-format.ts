// ===== Paint Format mode =====
// Entered from a Cell/Row/Column menu's "Paint format". Every subsequent
// click stamps the snapshot onto the clicked cell's matching scope, in any
// bloom-table on the page (a row/column pattern cycles when sizes differ).
// Escape or the slashed-roller badge at the source table's top-left exits.

import {
  getCellsInScope,
  paintProperties,
  snapshotCellProperties,
  type CopiedCellProperties,
} from "./formatting-commands";
import { kPaintRollerPath } from "./menu-icons";
import { setPaintFormatExiter } from "./prepare-for-save";

let paintMode: {
  scope: "cell" | "row" | "column";
  pattern: CopiedCellProperties[];
  table: HTMLElement;
  badge: HTMLDivElement;
} | null = null;

export function isPaintFormatModeActive(): boolean {
  return !!paintMode;
}

// Entering the mode hides the edge-overlay pills, which live in
// table-size-buttons.ts. That module registers its hideEdgeOverlays here at
// load time; the indirection keeps this module free of a circular import.
let overlayHider: () => void = () => {};
export function setPaintFormatOverlayHider(fn: () => void): void {
  overlayHider = fn;
}

// Roller cursor while the mode is active. Cells carry inline cursor styles,
// so the rule needs !important to win; the badge opts back out to a pointer.
const kPaintCursorUrl = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'><path d='${kPaintRollerPath}' fill='%23222' stroke='%23fff' stroke-width='0.75'/></svg>") 4 4, copy`;
const kPaintStyleTag = "paint-format-style";
function ensurePaintFormatStyle(): void {
  // Test for the element itself rather than remembering that we installed it:
  // the <style> is tagged data-table-overlay, so prepare-for-save removes it,
  // and a remembered flag would then stop the cursor rules coming back when
  // the user re-enters the mode.
  if (document.head.querySelector(`style[data-table-overlay="${kPaintStyleTag}"]`)) return;
  const style = document.createElement("style");
  style.setAttribute("data-table-overlay", kPaintStyleTag);
  style.textContent = `
    body.bloom-paint-format, body.bloom-paint-format * { cursor: ${kPaintCursorUrl} !important; }
    body.bloom-paint-format .bloom-paint-format-badge, body.bloom-paint-format .bloom-paint-format-badge * { cursor: pointer !important; }
  `;
  document.head.appendChild(style);
}

function makePaintFormatBadge(): HTMLDivElement {
  const badge = document.createElement("div");
  badge.className = "bloom-paint-format-badge";
  // Appended to <body>; tag it so prepare-for-save strips it.
  badge.setAttribute("data-table-overlay", "paint-format-badge");
  badge.title = "Exit Paint Format (Esc)";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Exit Paint Format");
  Object.assign(badge.style, {
    position: "absolute",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    border: "1px solid #bbb",
    borderRadius: "6px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
    zIndex: "2147483647",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  // The roller with a red slash: "you are painting; click to stop".
  badge.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" style="display:block"><path d="${kPaintRollerPath}" fill="#444"/><line x1="3" y1="3" x2="21" y2="21" stroke="#d32f2f" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  badge.addEventListener("mousedown", (e) => e.preventDefault());
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    exitPaintFormatMode();
  });
  return badge;
}

// The badge sits just outside the source table's top-left corner (clamped to
// the viewport when the table touches the page edge).
function positionPaintBadge(): void {
  if (!paintMode) return;
  if (!document.body.contains(paintMode.table)) {
    exitPaintFormatMode();
    return;
  }
  const rect = paintMode.table.getBoundingClientRect();
  const size = 28;
  const margin = 4;
  const left = Math.max(0, window.scrollX + rect.left - size - margin);
  const top = Math.max(0, window.scrollY + rect.top - size - margin);
  paintMode.badge.style.left = `${left}px`;
  paintMode.badge.style.top = `${top}px`;
}

// Capture-phase handler for pointerdown/mousedown/click while painting: a
// click on any cell is consumed entirely (no selection change, no caret) and
// stamps the pattern once, on pointerdown. Clicks elsewhere behave normally
// and leave the mode active.
function onPaintPointerDown(e: Event): void {
  if (!paintMode) return;
  const target = e.target as HTMLElement | null;
  if (!target || !(target instanceof Element)) return;
  if (paintMode.badge.contains(target)) return;
  const cell = target.closest?.(".bloom-cell") as HTMLElement | null;
  const table = cell?.closest(".bloom-table") as HTMLElement | null;
  if (!cell || !table || cell.classList.contains("bloom-skip")) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.type !== "pointerdown") return;
  // Only the primary button paints, matching the rule the cell selection
  // handler uses. A right or middle button press is still swallowed above, so
  // paint mode keeps control of the cell, but it must not stamp the pattern.
  const button = (e as MouseEvent).button;
  if (typeof button === "number" && button !== 0) return;
  const targets =
    paintMode.scope === "cell" ? [cell] : getCellsInScope(table, paintMode.scope, cell);
  paintProperties(table, targets, paintMode.pattern);
  positionPaintBadge();
}

function onPaintKeyDown(e: KeyboardEvent): void {
  if (e.key !== "Escape") return;
  e.stopPropagation();
  exitPaintFormatMode();
}

export function enterPaintFormatMode(
  table: HTMLElement,
  scope: "cell" | "row" | "column",
  sourceCells: HTMLElement[],
): void {
  if (!sourceCells.length) return;
  exitPaintFormatMode();
  ensurePaintFormatStyle();
  const badge = makePaintFormatBadge();
  document.body.appendChild(badge);
  paintMode = {
    scope,
    pattern: sourceCells.map((c) => snapshotCellProperties(c)),
    table,
    badge,
  };
  document.body.classList.add("bloom-paint-format");
  document.addEventListener("pointerdown", onPaintPointerDown, true);
  document.addEventListener("mousedown", onPaintPointerDown, true);
  document.addEventListener("click", onPaintPointerDown, true);
  document.addEventListener("keydown", onPaintKeyDown, true);
  window.addEventListener("scroll", positionPaintBadge, true);
  window.addEventListener("resize", positionPaintBadge);
  overlayHider(); // pills stay out of the way while painting
  positionPaintBadge();
}

export function exitPaintFormatMode(): void {
  if (!paintMode) return;
  paintMode.badge.remove();
  paintMode = null;
  document.body.classList.remove("bloom-paint-format");
  document.removeEventListener("pointerdown", onPaintPointerDown, true);
  document.removeEventListener("mousedown", onPaintPointerDown, true);
  document.removeEventListener("click", onPaintPointerDown, true);
  document.removeEventListener("keydown", onPaintKeyDown, true);
  window.removeEventListener("scroll", positionPaintBadge, true);
  window.removeEventListener("resize", positionPaintBadge);
}

// Saving strips this mode's badge, cursor <style> and body class, so the mode
// itself has to go with them; prepare-for-save calls this without importing
// this module (see setPaintFormatExiter).
setPaintFormatExiter(exitPaintFormatMode);
