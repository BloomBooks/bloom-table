// Toolbar hover highlight: shows which table region a toolbar section's controls
// would change, so the user can see what will be affected before acting.
//
// Sections map to regions like this:
//   Table section            -> the whole table
//   Row section              -> the selected row
//   Column section           -> the selected column
//   Cell: content/align/...  -> the selected cell
//   Cell: borders / corners  -> the selected cell
//
// We draw ONE overlay rectangle covering the region's bounding box (not a class
// on every cell), so a multi-cell region (row/column/table) reads as a single
// highlighted area. The overlay is a transient, body-appended element tagged
// data-table-overlay (so prepare-for-save strips it); its "marching ants" look
// is defined by .bloom-sel-overlay in bloom-table-edit.css.

import { getRowAndColumn, getTableCells } from "./structure";

const OVERLAY_CLASS = "bloom-sel-overlay";

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
function addRegionOverlay(cells: HTMLElement[]): void {
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
  overlay.className = OVERLAY_CLASS;
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

/** Highlight the whole table. */
export function pulseTableBorders(table?: HTMLElement | null): void {
  if (!table) return;
  clearPulse(table);
  addRegionOverlay(activeCells(table));
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
  addRegionOverlay(cells);
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
  addRegionOverlay(cells);
}

/** Highlight a single cell. */
export function pulseCell(cell?: HTMLElement | null): void {
  if (!cell) return;
  clearPulse(cell);
  addRegionOverlay([cell]);
}

/** Highlight a single cell (alias kept for the borders/corners controls). */
export function pulseCellBorders(cell?: HTMLElement | null): void {
  pulseCell(cell);
}
