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
import { setupContentsOfCell } from "./cell-contents";
import { getEdgesH, setEdgesH, getEdgesV, setEdgesV } from "./table-model";

/**
 * Per-cell appearance settings that a newly inserted row/column should inherit
 * from the selected (source) row/column. These are the formatting attributes
 * (fill, alignment, padding, corners) — NOT span (which is positional) or
 * content-type/content (a new cell starts empty). Borders are handled
 * separately via the edge arrays.
 */
const CELL_SETTING_ATTRS = ["data-bg", "data-align", "data-pad", "data-corners"] as const;

type CellSettings = Partial<Record<(typeof CELL_SETTING_ATTRS)[number], string | null>>;

function snapshotCellSettings(cell: HTMLElement): CellSettings {
  const snap: CellSettings = {};
  for (const attr of CELL_SETTING_ATTRS) snap[attr] = cell.getAttribute(attr);
  return snap;
}

function applyCellSettings(cell: HTMLElement, snap: CellSettings): void {
  for (const attr of CELL_SETTING_ATTRS) {
    const v = snap[attr];
    if (v != null) cell.setAttribute(attr, v);
    else cell.removeAttribute(attr);
  }
}

// Clamp a caller-supplied source index to a valid row/column, or null when no
// source was given (or the table is empty) — in which case nothing is copied.
function resolveSourceIndex(sourceIndex: number | undefined, count: number): number | null {
  if (sourceIndex == null || count <= 0) return null;
  return Math.max(0, Math.min(sourceIndex, count - 1));
}

// Snapshot each cell's settings across a source row (one entry per column).
function captureRowCellSettings(
  table: HTMLElement,
  sourceRow: number,
  numColumns: number,
): CellSettings[] {
  const settings: CellSettings[] = [];
  for (let c = 0; c < numColumns; c++) {
    settings.push(snapshotCellSettings(getCell(table, sourceRow, c)));
  }
  return settings;
}

// Snapshot each cell's settings down a source column (one entry per row).
function captureColumnCellSettings(
  table: HTMLElement,
  sourceColumn: number,
  numRows: number,
): CellSettings[] {
  const settings: CellSettings[] = [];
  for (let r = 0; r < numRows; r++) {
    settings.push(snapshotCellSettings(getCell(table, r, sourceColumn)));
  }
  return settings;
}

// Deep-clone an edge entry (BorderSpec, sided object, or null) so the inserted
// row/column gets independent copies of the source's border specs.
function cloneEdge<T>(entry: T | undefined): T | Record<string, never> {
  if (entry === undefined) return {};
  if (entry === null) return null as unknown as T;
  return JSON.parse(JSON.stringify(entry)) as T;
}

/**
 * When a row is inserted, splice the table's edge arrays so existing borders
 * stay aligned and the new row inherits the source row's borders.
 *  - V edges (rows x cols+1): the new row copies the source row's vertical lines.
 *  - H edges (rows+1 x cols): a new horizontal boundary is inserted at the
 *    insertion index, copied from the boundary it splits (which is the source
 *    row's adjacent top/bottom line), preserving neighbouring rows' borders.
 * Only runs when the arrays exist and are full-sized for the current dimensions.
 */
function copyEdgesForInsertedRow(
  table: HTMLElement,
  insertIndex: number,
  sourceRow: number,
  rows: number,
  cols: number,
): void {
  const v = getEdgesV(table);
  if (v && v.length === rows && v.every((r) => Array.isArray(r) && r.length === cols + 1)) {
    const srcRow = v[sourceRow] ? v[sourceRow].map((e) => cloneEdge(e)) : new Array(cols + 1).fill({});
    v.splice(insertIndex, 0, srcRow as (typeof v)[number]);
    setEdgesV(table, v);
  }

  const h = getEdgesH(table);
  if (h && h.length === rows + 1 && h.every((r) => Array.isArray(r) && r.length === cols)) {
    const base = h[insertIndex] ? h[insertIndex].map((e) => cloneEdge(e)) : new Array(cols).fill({});
    h.splice(insertIndex, 0, base as (typeof h)[number]);
    setEdgesH(table, h);
  }
}

/**
 * Column counterpart of copyEdgesForInsertedRow.
 *  - H edges (rows+1 x cols): the new column copies the source column's
 *    horizontal lines (top/bottom of its cells) at each boundary row.
 *  - V edges (rows x cols+1): a new vertical boundary is inserted at the
 *    insertion index, copied from the boundary it splits, preserving neighbours.
 */
function copyEdgesForInsertedColumn(
  table: HTMLElement,
  insertIndex: number,
  sourceColumn: number,
  rows: number,
  cols: number,
): void {
  const h = getEdgesH(table);
  if (h && h.length === rows + 1 && h.every((r) => Array.isArray(r) && r.length === cols)) {
    for (let b = 0; b <= rows; b++) {
      h[b].splice(insertIndex, 0, cloneEdge(h[b][sourceColumn]) as (typeof h)[number][number]);
    }
    setEdgesH(table, h);
  }

  const v = getEdgesV(table);
  if (v && v.length === rows && v.every((r) => Array.isArray(r) && r.length === cols + 1)) {
    for (let r = 0; r < rows; r++) {
      v[r].splice(insertIndex, 0, cloneEdge(v[r][insertIndex]) as (typeof v)[number][number]);
    }
    setEdgesV(table, v);
  }
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

export const defaultColumnWidth = "hug";
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
  //assert(table instanceof HTMLElement, "table parameter must be an HTMLElement");
  assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");

  const description = "Add Row";
  const performOperation = () => {
    const columnWidthsAttr = table.getAttribute("data-column-widths");
    const numColumns = columnWidthsAttr ? columnWidthsAttr.split(",").length : 1;

    assert(numColumns > 0, "Table must have at least one column");

    const rowHeights = (table.getAttribute("data-row-heights") || "")
      .split(",")
      .filter((h) => h.trim() !== "");
    const numRows = rowHeights.length;

    // Capture the selected (source) row's settings before mutating the table.
    const src = resolveSourceIndex(sourceIndex, numRows);
    const sourceCellSettings =
      src != null ? captureRowCellSettings(table, src, numColumns) : null;
    const newHeight = src != null ? rowHeights[src] : defaultRowHeight;

    const newRowHeights = numRows > 0 ? `${rowHeights.join(",")},${newHeight}` : newHeight;
    table.setAttribute("data-row-heights", newRowHeights);

    const newCells: HTMLElement[] = [];
    for (let i = 0; i < numColumns; i++) {
      const newCell = createCell();
      table.appendChild(newCell);
      newCells.push(newCell);
    }

    if (src != null && sourceCellSettings) {
      newCells.forEach((cell, c) => applyCellSettings(cell, sourceCellSettings[c]));
      copyEdgesForInsertedRow(table, numRows, src, numRows, numColumns);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

export const removeLastRow = (table: HTMLElement): void => {
  if (!table) return;

  const rowHeightsAttr = table.getAttribute("data-row-heights");
  if (!rowHeightsAttr || rowHeightsAttr.split(",").length === 0) {
    console.info("No rows to remove from the target table.");
    return;
  }

  const description = "Remove Last Row";
  const performOperation = () => {
    const columnWidthsAttr = table.getAttribute("data-column-widths") || "";
    const numColumns = columnWidthsAttr.split(",").length || 1;

    const rowHeights = (table.getAttribute("data-row-heights") || "").split(",");
    if (rowHeights.length === 0) return;
    rowHeights.pop();
    table.setAttribute("data-row-heights", rowHeights.join(","));
    const cells = getTableCells(table);
    const cellsToRemove = cells.slice(-numColumns);
    cellsToRemove.forEach((cell) => table.removeChild(cell));
  };

  tableHistoryManager.addHistoryEntry(table, description, performOperation);
};

export const addColumn = (table: HTMLElement, skipHistory = false, sourceIndex?: number): void => {
  if (!table) return;

  const description = "Add Column";
  const performOperation = () => {
    const columnWidths = (table.getAttribute("data-column-widths") || "")
      .split(",")
      .filter((w) => w.trim() !== "");
    const numColumns = columnWidths.length;

    const rowHeightsAttr = table.getAttribute("data-row-heights") || "";
    const numRows = rowHeightsAttr ? rowHeightsAttr.split(",").length : 0;

    // Capture the selected (source) column's settings before mutating the table.
    const src = numRows > 0 ? resolveSourceIndex(sourceIndex, numColumns) : null;
    const sourceCellSettings =
      src != null ? captureColumnCellSettings(table, src, numRows) : null;
    const newWidth = src != null ? columnWidths[src] : defaultColumnWidth;

    const newColumnWidths = numColumns > 0 ? `${columnWidths.join(",")},${newWidth}` : newWidth;
    table.setAttribute("data-column-widths", newColumnWidths);

    if (numRows === 0) return;
    const cells = getTableCells(table);
    const newCells: HTMLElement[] = [];
    for (let i = 0; i < numRows; i++) {
      const newCell = createCell();

      // Calculate the position where the new cell should be inserted
      // For each row, we want to insert after the last cell of that row
      const insertPosition = i * numColumns + numColumns;
      const referenceNode = cells[insertPosition] || null;
      table.insertBefore(newCell, referenceNode);
      newCells.push(newCell);
    }

    if (src != null && sourceCellSettings) {
      newCells.forEach((cell, r) => applyCellSettings(cell, sourceCellSettings[r]));
      copyEdgesForInsertedColumn(table, numColumns, src, numRows, numColumns);
    }
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
  const columnWidthsAttr = table.getAttribute("data-column-widths");
  if (!columnWidthsAttr) return;

  const columnWidths = columnWidthsAttr.split(",");
  if (columnWidths.length <= 1) {
    console.info("Cannot remove the last column.");
    return;
  }

  const description = "Remove Last Column";
  const performOperation = () => {
    const numColumns = columnWidths.length;
    columnWidths.pop();
    table.setAttribute("data-column-widths", columnWidths.join(","));

    const rowHeightsAttr = table.getAttribute("data-row-heights") || "";
    const numRows = rowHeightsAttr ? rowHeightsAttr.split(",").length : 0;
    if (numRows === 0) return;
    const cells = getTableCells(table);

    // Remove the last cell from each row
    for (let i = numRows - 1; i >= 0; i--) {
      const cellIndexToRemove = i * numColumns + numColumns - 1;
      if (cellIndexToRemove < cells.length) {
        table.removeChild(cells[cellIndexToRemove]);
      }
    }
  };

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

  const currentSpanX = parseInt(cell.style.getPropertyValue("--span-x")) || 1;
  const currentSpanY = parseInt(cell.style.getPropertyValue("--span-y")) || 1;

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
    const numRows = tableInfo.rowCount;
    if (numRows === 0) return;

    // Capture the selected (source) column's settings before mutating the table.
    const src = resolveSourceIndex(sourceIndex, tableInfo.columnCount);
    const sourceCellSettings =
      src != null ? captureColumnCellSettings(table, src, numRows) : null;

    // Collect reference nodes BEFORE changing the table structure
    const referenceNodes: (HTMLElement | null)[] = [];
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      // Find reference node for insertion. If adding at the end, it's null.
      // Otherwise, it's the cell at the insertion index for the current row.
      const referenceNode =
        actualIndex < tableInfo.columnCount ? getCell(table, rowIndex, actualIndex) : null;
      referenceNodes.push(referenceNode);
    }

    // Now update the table structure
    const currentColumnWidths = table.getAttribute("data-column-widths") || "";
    const columnWidths = currentColumnWidths ? currentColumnWidths.split(",") : [];

    // Insert new column width at the specified index (inherit the source column's width)
    const newWidth = src != null ? columnWidths[src] ?? defaultColumnWidth : defaultColumnWidth;
    columnWidths.splice(actualIndex, 0, newWidth);
    table.setAttribute("data-column-widths", columnWidths.join(",")); // Insert new cells at the appropriate positions
    const newCells: HTMLElement[] = [];
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      const newCell = createCell();

      table.insertBefore(newCell, referenceNodes[rowIndex]);
      newCells.push(newCell);
    }

    if (src != null && sourceCellSettings) {
      newCells.forEach((cell, r) => applyCellSettings(cell, sourceCellSettings[r]));
      copyEdgesForInsertedColumn(table, actualIndex, src, numRows, tableInfo.columnCount);
    }
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
    const numColumns = tableInfo.columnCount;
    if (numColumns === 0) return;

    // Capture the selected (source) row's settings before mutating the table.
    const src = resolveSourceIndex(sourceIndex, tableInfo.rowCount);
    const sourceCellSettings =
      src != null ? captureRowCellSettings(table, src, numColumns) : null;

    // Find the reference node for insertion BEFORE changing the table structure
    // If adding at the end, referenceNode is null.
    // Otherwise, it's the first cell of the row at the insertion index.
    const referenceNode = actualIndex < tableInfo.rowCount ? getCell(table, actualIndex, 0) : null;

    // Now update the table structure
    const currentRowHeights = table.getAttribute("data-row-heights") || "";
    const rowHeights = currentRowHeights ? currentRowHeights.split(",") : [];

    // Insert new row height at the specified index (inherit the source row's height)
    const newHeight = src != null ? rowHeights[src] ?? defaultRowHeight : defaultRowHeight;
    rowHeights.splice(actualIndex, 0, newHeight);
    table.setAttribute("data-row-heights", rowHeights.join(",")); // Insert new cells for the entire row
    const newCells: HTMLElement[] = [];
    for (let colIndex = 0; colIndex < numColumns; colIndex++) {
      const newCell = createCell();
      table.insertBefore(newCell, referenceNode);
      newCells.push(newCell);
    }

    if (src != null && sourceCellSettings) {
      newCells.forEach((cell, c) => applyCellSettings(cell, sourceCellSettings[c]));
      copyEdgesForInsertedRow(table, actualIndex, src, tableInfo.rowCount, numColumns);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Removes a column at the specified index position, adjusting spans as needed.
 * @param table The table container element
 * @param index The column index to remove (0-based)
 */
export const removeColumnAt = (table: HTMLElement, index: number, skipHistory = false): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);

  assert(tableInfo.columnCount > 1, "Cannot remove the only column");
  assert(index >= 0 && index < tableInfo.columnCount, `Column index ${index} is out of bounds`);
  const description = `Remove Column at ${index}`;
  const performOperation = () => {
    // Collect cells to remove BEFORE changing the table structure
    const cellsToRemove: HTMLElement[] = [];
    for (let rowIndex = 0; rowIndex < tableInfo.rowCount; rowIndex++) {
      cellsToRemove.push(getCell(table, rowIndex, index));
    } // First adjust spans of cells that were affected by the removal
    const cells = getTableCells(table);
    cells.forEach((cell) => {
      const htmlCell = cell as HTMLElement;
      const { column: cellColumn } = getRowAndColumn(table, htmlCell);
      const spanX = parseInt(htmlCell.getAttribute("data-span-x") || "1") || 1;

      // If this cell's span extended beyond the column to be removed, reduce its span
      if (cellColumn < index && cellColumn + spanX > index) {
        const newSpanX = spanX - 1;
        htmlCell.setAttribute("data-span-x", String(newSpanX));
        if (newSpanX > 1) htmlCell.style.setProperty("--span-x", String(newSpanX));
        else htmlCell.style.removeProperty("--span-x");
      }
    });

    // Update column widths attribute
    const currentColumnWidths = table.getAttribute("data-column-widths") || "";
    const columnWidths = currentColumnWidths ? currentColumnWidths.split(",") : [];
    columnWidths.splice(index, 1);
    table.setAttribute("data-column-widths", columnWidths.join(","));

    // Remove the collected cells
    cellsToRemove.forEach((cell) => table.removeChild(cell));
  };

  if (skipHistory) {
    performOperation();
  } else {
    tableHistoryManager.addHistoryEntry(table, description, performOperation);
  }
};

/**
 * Removes a row at the specified index position, adjusting spans as needed.
 * @param table The table container element
 * @param index The row index to remove (0-based)
 */
export const removeRowAt = (table: HTMLElement, index: number, skipHistory = false): void => {
  if (!table) return;

  const tableInfo = getTableInfo(table);

  assert(tableInfo.rowCount > 1, "Cannot remove the only row");
  assert(index >= 0 && index < tableInfo.rowCount, `Row index ${index} is out of bounds`);
  const description = `Remove Row at ${index}`;
  const performOperation = () => {
    // Collect cells to remove BEFORE changing the table structure
    const cellsToRemove: HTMLElement[] = [];
    for (let columnIndex = 0; columnIndex < tableInfo.columnCount; columnIndex++) {
      cellsToRemove.push(getCell(table, index, columnIndex));
    } // First adjust spans of cells that were affected by the removal
    const cells = getTableCells(table);
    cells.forEach((cell) => {
      const htmlCell = cell as HTMLElement;
      const { row: cellRow } = getRowAndColumn(table, htmlCell);
      const spanY = parseInt(htmlCell.getAttribute("data-span-y") || "1") || 1;

      // If this cell's span extended beyond the removed row, reduce its span
      if (cellRow < index && cellRow + spanY > index) {
        const newSpanY = spanY - 1;
        htmlCell.setAttribute("data-span-y", String(newSpanY));
        if (newSpanY > 1) htmlCell.style.setProperty("--span-y", String(newSpanY));
        else htmlCell.style.removeProperty("--span-y");
      }
    });

    // Update row heights attribute
    const currentRowHeights = table.getAttribute("data-row-heights") || "";
    const rowHeights = currentRowHeights ? currentRowHeights.split(",") : [];
    rowHeights.splice(index, 1);
    table.setAttribute("data-row-heights", rowHeights.join(","));

    // Remove the collected cells
    cellsToRemove.forEach((cell) => table.removeChild(cell));
  };

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
