/**
 * Table Operations Module
 *
 * This module provides functions for manipulating tables represented as HTML elements.
 *
 * ## Table Representation
 *
 * Tables are represented using this HTML structure:
 *
 * ### HTML Structure:
 * ```html
 * <div class="bloom-table" data-column-widths="100px,fit" data-row-heights="50px,60px">
 *   <div class="bloom-cell">Cell 0,0</div>
 *   <div class="bloom-cell">Cell 0,1</div>
 *   <div class="bloom-cell">Cell 1,0</div>
 *   <div class="bloom-cell">Cell 1,1</div>
 * </div>
 * ```
 *
 * ### Key Components:
 *
 * 1. **Table Container**: A div with class "table"
 *    - `data-column-widths`: Comma-separated list of column widths (e.g., "100px,200px,fit")
 *    - `data-row-heights`: Comma-separated list of row heights (e.g., "50px,60px,fit")
 *
 * 2. **Cell Elements**: Direct children divs with class "cell"
 *    - Ordered left-to-right, top-to-bottom in the DOM
 *    - Spans configured via data attributes on each cell:
 *      - `data-span-x`: Number of columns to span (default: 1)
 *      - `data-span-y`: Number of rows to span (default: 1)
 *
 * 3. **Borders (edge-based model)**: Borders are defined on the table as arrays, not per-cell attributes.
 *    - `data-edges-h`: JSON (R-1 x C) of objects with optional `north` / `south` BorderSpec.
 *    - `data-edges-v`: JSON (R x C-1) of objects with optional `west` / `east` BorderSpec.
 *    - Unified edges include perimeters: `data-edges-h` is (R+1)xC (top=0, bottom=R), `data-edges-v` is Rx(C+1) (left=0, right=C).
 *    - `data-border-default`: optional BorderSpec default used only when an interior edge entry is entirely unspecified (both sides absent) and there is zero gap. Not applied across gaps or to perimeters.
 *    - Gaps (optional): `data-gap-x` (C-1 entries) and `data-gap-y` (R-1 entries) enable independent sided painting.
 *
 * ### Cell Positioning:
 * - Cells are positioned in DOM order: [0,0], [0,1], [1,0], [1,1], etc.
 * - Cell spans affect logical positioning but not DOM order
 * - A cell spanning 2 columns will "cover" the cell to its right
 * - A cell spanning 2 rows will "cover" the cell below it
 *
 * ### Spanning Behavior:
 * - When a cell spans multiple columns/rows, the covered cells are preserved in the DOM,
 * but they get a "skip" class to indicate they are not active.
 * - A cell spanning multiple columns and rows covers a rectangular area.
 * - Example: cell[0,0] spanning 2x2 in a 2x2 table causes cell[0,1], cell[1,0], and cell[1,1] to be marked as skipped.
 *
 * ### Size Values:
 * - "hug": CSS Table minmax(max-content,max-content) - size to content
 * - "fill": CSS Table minmax(0,1fr) - expand to fill available space
 * - Standard CSS units: "100px", "2rem", "50%", etc.
 *
 * # Warning:
 * Be careful with querySelectorAll with advanced selectors like ":scope > .bloom-cell". because the unit tests
 * use happy-dom, which do not support this selector properly. There may be other selectors that also do not work.
 */

import { tableHistoryManager } from "./history";
import { setupContentsOfCell, getCurrentContentTypeId } from "./cell-contents";
import type { HEdgeEntry, VEdgeEntry } from "./table-model";
import {
  getEdgesH,
  setEdgesH,
  getEdgesV,
  setEdgesV,
  getGapX,
  setGapX,
  getGapY,
  setGapY,
} from "./table-model";

/**
 * Per-cell appearance settings that a newly inserted row/column should inherit
 * from the selected (source) row/column. These are the formatting attributes
 * (fill, alignment, padding, corners) — NOT span (which is positional) or
 * content-type/content (a new cell starts empty). Borders are handled
 * separately via the edge arrays.
 */
// The transferable per-cell settings: everything that makes a cell "the same
// kind of cell" without copying its content. This is THE definition shared by
// row/column insertion (structure.ts) and the copy/paste-properties clipboard
// (formatting-commands.ts) — extend it here so the consumers can't drift.
const CELL_SETTING_ATTRS = ["data-bg", "data-align", "data-pad", "data-corners"] as const;

export type CellSettings = Partial<Record<(typeof CELL_SETTING_ATTRS)[number], string | null>> & {
  contentType?: string;
};

export function snapshotCellSettings(cell: HTMLElement): CellSettings {
  const snap: CellSettings = {};
  for (const attr of CELL_SETTING_ATTRS) snap[attr] = cell.getAttribute(attr);
  snap.contentType = getCurrentContentTypeId(cell);
  return snap;
}

export function applyCellSettings(cell: HTMLElement, snap: CellSettings): void {
  for (const attr of CELL_SETTING_ATTRS) {
    const v = snap[attr];
    if (v != null) cell.setAttribute(attr, v);
    else cell.removeAttribute(attr);
  }
  // The cell holds the same KIND of content as the snapshot's source — an
  // empty skeleton of that content type, not a copy of its content (a no-op
  // when the type already matches). History/host notification are suppressed:
  // callers run this inside their own history entry and dispatch the
  // content-changed event themselves after it closes.
  if (snap.contentType) setupContentsOfCell(cell, snap.contentType, false, false);
}

// Clamp a caller-supplied source index to a valid row/column, or null when no
// source was given (or the table is empty) — in which case nothing is copied.
function resolveSourceIndex(sourceIndex: number | undefined, count: number): number | null {
  if (sourceIndex == null || count <= 0) return null;
  return Math.max(0, Math.min(sourceIndex, count - 1));
}

// Deep-clone an edge entry (BorderSpec, sided object, or null) so the inserted
// row/column gets independent copies of the source's border specs.
function cloneEdge<T>(entry: T | undefined): T | Record<string, never> {
  if (entry === undefined) return {};
  if (entry === null) return null as unknown as T;
  return JSON.parse(JSON.stringify(entry)) as T;
}

// ---- Edge and gap array maintenance -----------------------------------------
// data-edges-h / data-edges-v are indexed by boundary, so every operation that
// adds, removes, or reorders a row/column has to move them in step with the
// cells. Unified (full) size is H = (R+1) x C and V = R x (C+1); a stale array
// matches none of the renderer's accepted shapes, which silently drops every
// border it held.

type EdgeRow = unknown[];

// A line of entirely unspecified edge entries.
function blankEdges(n: number): EdgeRow {
  return Array.from({ length: n }, () => ({}));
}

// Is this entry a single BorderSpec shared by both sides, rather than a sided
// west/east | north/south object? Same test the renderer and edge-utils use.
function isSharedSpec(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const o = entry as Record<string, unknown>;
  return (
    typeof o.weight === "number" ||
    Object.prototype.hasOwnProperty.call(o, "style") ||
    Object.prototype.hasOwnProperty.call(o, "color")
  );
}

// One side of an edge entry; a shared spec answers for both sides.
function edgeSide(entry: unknown, side: "north" | "south" | "west" | "east"): unknown {
  if (!entry || typeof entry !== "object") return null;
  if (isSharedSpec(entry)) return entry;
  return (entry as Record<string, unknown>)[side] ?? null;
}

// The single boundary left where two boundaries meet after the row/column
// between them is removed: each surviving neighbour keeps the side it faced.
function mergeBoundaryEntry(
  near: unknown,
  far: unknown,
  nearSide: "north" | "west",
  farSide: "south" | "east",
): unknown {
  const a = edgeSide(near, nearSide);
  const b = edgeSide(far, farSide);
  const merged: Record<string, unknown> = {};
  if (a) merged[nearSide] = a;
  if (b) merged[farSide] = b;
  return merged;
}

// Expand one concise (interior-only, or single-interior) line of edge entries
// to the unified layout of `full` boundaries. A line that is already full, or
// of a length we don't recognise, comes back untouched: normalization must
// never invent or drop authored borders.
function expandEdgeLine(line: EdgeRow, full: number): EdgeRow {
  const interior = Math.max(0, full - 2);
  if (line.length === full) return line;
  if (interior > 0 && line.length === interior) return [{}, ...line, {}];
  if (interior >= 1 && line.length === 1) {
    const out = blankEdges(full);
    out[1] = line[0];
    return out;
  }
  return line;
}

/**
 * Rewrite the table's edge arrays in the unified full-size layout. The renderer
 * also reads the concise interior-only form, but only the full form can be
 * spliced boundary-by-boundary, so every structural operation normalizes first;
 * otherwise a concise array survives the operation unchanged, then matches none
 * of the renderer's accepted shapes and every authored border disappears.
 */
function normalizeEdgeArrays(table: HTMLElement, rows: number, cols: number): void {
  const v = getEdgesV(table);
  if (v && v.length === rows) {
    const next = v.map((row) =>
      Array.isArray(row) ? expandEdgeLine(row as EdgeRow, cols + 1) : blankEdges(cols + 1),
    );
    setEdgesV(table, next as unknown as VEdgeEntry[][]);
  }

  const h = getEdgesH(table);
  if (h) {
    // Expanding the outer array inserts placeholder entries for the perimeter
    // boundaries; the pass below turns those (and any short line) into a full
    // blank line of `cols` entries.
    const boundaries = expandEdgeLine(h as unknown as EdgeRow, rows + 1) as EdgeRow[];
    if (boundaries.length === rows + 1) {
      const next = boundaries.map((row) => {
        if (!Array.isArray(row)) return blankEdges(cols);
        const line = row.slice() as EdgeRow;
        while (line.length < cols) line.push({});
        return line;
      });
      setEdgesH(table, next as unknown as HEdgeEntry[][]);
    }
  }
}

const fullV = (v: unknown[][] | null, rows: number, cols: number): boolean =>
  !!v && v.length === rows && v.every((r) => Array.isArray(r) && r.length === cols + 1);
const fullH = (h: unknown[][] | null, rows: number, cols: number): boolean =>
  !!h && h.length === rows + 1 && h.every((r) => Array.isArray(r) && r.length === cols);

/**
 * When a row is inserted, splice the table's edge arrays so existing borders
 * stay aligned and the new row inherits the source row's borders.
 *  - V edges (rows x cols+1): the new row copies the source row's vertical lines
 *    (a blank row gets unspecified ones).
 *  - H edges (rows+1 x cols): a new horizontal boundary is inserted at the
 *    insertion index, copied from the boundary it splits (which is the source
 *    row's adjacent top/bottom line), preserving neighbouring rows' borders.
 *    A blank row brings no borders, so its new boundary is unspecified and the
 *    table's own top/bottom perimeters stay where they are.
 * Only runs when the arrays exist and are full-sized for the current dimensions.
 */
function insertEdgesForNewRow(
  table: HTMLElement,
  insertIndex: number,
  sourceRow: number | null,
  rows: number,
  cols: number,
): void {
  const v = getEdgesV(table);
  if (fullV(v as unknown[][] | null, rows, cols)) {
    const src = sourceRow != null ? v![sourceRow] : undefined;
    const newRow = src ? src.map((e) => cloneEdge(e)) : blankEdges(cols + 1);
    v!.splice(insertIndex, 0, newRow as VEdgeEntry[]);
    setEdgesV(table, v!);
  }

  const h = getEdgesH(table);
  if (fullH(h as unknown[][] | null, rows, cols)) {
    if (sourceRow != null) {
      const base = h![insertIndex] ? h![insertIndex].map((e) => cloneEdge(e)) : blankEdges(cols);
      h!.splice(insertIndex, 0, base as HEdgeEntry[]);
    } else {
      h!.splice(insertIndex === 0 ? 1 : insertIndex, 0, blankEdges(cols) as HEdgeEntry[]);
    }
    setEdgesH(table, h!);
  }
}

/**
 * Column counterpart of insertEdgesForNewRow.
 *  - H edges (rows+1 x cols): the new column copies the source column's
 *    horizontal lines (top/bottom of its cells) at each boundary row.
 *  - V edges (rows x cols+1): a new vertical boundary is inserted at the
 *    insertion index, copied from the boundary it splits, preserving neighbours.
 */
function insertEdgesForNewColumn(
  table: HTMLElement,
  insertIndex: number,
  sourceColumn: number | null,
  rows: number,
  cols: number,
): void {
  const h = getEdgesH(table);
  if (fullH(h as unknown[][] | null, rows, cols)) {
    for (let b = 0; b <= rows; b++) {
      const entry = sourceColumn != null ? cloneEdge(h![b][sourceColumn]) : {};
      h![b].splice(insertIndex, 0, entry as HEdgeEntry);
    }
    setEdgesH(table, h!);
  }

  const v = getEdgesV(table);
  if (fullV(v as unknown[][] | null, rows, cols)) {
    for (let r = 0; r < rows; r++) {
      if (sourceColumn != null) {
        v![r].splice(insertIndex, 0, cloneEdge(v![r][insertIndex]) as VEdgeEntry);
      } else {
        v![r].splice(insertIndex === 0 ? 1 : insertIndex, 0, {} as VEdgeEntry);
      }
    }
    setEdgesV(table, v!);
  }
}

/**
 * When a row is removed, splice its edge data out so the surviving rows keep
 * the borders they were authored with.
 *  - V edges: the removed row's line of vertical entries goes away.
 *  - H edges: the row's two horizontal boundaries collapse into one. The
 *    table's top/bottom perimeters stay put (removing the first or last row
 *    drops the interior boundary next to it); for an interior row the two
 *    boundaries merge, each surviving neighbour keeping the face it showed.
 */
function removeEdgesForRemovedRow(
  table: HTMLElement,
  index: number,
  rows: number,
  _cols: number,
): void {
  const v = getEdgesV(table);
  if (v && v.length === rows) {
    v.splice(index, 1);
    setEdgesV(table, v);
  }

  const h = getEdgesH(table);
  if (h && h.length === rows + 1) {
    const interior = index > 0 && index < rows - 1;
    if (interior && Array.isArray(h[index]) && Array.isArray(h[index + 1])) {
      const above = h[index] as EdgeRow;
      const below = h[index + 1] as EdgeRow;
      h[index] = above.map((e, c) =>
        mergeBoundaryEntry(e, below[c], "north", "south"),
      ) as HEdgeEntry[];
    }
    h.splice(index === 0 ? 1 : interior ? index + 1 : index, 1);
    setEdgesH(table, h);
  }
}

/** Column counterpart of removeEdgesForRemovedRow. */
function removeEdgesForRemovedColumn(
  table: HTMLElement,
  index: number,
  rows: number,
  cols: number,
): void {
  const h = getEdgesH(table);
  if (h && h.length === rows + 1) {
    for (const line of h) {
      if (Array.isArray(line) && line.length === cols) line.splice(index, 1);
    }
    setEdgesH(table, h);
  }

  const v = getEdgesV(table);
  if (v && v.length === rows) {
    const interior = index > 0 && index < cols - 1;
    const drop = index === 0 ? 1 : interior ? index + 1 : index;
    for (const line of v) {
      if (!Array.isArray(line) || line.length !== cols + 1) continue;
      if (interior) {
        line[index] = mergeBoundaryEntry(line[index], line[index + 1], "west", "east") as VEdgeEntry;
      }
      line.splice(drop, 1);
    }
    setEdgesV(table, v);
  }
}

// Gaps are per-boundary lists too: data-gap-x has C-1 entries and data-gap-y
// R-1 (boundary b sits between lines b and b+1). A list of a single value
// applies to every boundary, so only a genuinely per-boundary list needs
// splicing; anything of an unexpected length is left alone.
function gapAccess(axis: LineAxis): {
  get: (t: HTMLElement) => string[];
  set: (t: HTMLElement, g: string[]) => void;
} {
  return axis === "row" ? { get: getGapY, set: setGapY } : { get: getGapX, set: setGapX };
}

function perBoundaryGaps(table: HTMLElement, axis: LineAxis, lineCount: number): string[] | null {
  const tokens = gapAccess(axis).get(table);
  if (tokens.length < 2 || tokens.length !== lineCount - 1) return null;
  return tokens;
}

function spliceGapForInsertedLine(
  table: HTMLElement,
  axis: LineAxis,
  insertIndex: number,
  lineCount: number,
): void {
  const tokens = perBoundaryGaps(table, axis, lineCount);
  if (!tokens) return;
  // The new line splits a boundary; the new one starts out like the one it split.
  const at = Math.min(insertIndex, tokens.length);
  const source = tokens[Math.min(insertIndex, tokens.length - 1)] ?? "0";
  tokens.splice(at, 0, source);
  gapAccess(axis).set(table, tokens);
}

function spliceGapForRemovedLine(
  table: HTMLElement,
  axis: LineAxis,
  index: number,
  lineCount: number,
): void {
  const tokens = perBoundaryGaps(table, axis, lineCount);
  if (!tokens) return;
  tokens.splice(Math.min(index, tokens.length - 1), 1);
  gapAccess(axis).set(table, tokens);
}

function reorderGapForMovedLine(
  table: HTMLElement,
  axis: LineAxis,
  from: number,
  to: number,
  lineCount: number,
): void {
  const tokens = perBoundaryGaps(table, axis, lineCount);
  if (!tokens) return;
  // Same convention as the edge arrays under a move: a line carries its
  // leading boundary. Line 0 has no leading interior boundary, so it gets a
  // placeholder that is dropped again — a line moved to the front leaves its
  // gap behind, because the position it lands in has no boundary before it.
  const owned = ["0", ...tokens];
  const [moved] = owned.splice(from, 1);
  owned.splice(to, 0, moved);
  gapAccess(axis).set(table, owned.slice(1));
}

/**
 * Runtime assertion function that throws an error if the condition is false.
 * Used throughout table operations to validate parameters and state.
 * This helps catch programming errors early with clear error messages.
 *
 * @param condition The condition to check
 * @param message The error message to throw if the condition is false
 * @throws {Error} If the condition is false
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Gets all cell elements from a table, including those marked as "skip".
 * This is the canonical way to get cells from a table that handles the table structure properly.
 *
 * @param table The table container element
 * @returns Array of all cell elements in DOM order
 */
export function getTableCells(table: HTMLElement): HTMLElement[] {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");

  const cells: HTMLElement[] = [];
  Array.from(table.children).forEach((element) => {
    if (element.classList.contains("bloom-cell")) {
      cells.push(element as HTMLElement);
    } else {
      console.debug(`Element ${element.tagName} is not a cell, skipping.`);
    }
  });

  // in both js-dom and happy-dom v15, the querySelectorAll gives "0" when "":scope > selector" is used
  // const cellsViaSelector = Array.from(
  //   table.querySelectorAll<HTMLElement>(":scope > .bloom-cell")
  // );
  // if (cellsViaSelector.length !== cells.length) {
  //   console.warn(
  //     `getTableCells: Mismatch in cell count. DOM children: ${cells.length}, querySelectorAll: ${cellsViaSelector.length}`
  //   );
  // }
  return cells;
}

/**
 * Creates a new cell element with proper class and default contents.
 * Uses the cell-contents module to set up the default content type.
 *
 * @returns A new HTMLElement configured as a table cell
 */
function createCell(): HTMLElement {
  const newCell = document.createElement("div");
  newCell.className = "bloom-cell";

  // Use cell-contents.ts to set up the default contents
  setupContentsOfCell(newCell);

  return newCell;
}

// A new table, and a new column in an old one, grows to share the width of the
// page. A table the user has just made is nearly always meant to span the
// space it sits in, and a column that hugs its text leaves that space empty.
export const defaultColumnWidth = "fill";
export const defaultRowHeight = "hug";

export const getTargetTable = (): HTMLElement | null => {
  // Start from the currently focused element
  let currentElement = document.activeElement as HTMLElement | null;

  if (!currentElement) {
    console.warn("No active element found. Cannot determine target table.");
    return null;
  }

  return currentElement.closest<HTMLElement>(".bloom-table") || null;
};

export const addRow = (table: HTMLElement, skipHistory = false, sourceIndex?: number): void => {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");

  const description = "Add Row";
  const performOperation = () => {
    const info = getTableInfo(table);
    const src = resolveSourceIndex(sourceIndex, info.rowCount);
    insertLineAt(table, "row", info.rowCount, src, src != null ? "skeleton" : "blank");
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

export const removeLastRow = (table: HTMLElement): void => {
  if (!table) return;

  // Removing the last row is removing a row: it goes through the same core, so
  // spans, edge arrays and gaps are maintained in exactly one place.
  const info = getTableInfo(table);
  if (info.rowCount === 0) {
    console.info("No rows to remove from the target table.");
    return;
  }

  const description = "Remove Last Row";
  const performOperation = () => removeLineAt(table, "row", getTableInfo(table).rowCount - 1);

  tableHistoryManager.addHistoryEntry(table, description, performOperation);
};

export const addColumn = (table: HTMLElement, skipHistory = false, sourceIndex?: number): void => {
  if (!table) return;

  const description = "Add Column";
  const performOperation = () => {
    const info = getTableInfo(table);
    if (info.rowCount === 0) {
      // Attach-time bootstrap: a table with no rows yet still records the
      // column's width, so the first added row creates the right cell count.
      table.setAttribute(
        "data-column-widths",
        [...info.columnWidths, defaultColumnWidth].join(","),
      );
      return;
    }
    const src = resolveSourceIndex(sourceIndex, info.columnCount);
    insertLineAt(table, "column", info.columnCount, src, src != null ? "skeleton" : "blank");
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

export const undoLastOperation = (table: HTMLElement): boolean => {
  if (!table) return false;

  return tableHistoryManager.undo(table);
};

export const canUndo = (): boolean => {
  return tableHistoryManager.canUndo();
};

export const getLastOperation = (): string | null => {
  return tableHistoryManager.getLastOperationLabel();
};

export function removeLastColumn(table: HTMLElement) {
  if (!table) return;

  const info = getTableInfo(table);
  if (info.columnCount <= 1) {
    console.info("Cannot remove the last column.");
    return;
  }

  const description = "Remove Last Column";
  // Same core as removeColumnAt, so spans, edges and gaps stay maintained.
  const performOperation = () =>
    removeLineAt(table, "column", getTableInfo(table).columnCount - 1);

  tableHistoryManager.addHistoryEntry(table, description, performOperation);
}

/**
 * Extracts table information from a table element's data attributes and current state.
 * This is a key utility function used throughout the codebase for table operations.
 *
 * The table stores its structure in data attributes:
 * - data-column-widths: comma-separated list of column widths
 * - data-row-heights: comma-separated list of row heights
 *
 * The actual cell count is determined by counting DOM elements with class "cell".
 *
 * @param table The table container element
 * @returns Object containing table dimensions and cell information
 */
export function getTableInfo(table: HTMLElement): {
  columnCount: number;
  rowCount: number;
  columnWidths: string[];
  rowHeights: string[];
  cellCount: number;
} {
  // Parse column widths from data attribute, filtering out empty values
  const columnWidths = (table.getAttribute("data-column-widths") || "")
    .split(",")
    .filter((width) => width.trim() !== "");
  // Parse row heights from data attribute, filtering out empty values
  const rowHeights = (table.getAttribute("data-row-heights") || "")
    .split(",")
    .filter((height) => height.trim() !== ""); // Count actual cell elements in the DOM (may differ from expected due to spans)
  const cellCount = getTableCells(table).length;

  return {
    columnWidths,
    rowHeights,
    cellCount,
    columnCount: columnWidths.length,
    rowCount: rowHeights.length,
  };
}

export function changeCellSpan(cell: HTMLElement, xChange: number, yChange: number): void {
  const table = cell.closest<HTMLElement>(".bloom-table");
  assert(!!table, "Cell must be inside a table element");

  const currentSpanX = parseInt(cell.getAttribute("data-span-x") || "1") || 1;
  const currentSpanY = parseInt(cell.getAttribute("data-span-y") || "1") || 1;

  // Calculate new span values
  const newHorizontalSpan = Math.max(1, currentSpanX + xChange);
  const newVerticalSpan = Math.max(1, currentSpanY + yChange);

  // Only proceed if there's an actual change
  if (newHorizontalSpan === currentSpanX && newVerticalSpan === currentSpanY) {
    return;
  }

  const description = `Change Cell Span (${
    xChange > 0 ? "+" : ""
  }${xChange}x, ${yChange > 0 ? "+" : ""}${yChange}y)`;
  const performOperation = () => {
    setCellSpan(cell, newHorizontalSpan, newVerticalSpan);
  };

  tableHistoryManager.addHistoryEntry(table, description, performOperation);
}

/**
 * Sets the horizontal and vertical span of a cell, which determines how many columns and rows it covers.
 * This function modifies the cell's CSS custom properties (--span-x, --span-y) and removes or adds
 * the "skip" class from covered cells as needed to maintain table structure.
 *
 * Important: When a cell spans, it covers a rectangular area. All cells within that area,
 * except for the spanning cell itself, get the "skip" class to indicate they are not active.
 *
 * Example: In a 2x2 table, setCellSpan(cell(0,0), 2, 2) will mark cell(0,1), cell(1,0), and cell(1,1) as skipped.
 *
 * @param cell The cell element to apply the span to
 * @param newHorizontalSpan Number of columns the cell should span (1 = no span)
 * @param newVerticalSpan Number of rows the cell should span (1 = no span)
 * @throws {Error} If the span would exceed table boundaries
 */
export function setCellSpan(cell: HTMLElement, newHorizontalSpan: number, newVerticalSpan: number) {
  const table = cell.closest<HTMLElement>(".bloom-table");
  assert(!!table, "Cell must be inside a table element");

  // data-span-* is the declared source of truth (the CSS vars are only a mirror
  // the renderer writes). Reading the vars here made an unmerge a silent no-op
  // on a cell whose span came from hand-authored HTML or table-model's setSpan
  // and had not been rendered yet.
  const currentSpanX = parseInt(cell.getAttribute("data-span-x") || "1") || 1;
  const currentSpanY = parseInt(cell.getAttribute("data-span-y") || "1") || 1;

  if (newHorizontalSpan === currentSpanX && newVerticalSpan === currentSpanY) {
    return;
  }

  const tableInfo = getTableInfo(table);
  const { row, column } = getRowAndColumn(table, cell);

  // Check bounds - ensure the span doesn't exceed table boundaries
  assert(
    column + newHorizontalSpan <= tableInfo.columnCount,
    `Horizontal span ${newHorizontalSpan} from column ${column} would exceed table bounds (${tableInfo.columnCount} columns)`,
  );
  assert(
    row + newVerticalSpan <= tableInfo.rowCount,
    `Vertical span ${newVerticalSpan} from row ${row} would exceed table bounds (${tableInfo.rowCount} rows)`,
  );

  // First, unmark all cells that were previously covered by this cell's span
  for (let r = row; r < row + currentSpanY; r++) {
    for (let c = column; c < column + currentSpanX; c++) {
      if (r === row && c === column) continue; // Skip the spanning cell itself
      const coveredCell = getCell(table, r, c);
      coveredCell.classList.remove("bloom-skip");
    }
  }

  // Set the new span values on the cell (data-* is source of truth; also mirror to CSS vars for compatibility)
  cell.setAttribute("data-span-x", String(newHorizontalSpan));
  cell.setAttribute("data-span-y", String(newVerticalSpan));
  if (newHorizontalSpan > 1) cell.style.setProperty("--span-x", String(newHorizontalSpan));
  else cell.style.removeProperty("--span-x");
  if (newVerticalSpan > 1) cell.style.setProperty("--span-y", String(newVerticalSpan));
  else cell.style.removeProperty("--span-y");

  // Now mark all cells that are covered by the new span
  for (let r = row; r < row + newVerticalSpan; r++) {
    for (let c = column; c < column + newHorizontalSpan; c++) {
      if (r === row && c === column) continue; // Skip the spanning cell itself
      const coveredCell = getCell(table, r, c);
      coveredCell.classList.add("bloom-skip");
    }
  }
}

/**
 * Calculates the logical row and column position of a cell within the table.
 *
 * @param table The table container element
 * @param cell The cell whose position we want to find
 * @returns Object with row and column (0-based indices)
 * @throws {Error} If the cell is not found in the table
 */
export function getRowAndColumn(
  table: HTMLElement,
  cell: HTMLElement,
): { row: number; column: number } {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
  assert(cell.classList.contains("bloom-cell"), "cell parameter must have 'cell' class");

  const tableInfo = getTableInfo(table);
  const cells = getTableCells(table);
  const cellIndex = cells.indexOf(cell);
  assert(cellIndex !== -1, "Cell not found in the table. Ensure it is a direct child of the table.");
  const columnCount = tableInfo.columnCount;
  const row = Math.floor(cellIndex / columnCount);
  const column = cellIndex % columnCount;
  assert(row >= 0 && row < tableInfo.rowCount, `Row index ${row} is out of bounds`);
  assert(column >= 0 && column < tableInfo.columnCount, `Column index ${column} is out of bounds`);
  return { row, column };
}

/**
 * Retrieves the cell element at the specified logical row and column position.
 * This is the inverse of getRowAndColumn - given a position, find the cell.
 *
 * Like getRowAndColumn, this must account for cell spans when traversing the table.
 * It uses the same algorithm but stops when it reaches the target position.
 *
 * @param table The table container element
 * @param row The target row (0-based)
 * @param column The target column (0-based)
 * @returns The HTMLElement at the specified position
 * @throws {Error} If the position is out of bounds or no cell is found
 */
export function getCell(table: HTMLElement, row: number, column: number): HTMLElement {
  // Check that table is an HTMLElement (or derivative)
  // No need to check instanceof HTMLElement since HTMLDivElement and other specific elements will pass this check
  // The presence of the 'table' class is sufficient for our validation
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");

  const tableInfo = getTableInfo(table);
  assert(row >= 0 && row < tableInfo.rowCount, `Row index ${row} would be out of bounds`);
  assert(
    column >= 0 && column < tableInfo.columnCount,
    `Column index ${column} would be out of bounds`,
  ); // Calculate the linear index in the DOM based on row and column
  const cellIndex = row * tableInfo.columnCount + column;
  const cells = getTableCells(table);

  assert(
    cellIndex < cells.length,
    `Cell at row ${row}, column ${column} not found in DOM (cellIndex=${cellIndex}, cells.length=${
      cells.length
    }, tableInfo=${JSON.stringify(tableInfo)})`,
  );

  return cells[cellIndex] as HTMLElement;
}

/**
 * Adds a column at the specified index position.
 * @param table The table container element
 * @param index The position to insert the column (0-based). If not provided, adds at the end.
 * @param skipHistory Whether to skip adding this operation to history
 */
export const addColumnAt = (
  table: HTMLElement,
  index?: number,
  skipHistory = false,
  sourceIndex?: number,
): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);
  const actualIndex = index ?? tableInfo.columnCount;

  assert(
    actualIndex >= 0 && actualIndex <= tableInfo.columnCount,
    `Column index ${actualIndex} is out of bounds`,
  );
  const description = `Add Column at ${actualIndex}`;
  const performOperation = () => {
    const src = resolveSourceIndex(sourceIndex, tableInfo.columnCount);
    insertLineAt(table, "column", actualIndex, src, src != null ? "skeleton" : "blank");
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Adds a row at the specified index position.
 * @param table The table container element
 * @param index The position to insert the row (0-based). If not provided, adds at the end.
 * @param skipHistory Whether to skip adding this operation to history
 */
export const addRowAt = (
  table: HTMLElement,
  index?: number,
  skipHistory = false,
  sourceIndex?: number,
): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);
  const actualIndex = index ?? tableInfo.rowCount;

  assert(
    actualIndex >= 0 && actualIndex <= tableInfo.rowCount,
    `Row index ${actualIndex} is out of bounds`,
  );
  const description = `Add Row at ${actualIndex}`;
  const performOperation = () => {
    const src = resolveSourceIndex(sourceIndex, tableInfo.rowCount);
    insertLineAt(table, "row", actualIndex, src, src != null ? "skeleton" : "blank");
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

// Deep-clone a cell for duplication, stripping transient editing state that
// must not exist twice in the document (selection classes, anchor names —
// including on descendants, e.g. cells of a nested table that hosted pills).
function cloneCellForDuplicate(cell: HTMLElement): HTMLElement {
  const clone = cell.cloneNode(true) as HTMLElement;
  const strip = (el: HTMLElement) => {
    el.classList.remove("cell--selected");
    el.style.removeProperty("anchor-name");
    delete (el.dataset as any).btableAnchorName;
  };
  strip(clone);
  clone.querySelectorAll<HTMLElement>("*").forEach(strip);
  return clone;
}

// The spanning (anchor) cell covering a grid position, with its position and
// span, or null when the position is out of range.
type SpanCover = {
  anchor: HTMLElement;
  row: number;
  column: number;
  spanX: number;
  spanY: number;
};

function findSpanCover(table: HTMLElement, row: number, column: number): SpanCover | null {
  for (const cell of getTableCells(table)) {
    if (cell.classList.contains("bloom-skip")) continue;
    const pos = getRowAndColumn(table, cell);
    const spanX = parseInt(cell.getAttribute("data-span-x") || "1") || 1;
    const spanY = parseInt(cell.getAttribute("data-span-y") || "1") || 1;
    if (
      row >= pos.row &&
      row < pos.row + spanY &&
      column >= pos.column &&
      column < pos.column + spanX
    ) {
      return { anchor: cell, row: pos.row, column: pos.column, spanX, spanY };
    }
  }
  return null;
}

// Give a clone fresh default contents. Used where a duplicate's cell is
// covered by (or freed from) a merge: carrying the source's content into it
// would duplicate that content — hidden inside a skip cell (and resurrected on
// a later unmerge), or immediately visible in a cell the source never showed.
function resetCloneContents(clone: HTMLElement): void {
  delete clone.dataset.contentType;
  clone.innerHTML = "";
  clone.removeAttribute("tabindex");
  setupContentsOfCell(clone);
}

// Write a cell's span attributes and their CSS-var mirrors (same convention as
// setCellSpan). x/y of 1 clears the attribute.
function writeSpan(cell: HTMLElement, x: number, y: number): void {
  if (x > 1) {
    cell.setAttribute("data-span-x", String(x));
    cell.style.setProperty("--span-x", String(x));
  } else {
    cell.removeAttribute("data-span-x");
    cell.style.removeProperty("--span-x");
  }
  if (y > 1) {
    cell.setAttribute("data-span-y", String(y));
    cell.style.setProperty("--span-y", String(y));
  } else {
    cell.removeAttribute("data-span-y");
    cell.style.removeProperty("--span-y");
  }
}

// ---- Unified line insertion and removal --------------------------------------
// Add row/column and duplicate row/column are all "insert a line at an index,
// modeled on a source line". They share this core; the differences are the
// axis and how the new cells are built:
//   "clone"    — deep copies of the source line's cells, contents included
//                (duplicate; the copy must land directly after its source)
//   "skeleton" — fresh cells inheriting the source cells' settings (see
//                CellSettings) plus the line's size and borders
//   "blank"    — fresh default cells (no source line)
// The core also keeps merges consistent: a merge crossing the insertion
// boundary grows one line, covering the new line's cells inside it.

type LineAxis = "row" | "column";
type NewCellsMode = "clone" | "skeleton" | "blank";
type TableInfo = ReturnType<typeof getTableInfo>;

// Everything axis-specific, so rows and columns share one implementation
// instead of two hand-mirrored ones (mirror drift has caused bugs before).
const lineAxisOps = {
  row: {
    sizeAttr: "data-row-heights",
    defaultSize: () => defaultRowHeight,
    sizes: (info: TableInfo) => info.rowHeights,
    lineCount: (info: TableInfo) => info.rowCount,
    perpCount: (info: TableInfo) => info.columnCount,
    cellAt: (table: HTMLElement, line: number, perp: number) => getCell(table, line, perp),
    coverAt: (table: HTMLElement, line: number, perp: number) => findSpanCover(table, line, perp),
    lineOf: (cover: SpanCover) => cover.row,
    spanAlong: (cover: SpanCover) => cover.spanY,
    growAnchor: (cover: SpanCover) => writeSpan(cover.anchor, cover.spanX, cover.spanY + 1),
    // A whole row is inserted contiguously before the first cell of the row
    // currently at the insertion index (or appended at the very end). Tolerant
    // linear indexing rather than getCell: a table may declare sizes before
    // its cells exist.
    referenceNodes: (
      table: HTMLElement,
      info: TableInfo,
      insertIndex: number,
    ): (HTMLElement | null)[] => {
      const cells = getTableCells(table);
      const ref = (cells[insertIndex * info.columnCount] as HTMLElement | undefined) ?? null;
      return new Array<HTMLElement | null>(info.columnCount).fill(ref);
    },
    insertEdges: (
      table: HTMLElement,
      insertIndex: number,
      source: number | null,
      info: TableInfo,
    ) => insertEdgesForNewRow(table, insertIndex, source, info.rowCount, info.columnCount),
    removeEdges: (table: HTMLElement, index: number, info: TableInfo) =>
      removeEdgesForRemovedRow(table, index, info.rowCount, info.columnCount),
    // Span along the removal axis (rows) and across it (columns).
    spanAlongOf: (cell: HTMLElement) => parseInt(cell.getAttribute("data-span-y") || "1") || 1,
    spanAcrossOf: (cell: HTMLElement) => parseInt(cell.getAttribute("data-span-x") || "1") || 1,
    lineOfPos: (pos: { row: number; column: number }) => pos.row,
    writeSpans: (cell: HTMLElement, along: number, across: number) =>
      writeSpan(cell, across, along),
  },
  column: {
    sizeAttr: "data-column-widths",
    defaultSize: () => defaultColumnWidth,
    sizes: (info: TableInfo) => info.columnWidths,
    lineCount: (info: TableInfo) => info.columnCount,
    perpCount: (info: TableInfo) => info.rowCount,
    cellAt: (table: HTMLElement, line: number, perp: number) => getCell(table, perp, line),
    coverAt: (table: HTMLElement, line: number, perp: number) => findSpanCover(table, perp, line),
    lineOf: (cover: SpanCover) => cover.column,
    spanAlong: (cover: SpanCover) => cover.spanX,
    growAnchor: (cover: SpanCover) => writeSpan(cover.anchor, cover.spanX + 1, cover.spanY),
    // Each row needs its own reference: mid-table it's that row's cell at the
    // insertion index; appending at the right edge it's the NEXT row's first
    // cell (null only for the last row — appending with a null reference for
    // every row would pile the whole new column after the last row and shift
    // every cell through the grid). Tolerant linear indexing rather than
    // getCell: a table may declare sizes before its cells exist.
    referenceNodes: (
      table: HTMLElement,
      info: TableInfo,
      insertIndex: number,
    ): (HTMLElement | null)[] => {
      const cells = getTableCells(table);
      const refs: (HTMLElement | null)[] = [];
      for (let r = 0; r < info.rowCount; r++) {
        const linear =
          insertIndex < info.columnCount
            ? r * info.columnCount + insertIndex
            : (r + 1) * info.columnCount;
        refs.push((cells[linear] as HTMLElement | undefined) ?? null);
      }
      return refs;
    },
    insertEdges: (
      table: HTMLElement,
      insertIndex: number,
      source: number | null,
      info: TableInfo,
    ) => insertEdgesForNewColumn(table, insertIndex, source, info.rowCount, info.columnCount),
    removeEdges: (table: HTMLElement, index: number, info: TableInfo) =>
      removeEdgesForRemovedColumn(table, index, info.rowCount, info.columnCount),
    spanAlongOf: (cell: HTMLElement) => parseInt(cell.getAttribute("data-span-x") || "1") || 1,
    spanAcrossOf: (cell: HTMLElement) => parseInt(cell.getAttribute("data-span-y") || "1") || 1,
    lineOfPos: (pos: { row: number; column: number }) => pos.column,
    writeSpans: (cell: HTMLElement, along: number, across: number) =>
      writeSpan(cell, along, across),
  },
} as const;

// The shared insertion core. Runs inside the caller's history entry.
function insertLineAt(
  table: HTMLElement,
  axis: LineAxis,
  insertIndex: number,
  sourceIndex: number | null,
  mode: NewCellsMode,
): void {
  const ops = lineAxisOps[axis];
  const info = getTableInfo(table);
  const lineCount = ops.lineCount(info);
  const perpCount = ops.perpCount(info);
  if (perpCount === 0) return;
  assert(
    insertIndex >= 0 && insertIndex <= lineCount,
    `${axis} index ${insertIndex} is out of bounds`,
  );
  assert(
    mode !== "clone" || sourceIndex === insertIndex - 1,
    "clone mode inserts the copy directly after its source line",
  );

  // Concise edge arrays can't be spliced boundary-by-boundary, so put them in
  // the unified form first.
  normalizeEdgeArrays(table, info.rowCount, info.columnCount);

  // Build the new cells, and find the merge covering each grid position on
  // the line just before the insertion boundary — all BEFORE mutating the
  // table (content resets happen on detached nodes, so no host events fire).
  const newCells: HTMLElement[] = [];
  const covers: (SpanCover | null)[] = [];
  const boundaryLine = insertIndex - 1;
  for (let p = 0; p < perpCount; p++) {
    if (mode === "clone") {
      newCells.push(cloneCellForDuplicate(ops.cellAt(table, sourceIndex!, p)));
    } else {
      const cell = createCell();
      if (mode === "skeleton" && sourceIndex != null) {
        applyCellSettings(cell, snapshotCellSettings(ops.cellAt(table, sourceIndex, p)));
      }
      newCells.push(cell);
    }
    covers.push(
      boundaryLine >= 0 && boundaryLine < lineCount ? ops.coverAt(table, boundaryLine, p) : null,
    );
  }
  const referenceNodes = ops.referenceNodes(table, info, insertIndex);

  // The new line inherits the source line's size.
  const sizes = ops.sizes(info);
  const sourceSize = sourceIndex != null ? sizes[sourceIndex] : undefined;
  sizes.splice(insertIndex, 0, sourceSize ?? ops.defaultSize());
  table.setAttribute(ops.sizeAttr, sizes.join(","));

  // Merge fix-up, before DOM insertion. A new cell never carries a span along
  // the insertion axis. Where a merge crosses the insertion boundary, the new
  // line is interior to it: the merge grows one line and the new cell becomes
  // a covered (skip) cell. A clone whose source was covered by a merge that
  // ENDS at the source line sits outside the merge and becomes an ordinary
  // cell. Merges perpendicular to the axis are self-contained in a cloned
  // line and copy over as-is. Clones covered by or freed from a merge get
  // fresh default contents — carrying the source's content into them would
  // duplicate it (hidden in the skip case, resurrected on a later unmerge).
  const grown = new Set<HTMLElement>();
  newCells.forEach((cell, p) => {
    const cover = covers[p];
    if (!cover) return;
    const lastCoveredLine = ops.lineOf(cover) + ops.spanAlong(cover) - 1;
    if (lastCoveredLine >= insertIndex) {
      cell.classList.add("bloom-skip");
      writeSpan(cell, 1, 1);
      if (mode === "clone") resetCloneContents(cell);
      if (!grown.has(cover.anchor)) {
        grown.add(cover.anchor);
        ops.growAnchor(cover);
      }
    } else if (mode === "clone" && sourceIndex != null && ops.lineOf(cover) < sourceIndex) {
      cell.classList.remove("bloom-skip");
      writeSpan(cell, 1, 1);
      resetCloneContents(cell);
    }
  });

  newCells.forEach((cell, p) => table.insertBefore(cell, referenceNodes[p]));
  // Edges and gaps are per-boundary, so they move for every insertion — a
  // blank line included, or the arrays end up describing the wrong boundaries.
  ops.insertEdges(table, insertIndex, sourceIndex, info);
  spliceGapForInsertedLine(table, axis, insertIndex, lineCount);
}

// The shared removal core. Runs inside the caller's history entry, and (unlike
// removeRowAt/removeColumnAt) does not itself refuse to remove the last line.
function removeLineAt(table: HTMLElement, axis: LineAxis, index: number): void {
  const ops = lineAxisOps[axis];
  const info = getTableInfo(table);
  const lineCount = ops.lineCount(info);
  const perpCount = ops.perpCount(info);
  assert(index >= 0 && index < lineCount, `${axis} index ${index} is out of bounds`);

  normalizeEdgeArrays(table, info.rowCount, info.columnCount);

  // A merge ANCHORED in the line being removed hands its coverage to the cell
  // on the next line: the anchor's data-span-* is the only record that the
  // covered cells are covered, so deleting it with the line would leave them
  // skipped (display:none) with nothing left that could ever unmerge them.
  for (let p = 0; p < perpCount; p++) {
    const cell = ops.cellAt(table, index, p);
    if (cell.classList.contains("bloom-skip")) continue;
    const along = ops.spanAlongOf(cell);
    // A span reaching past the end of the table is already broken data; there
    // is no cell to hand the coverage to, so just let it go with the line.
    if (along <= 1 || index + 1 >= lineCount) continue;
    const across = ops.spanAcrossOf(cell);
    const heir = ops.cellAt(table, index + 1, p);
    heir.classList.remove("bloom-skip");
    ops.writeSpans(heir, along - 1, across);
  }

  // A merge that merely CROSSES the removed line shrinks by one.
  for (const cell of getTableCells(table)) {
    const line = ops.lineOfPos(getRowAndColumn(table, cell));
    const along = ops.spanAlongOf(cell);
    if (line < index && line + along > index) {
      ops.writeSpans(cell, along - 1, ops.spanAcrossOf(cell));
    }
  }

  // Collect the cells to remove BEFORE the size attributes change (positions
  // are derived from the declared column count).
  const cellsToRemove: HTMLElement[] = [];
  for (let p = 0; p < perpCount; p++) cellsToRemove.push(ops.cellAt(table, index, p));

  const sizes = ops.sizes(info);
  sizes.splice(index, 1);
  table.setAttribute(ops.sizeAttr, sizes.join(","));

  ops.removeEdges(table, index, info);
  spliceGapForRemovedLine(table, axis, index, lineCount);

  cellsToRemove.forEach((cell) => table.removeChild(cell));
}

/**
 * Duplicates the row at `sourceRow`, inserting the copy directly below it.
 * Unlike addRowAt (whose new cells inherit only settings), this copies
 * everything: contents, content types, spans, and borders. A vertical span
 * that continues below the source row grows one row taller (the copy's cell
 * is covered by it); a vertical span that ENDS at the source row leaves an
 * ordinary unmerged cell in the copy.
 */
export const duplicateRowAt = (table: HTMLElement, sourceRow: number, skipHistory = false): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);
  assert(
    sourceRow >= 0 && sourceRow < tableInfo.rowCount,
    `Row index ${sourceRow} is out of bounds`,
  );
  const description = `Duplicate Row ${sourceRow}`;
  const performOperation = () => insertLineAt(table, "row", sourceRow + 1, sourceRow, "clone");

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Duplicates the column at `sourceColumn`, inserting the copy directly to its
 * right. Copies everything: contents, content types, spans, and borders.
 * A horizontal span that continues right of the source column grows one column
 * wider (the copy's cell is covered by it); a horizontal span that ENDS at the
 * source column leaves an ordinary unmerged cell in the copy.
 */
export const duplicateColumnAt = (
  table: HTMLElement,
  sourceColumn: number,
  skipHistory = false,
): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);
  assert(
    sourceColumn >= 0 && sourceColumn < tableInfo.columnCount,
    `Column index ${sourceColumn} is out of bounds`,
  );
  const description = `Duplicate Column ${sourceColumn}`;
  const performOperation = () =>
    insertLineAt(table, "column", sourceColumn + 1, sourceColumn, "clone");

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Removes a column at the specified index position, adjusting spans, edges and
 * gaps as needed.
 * @param table The table container element
 * @param index The column index to remove (0-based)
 */
export const removeColumnAt = (table: HTMLElement, index: number, skipHistory = false): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);

  assert(tableInfo.columnCount > 1, "Cannot remove the only column");
  assert(index >= 0 && index < tableInfo.columnCount, `Column index ${index} is out of bounds`);
  const description = `Remove Column at ${index}`;
  const performOperation = () => removeLineAt(table, "column", index);

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Removes a row at the specified index position, adjusting spans, edges and
 * gaps as needed.
 * @param table The table container element
 * @param index The row index to remove (0-based)
 */
export const removeRowAt = (table: HTMLElement, index: number, skipHistory = false): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);

  assert(tableInfo.rowCount > 1, "Cannot remove the only row");
  assert(index >= 0 && index < tableInfo.rowCount, `Row index ${index} is out of bounds`);
  const description = `Remove Row at ${index}`;
  const performOperation = () => removeLineAt(table, "row", index);

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Moves the row at `from` to position `to`, carrying its cells, height, and
 * borders. Borders model: each row "owns" its top horizontal boundary; the
 * table's final bottom boundary stays fixed. Vertical edges (per-row) travel
 * with the row. Spans that straddle the moved boundary are not specially
 * handled (best-effort for simple grids).
 * @param table The table container element
 * @param from Source row index (0-based)
 * @param to Destination row index (0-based)
 */
export const moveRowAt = (table: HTMLElement, from: number, to: number, skipHistory = false): void => {
  if (!table) return;
  const info = getTableInfo(table);
  const R = info.rowCount;
  const C = info.columnCount;
  if (from === to) return;
  assert(from >= 0 && from < R, `Row index ${from} is out of bounds`);
  assert(to >= 0 && to < R, `Row index ${to} is out of bounds`);

  const description = `Move Row ${from} to ${to}`;
  const performOperation = () => {
    normalizeEdgeArrays(table, R, C);
    reorderGapForMovedLine(table, "row", from, to, R);
    // Row heights
    const heights = (table.getAttribute("data-row-heights") || "").split(",");
    const [movedHeight] = heights.splice(from, 1);
    heights.splice(to, 0, movedHeight);
    table.setAttribute("data-row-heights", heights.join(","));

    // DOM cells: a full R*C grid in DOM order; reorder whole row blocks.
    const cells = getTableCells(table);
    const grid: HTMLElement[][] = [];
    for (let r = 0; r < R; r++) grid.push(cells.slice(r * C, (r + 1) * C));
    const [movedRowCells] = grid.splice(from, 1);
    grid.splice(to, 0, movedRowCells);
    grid.flat().forEach((cell) => table.appendChild(cell));

    // Vertical edges (R x C+1): travel with their row.
    const v = getEdgesV(table);
    if (v && v.length === R) {
      const [mv] = v.splice(from, 1);
      v.splice(to, 0, mv);
      setEdgesV(table, v);
    }
    // Horizontal edges (R+1 x C): move the row-top boundaries, keep table bottom fixed.
    const h = getEdgesH(table);
    if (h && h.length === R + 1) {
      const tops = h.slice(0, R);
      const bottom = h[R];
      const [mt] = tops.splice(from, 1);
      tops.splice(to, 0, mt);
      setEdgesH(table, [...tops, bottom]);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Moves the column at `from` to position `to`, carrying its cells, width, and
 * borders. Borders model: each column "owns" its left vertical boundary; the
 * table's final right boundary stays fixed. Horizontal edges (per-column)
 * travel with the column.
 * @param table The table container element
 * @param from Source column index (0-based)
 * @param to Destination column index (0-based)
 */
export const moveColumnAt = (table: HTMLElement, from: number, to: number, skipHistory = false): void => {
  if (!table) return;
  const info = getTableInfo(table);
  const R = info.rowCount;
  const C = info.columnCount;
  if (from === to) return;
  assert(from >= 0 && from < C, `Column index ${from} is out of bounds`);
  assert(to >= 0 && to < C, `Column index ${to} is out of bounds`);

  const description = `Move Column ${from} to ${to}`;
  const performOperation = () => {
    normalizeEdgeArrays(table, R, C);
    reorderGapForMovedLine(table, "column", from, to, C);
    // Column widths
    const widths = (table.getAttribute("data-column-widths") || "").split(",");
    const [movedWidth] = widths.splice(from, 1);
    widths.splice(to, 0, movedWidth);
    table.setAttribute("data-column-widths", widths.join(","));

    // DOM cells: reorder the cell at `from` to `to` within each row.
    const cells = getTableCells(table);
    const grid: HTMLElement[][] = [];
    for (let r = 0; r < R; r++) {
      const rowCells = cells.slice(r * C, (r + 1) * C);
      const [mc] = rowCells.splice(from, 1);
      rowCells.splice(to, 0, mc);
      grid.push(rowCells);
    }
    grid.flat().forEach((cell) => table.appendChild(cell));

    // Horizontal edges (R+1 x C): travel with their column.
    const h = getEdgesH(table);
    if (h && h.length === R + 1 && h.every((row) => Array.isArray(row) && row.length === C)) {
      for (const row of h) {
        const [m] = row.splice(from, 1);
        row.splice(to, 0, m);
      }
      setEdgesH(table, h);
    }
    // Vertical edges (R x C+1): move the column-left boundaries, keep table right fixed.
    const v = getEdgesV(table);
    if (v && v.length === R && v.every((row) => Array.isArray(row) && row.length === C + 1)) {
      const next = v.map((row) => {
        const lefts = row.slice(0, C);
        const right = row[C];
        const [m] = lefts.splice(from, 1);
        lefts.splice(to, 0, m);
        return [...lefts, right];
      });
      setEdgesV(table, next as typeof v);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

export function getRowIndex(cell: HTMLElement) {
  const table = cell.closest<HTMLElement>(".bloom-table");
  assert(!!table, "Cell must be inside a table element");

  const { row } = getRowAndColumn(table, cell);
  return row;
}

export function setColumnWidth(
  table: HTMLElement,
  columnIndex: number,
  width: string, // 35px, hug, fill
): void {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
  const tableInfo = getTableInfo(table);
  assert(
    columnIndex >= 0 && columnIndex < tableInfo.columnCount,
    `Column index ${columnIndex} is out of bounds`,
  );

  const currentWidths = table.getAttribute("data-column-widths") || "";
  const widthArray = currentWidths.split(",");
  if (columnIndex >= 0 && columnIndex < widthArray.length) {
    widthArray[columnIndex] = width;
    table.setAttribute("data-column-widths", widthArray.join(","));
  }
}
export function getColumnWidth(table: HTMLElement, columnIndex: number): string | null {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
  const tableInfo = getTableInfo(table);
  assert(
    columnIndex >= 0 && columnIndex < tableInfo.columnCount,
    `Column index ${columnIndex} is out of bounds`,
  );

  const currentWidths = table.getAttribute("data-column-widths") || "";
  const widthArray = currentWidths.split(",");
  return widthArray[columnIndex] || null;
}

/** Gets the raw height spec for a given row (e.g., "hug", "fill", or "42px"). */
export function getRowHeight(table: HTMLElement, rowIndex: number): string | null {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
  const tableInfo = getTableInfo(table);
  assert(rowIndex >= 0 && rowIndex < tableInfo.rowCount, `Row index ${rowIndex} is out of bounds`);
  const currentHeights = table.getAttribute("data-row-heights") || "";
  const heightArray = currentHeights.split(",");
  return heightArray[rowIndex] || null;
}

/** Sets the height for a given row to a spec (e.g., "hug", "fill", or "42px"). */
export function setRowHeight(table: HTMLElement, rowIndex: number, height: string): void {
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
  const tableInfo = getTableInfo(table);
  assert(rowIndex >= 0 && rowIndex < tableInfo.rowCount, `Row index ${rowIndex} is out of bounds`);
  const currentHeights = table.getAttribute("data-row-heights") || "";
  const heightArray = currentHeights ? currentHeights.split(",") : [];

  // Ensure array is sized to number of rows
  if (heightArray.length < tableInfo.rowCount) {
    heightArray.length = tableInfo.rowCount;
  }
  // Fill any empty slots with 'hug'
  for (let i = 0; i < heightArray.length; i++) {
    if (!heightArray[i]) heightArray[i] = "hug";
  }
  if (rowIndex >= 0 && rowIndex < heightArray.length) {
    heightArray[rowIndex] = height;
    table.setAttribute("data-row-heights", heightArray.join(","));
  }
}
