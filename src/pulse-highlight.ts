// Toolbar hover highlight: shows which table region a toolbar section's controls
// would change, so the user can see what will be affected before acting.
//
// Sections map to regions like this:
//   Table section            -> the whole table            [border]
//   Row section              -> the selected row            [fill]
//   Column section           -> the selected column         [fill]
//   Cell: content/align/...  -> the selected cell           [fill]
//   Cell: borders / corners  -> the selected cell's edges   [border]
//
// We draw ONE overlay rectangle covering the region's bounding box (not a class
// on every cell), so a multi-cell region (row/column/table) reads as a single
// highlighted area rather than N separate boxes — important for the "marching
// ants" / outline styles. The overlay is a transient, body-appended element
// tagged data-table-overlay (so prepare-for-save strips it); its look is driven
// by the same --bloom-pulse-* variables and [data-pulse-style] as before, via
// .bloom-sel-overlay rules in bloom-table-edit.css.

import { getRowAndColumn, getTableCells } from "./structure";

const OVERLAY_CLASS = "bloom-sel-overlay";

type Kind = "fill" | "border";

function docOf(ref?: HTMLElement | null): Document {
  return ref?.ownerDocument ?? document;
}

/** Remove every highlight overlay from the document that owns `ref`. */
export function clearPulse(ref?: HTMLElement | null): void {
  docOf(ref)
    .querySelectorAll<HTMLElement>(`.${OVERLAY_CLASS}`)
    .forEach((el) => el.remove());
}

function activeCells(table: HTMLElement): HTMLElement[] {
  return getTableCells(table).filter((c) => !c.classList.contains("bloom-skip"));
}

function spanX(cell: HTMLElement): number {
  return Math.max(1, parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1);
}
function spanY(cell: HTMLElement): number {
  return Math.max(1, parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1);
}

// Draw a single overlay covering the union bounding box of `cells`.
function addRegionOverlay(cells: HTMLElement[], kind: Kind): void {
  if (!cells.length) return;
  const doc = cells[0].ownerDocument;
  const win = doc.defaultView ?? window;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const c of cells) {
    const r = c.getBoundingClientRect();
    if (!r.width && !r.height) continue; // skip hidden/zero-size cells
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return;

  const overlay = doc.createElement("div");
  overlay.className = `${OVERLAY_CLASS} bloom-sel-${kind}`;
  overlay.setAttribute("data-table-overlay", "");
  const s = overlay.style;
  s.position = "absolute";
  // Page coordinates so the overlay tracks the region while the page scrolls.
  s.left = `${left + win.scrollX}px`;
  s.top = `${top + win.scrollY}px`;
  s.width = `${right - left}px`;
  s.height = `${bottom - top}px`;
  s.pointerEvents = "none";
  doc.body.appendChild(overlay);
}

/** Highlight the whole table (border treatment). */
export function pulseTableBorders(table?: HTMLElement | null): void {
  if (!table) return;
  clearPulse(table);
  addRegionOverlay(activeCells(table), "border");
}

/** Highlight the row that `currentCell` sits in (span-aware). */
export function pulseRow(table?: HTMLElement | null, currentCell?: HTMLElement | null): void {
  if (!table || !currentCell) return;
  clearPulse(table);
  let target: number;
  try {
    target = getRowAndColumn(table, currentCell).row;
  } catch {
    return;
  }
  const cells = activeCells(table).filter((c) => {
    const { row } = getRowAndColumn(table, c);
    return target >= row && target < row + spanY(c);
  });
  addRegionOverlay(cells, "fill");
}

/** Highlight the column that `currentCell` sits in (span-aware). */
export function pulseColumn(table?: HTMLElement | null, currentCell?: HTMLElement | null): void {
  if (!table || !currentCell) return;
  clearPulse(table);
  let target: number;
  try {
    target = getRowAndColumn(table, currentCell).column;
  } catch {
    return;
  }
  const cells = activeCells(table).filter((c) => {
    const { column } = getRowAndColumn(table, c);
    return target >= column && target < column + spanX(c);
  });
  addRegionOverlay(cells, "fill");
}

/** Highlight a single cell's content area. */
export function pulseCell(cell?: HTMLElement | null): void {
  if (!cell) return;
  clearPulse(cell);
  addRegionOverlay([cell], "fill");
}

/** Highlight a single cell's edges. */
export function pulseCellBorders(cell?: HTMLElement | null): void {
  if (!cell) return;
  clearPulse(cell);
  addRegionOverlay([cell], "border");
}

/** Demo helper: highlight every real table as a region (border treatment),
 *  skipping any inside an element marked [data-pulse-tuner] (the tuner preview). */
export function pulseAllTables(ref?: HTMLElement | null): void {
  const doc = docOf(ref);
  clearPulse(ref);
  doc.querySelectorAll<HTMLElement>(".bloom-table").forEach((t) => {
    if (t.closest("[data-pulse-tuner]")) return;
    addRegionOverlay(activeCells(t), "border");
  });
}
