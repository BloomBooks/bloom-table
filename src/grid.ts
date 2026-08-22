// One-pass grid model for a bloom-table.
//
// Several hot paths used to answer "which cell is at (row, column)?" or "which
// spanning cell covers (row, column)?" by rescanning the table's children and
// re-deriving every cell's position per query — O(cells) work per lookup, and
// O(cells^2) or worse in loops. buildGrid walks the table ONCE and returns a
// GridView that answers those questions by index math and array lookup.
//
// A GridView is a snapshot: it stays valid only while the table's cell list,
// declared sizes, and spans are unchanged. Build it before mutating, use it,
// throw it away.
//
// This module deliberately imports nothing except table-model, so structure.ts
// (and anything else) can depend on it without import cycles.

import { getSpan, getColumnWidths, getRowHeights } from "./table-model";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * All cell elements of a table (including bloom-skip ones), in DOM order.
 * Same semantics as structure.getTableCells: direct children with the
 * bloom-cell class, and the table itself must carry the bloom-table class.
 */
export function cellsOf(table: HTMLElement): HTMLElement[] {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");

  const cells: HTMLElement[] = [];
  Array.from(table.children).forEach((element) => {
    if (element.classList.contains("bloom-cell")) {
      cells.push(element as HTMLElement);
    } else {
      console.debug(`Element ${element.tagName} is not a cell, skipping.`);
    }
  });
  return cells;
}

/**
 * The spanning (anchor) cell covering a grid position, with its position and
 * span. null (from coverAt) when no non-skip cell covers the position.
 */
export type SpanCover = {
  anchor: HTMLElement;
  row: number;
  column: number;
  spanX: number;
  spanY: number;
};

export interface GridView {
  rows: number;
  cols: number;
  /** All cells (including bloom-skip ones), in DOM order. */
  cells: HTMLElement[];
  /**
   * Each cell's logical position. A cell that falls outside the declared
   * rows x cols grid (broken data) has no entry.
   */
  posOf: Map<HTMLElement, { row: number; column: number }>;
  /** The cell at (r, c), or undefined when out of range / missing from the DOM. */
  cellAt(r: number, c: number): HTMLElement | undefined;
  /** The non-skip cell whose span covers (r, c), or null. */
  coverAt(r: number, c: number): SpanCover | null;
}

/**
 * Build a GridView in a single pass over the table.
 *
 * Dimensions come from table-model's getColumnWidths / getRowHeights — the one
 * tokenizer for the size attributes (positional; an empty token means "default
 * size for that position" and is never dropped) — so positions computed here
 * agree with structure.getTableInfo and every other reader.
 */
export function buildGrid(table: HTMLElement): GridView {
  const cols = getColumnWidths(table).length;
  const rows = getRowHeights(table).length;

  const cells = cellsOf(table);

  const posOf = new Map<HTMLElement, { row: number; column: number }>();
  if (cols > 0) {
    const inGrid = Math.min(cells.length, rows * cols);
    for (let i = 0; i < inGrid; i++) {
      posOf.set(cells[i], { row: Math.floor(i / cols), column: i % cols });
    }
  }

  // rows x cols cover matrix: for each non-skip cell, read its span once and
  // stamp its SpanCover into every slot it covers. First stamp wins, matching
  // the old findSpanCover's first-cell-in-DOM-order answer if broken data ever
  // makes two non-skip cells claim the same slot. Spans reaching past the
  // table bounds are clipped (out-of-range slots don't exist to stamp).
  const cover: (SpanCover | null)[] = new Array(rows * cols).fill(null);
  for (const [cell, pos] of posOf) {
    if (cell.classList.contains("bloom-skip")) continue;
    const span = getSpan(cell);
    const entry: SpanCover = {
      anchor: cell,
      row: pos.row,
      column: pos.column,
      spanX: span.x,
      spanY: span.y,
    };
    const rEnd = Math.min(pos.row + span.y, rows);
    const cEnd = Math.min(pos.column + span.x, cols);
    for (let r = pos.row; r < rEnd; r++) {
      for (let c = pos.column; c < cEnd; c++) {
        const idx = r * cols + c;
        if (!cover[idx]) cover[idx] = entry;
      }
    }
  }

  return {
    rows,
    cols,
    cells,
    posOf,
    cellAt(r: number, c: number): HTMLElement | undefined {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return undefined;
      return cells[r * cols + c];
    },
    coverAt(r: number, c: number): SpanCover | null {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
      return cover[r * cols + c];
    },
  };
}
