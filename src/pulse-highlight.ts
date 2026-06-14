// Toolbar hover pulse: highlight the table parts a toolbar section's controls
// would change, so the user can see what will be affected before acting.
//
// Sections map to parts like this:
//   Table section            -> all borders (perimeter + interior)  [border]
//   Row section              -> the selected row's cells            [fill]
//   Column section           -> the selected column's cells         [fill]
//   Cell: content/align/...  -> the selected cell                   [fill]
//   Cell: borders / corners  -> the selected cell's edges           [border]
//
// These are pure DOM reads + classList toggles on the table that already lives
// in the document, so they work regardless of which realm the panel runs in
// (no history-manager singleton involved). The CSS animations live in
// bloom-table-edit.css.

import { getRowAndColumn, getTableCells } from "./structure";

const FILL = "bloom-pulse-fill";
const BORDER = "bloom-pulse-border";
const PULSE_SELECTOR = `.${FILL}, .${BORDER}`;

function docOf(ref?: HTMLElement | null): Document {
  return ref?.ownerDocument ?? document;
}

/** Remove every pulse class from the document that owns `ref` (or the global one). */
export function clearPulse(ref?: HTMLElement | null): void {
  docOf(ref)
    .querySelectorAll<HTMLElement>(PULSE_SELECTOR)
    .forEach((el) => el.classList.remove(FILL, BORDER));
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

/** Pulse all of the table's borders (perimeter + interior). */
export function pulseTableBorders(table?: HTMLElement | null): void {
  if (!table) return;
  clearPulse(table);
  activeCells(table).forEach((c) => c.classList.add(BORDER));
}

/** Pulse the cells of the row that `currentCell` sits in (span-aware). */
export function pulseRow(table?: HTMLElement | null, currentCell?: HTMLElement | null): void {
  if (!table || !currentCell) return;
  clearPulse(table);
  let target: number;
  try {
    target = getRowAndColumn(table, currentCell).row;
  } catch {
    return;
  }
  activeCells(table).forEach((c) => {
    const { row } = getRowAndColumn(table, c);
    if (target >= row && target < row + spanY(c)) c.classList.add(FILL);
  });
}

/** Pulse the cells of the column that `currentCell` sits in (span-aware). */
export function pulseColumn(table?: HTMLElement | null, currentCell?: HTMLElement | null): void {
  if (!table || !currentCell) return;
  clearPulse(table);
  let target: number;
  try {
    target = getRowAndColumn(table, currentCell).column;
  } catch {
    return;
  }
  activeCells(table).forEach((c) => {
    const { column } = getRowAndColumn(table, c);
    if (target >= column && target < column + spanX(c)) c.classList.add(FILL);
  });
}

/** Pulse a single cell's content area. */
export function pulseCell(cell?: HTMLElement | null): void {
  if (!cell) return;
  clearPulse(cell);
  cell.classList.add(FILL);
}

/** Pulse a single cell's edges. */
export function pulseCellBorders(cell?: HTMLElement | null): void {
  if (!cell) return;
  clearPulse(cell);
  cell.classList.add(BORDER);
}
