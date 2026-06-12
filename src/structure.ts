/**
 * Grid Operations Module
 *
 * This module provides functions for manipulating table-like grids represented as HTML elements.
 *
 * ## Grid Representation
 *
 * Grids are represented using this HTML structure:
 *
 * ### HTML Structure:
 * ```html
 * <div class="grid" data-column-widths="100px,fit" data-row-heights="50px,60px">
 *   <div class="cell">Cell 0,0</div>
 *   <div class="cell">Cell 0,1</div>
 *   <div class="cell">Cell 1,0</div>
 *   <div class="cell">Cell 1,1</div>
 * </div>
 * ```
 *
 * ### Key Components:
 *
 * 1. **Grid Container**: A div with class "grid"
 *    - `data-column-widths`: Comma-separated list of column widths (e.g., "100px,200px,fit")
 *    - `data-row-heights`: Comma-separated list of row heights (e.g., "50px,60px,fit")
 *
 * 2. **Cell Elements**: Direct children divs with class "cell"
 *    - Ordered left-to-right, top-to-bottom in the DOM
 *    - Spans configured via data attributes on each cell:
 *      - `data-span-x`: Number of columns to span (default: 1)
 *      - `data-span-y`: Number of rows to span (default: 1)
 *
 * 3. **Borders (edge-based model)**: Borders are defined on the grid as arrays, not per-cell attributes.
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
 * - Example: cell[0,0] spanning 2x2 in a 2x2 grid causes cell[0,1], cell[1,0], and cell[1,1] to be marked as skipped.
 *
 * ### Size Values:
 * - "hug": CSS Grid minmax(max-content,max-content) - size to content
 * - "fill": CSS Grid minmax(0,1fr) - expand to fill available space
 * - Standard CSS units: "100px", "2rem", "50%", etc.
 *
 * # Warning:
 * Be careful with querySelectorAll with advanced selectors like ":scope > .cell". because the unit tests
 * use happy-dom, which do not support this selector properly. There may be other selectors that also do not work.
 */

import { gridHistoryManager } from "./history";
import { setupContentsOfCell } from "./cell-contents";

/**
 * Runtime assertion function that throws an error if the condition is false.
 * Used throughout grid operations to validate parameters and state.
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
 * Gets all cell elements from a grid, including those marked as "skip".
 * This is the canonical way to get cells from a grid that handles the grid structure properly.
 *
 * @param grid The grid container element
 * @returns Array of all cell elements in DOM order
 */
export function getGridCells(grid: HTMLElement): HTMLElement[] {
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");

  const cells: HTMLElement[] = [];
  Array.from(grid.children).forEach((element) => {
    if (element.classList.contains("cell")) {
      cells.push(element as HTMLElement);
    } else {
      console.debug(`Element ${element.tagName} is not a cell, skipping.`);
    }
  });

  // in both js-dom and happy-dom v15, the querySelectorAll gives "0" when "":scope > selector" is used
  // const cellsViaSelector = Array.from(
  //   grid.querySelectorAll<HTMLElement>(":scope > .cell")
  // );
  // if (cellsViaSelector.length !== cells.length) {
  //   console.warn(
  //     `getGridCells: Mismatch in cell count. DOM children: ${cells.length}, querySelectorAll: ${cellsViaSelector.length}`
  //   );
  // }
  return cells;
}

/**
 * Creates a new cell element with proper class and default contents.
 * Uses the cell-contents module to set up the default content type.
 *
 * @returns A new HTMLElement configured as a grid cell
 */
function createCell(): HTMLElement {
  const newCell = document.createElement("div");
  newCell.className = "cell";

  // Use cell-contents.ts to set up the default contents
  setupContentsOfCell(newCell);

  return newCell;
}

export const defaultColumnWidth = "hug";
export const defaultRowHeight = "hug";

export const getTargetGrid = (): HTMLElement | null => {
  // Start from the currently focused element
  let currentElement = document.activeElement as HTMLElement | null;

  if (!currentElement) {
    console.warn("No active element found. Cannot determine target grid.");
    return null;
  }

  return currentElement.closest<HTMLElement>(".grid") || null;
};

export const addRow = (grid: HTMLElement, skipHistory = false): void => {
  //assert(grid instanceof HTMLElement, "grid parameter must be an HTMLElement");
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");

  const description = "Add Row";
  const performOperation = () => {
    const columnWidthsAttr = grid.getAttribute("data-column-widths");
    const numColumns = columnWidthsAttr ? columnWidthsAttr.split(",").length : 1;

    assert(numColumns > 0, "Grid must have at least one column");

    const currentRowHeights = grid.getAttribute("data-row-heights") || "";
    const newRowHeights = currentRowHeights
      ? `${currentRowHeights},${defaultRowHeight}`
      : defaultRowHeight;
    grid.setAttribute("data-row-heights", newRowHeights);
    for (let i = 0; i < numColumns; i++) {
      const newCell = createCell();
      grid.appendChild(newCell);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    gridHistoryManager.addHistoryEntry(grid, description, performOperation);
  }
};

export const removeLastRow = (grid: HTMLElement): void => {
  if (!grid) return;

  const rowHeightsAttr = grid.getAttribute("data-row-heights");
  if (!rowHeightsAttr || rowHeightsAttr.split(",").length === 0) {
    console.info("No rows to remove from the target grid.");
    return;
  }

  const description = "Remove Last Row";
  const performOperation = () => {
    const columnWidthsAttr = grid.getAttribute("data-column-widths") || "";
    const numColumns = columnWidthsAttr.split(",").length || 1;

    const rowHeights = (grid.getAttribute("data-row-heights") || "").split(",");
    if (rowHeights.length === 0) return;
    rowHeights.pop();
    grid.setAttribute("data-row-heights", rowHeights.join(","));
    const cells = getGridCells(grid);
    const cellsToRemove = cells.slice(-numColumns);
    cellsToRemove.forEach((cell) => grid.removeChild(cell));
  };

  gridHistoryManager.addHistoryEntry(grid, description, performOperation);
};

export const addColumn = (grid: HTMLElement, skipHistory = false): void => {
  if (!grid) return;

  const description = "Add Column";
  const performOperation = () => {
    const currentColumnWidths = grid.getAttribute("data-column-widths") || "";
    const numColumns = currentColumnWidths ? currentColumnWidths.split(",").length : 0;
    const newColumnWidths = currentColumnWidths
      ? `${currentColumnWidths},${defaultColumnWidth}`
      : defaultColumnWidth;
    grid.setAttribute("data-column-widths", newColumnWidths);

    const rowHeightsAttr = grid.getAttribute("data-row-heights") || "";
    const numRows = rowHeightsAttr ? rowHeightsAttr.split(",").length : 0;
    if (numRows === 0) return;
    const cells = getGridCells(grid);
    for (let i = 0; i < numRows; i++) {
      const newCell = createCell();

      // Calculate the position where the new cell should be inserted
      // For each row, we want to insert after the last cell of that row
      const insertPosition = i * numColumns + numColumns;
      const referenceNode = cells[insertPosition] || null;
      grid.insertBefore(newCell, referenceNode);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    gridHistoryManager.addHistoryEntry(grid, description, performOperation);
  }
};

export const undoLastOperation = (grid: HTMLElement): boolean => {
  if (!grid) return false;

  return gridHistoryManager.undo(grid);
};

export const canUndo = (): boolean => {
  return gridHistoryManager.canUndo();
};

export const getLastOperation = (): string | null => {
  return gridHistoryManager.getLastOperationLabel();
};

export function removeLastColumn(grid: HTMLElement) {
  if (!grid) return;
  const columnWidthsAttr = grid.getAttribute("data-column-widths");
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
    grid.setAttribute("data-column-widths", columnWidths.join(","));

    const rowHeightsAttr = grid.getAttribute("data-row-heights") || "";
    const numRows = rowHeightsAttr ? rowHeightsAttr.split(",").length : 0;
    if (numRows === 0) return;
    const cells = getGridCells(grid);

    // Remove the last cell from each row
    for (let i = numRows - 1; i >= 0; i--) {
      const cellIndexToRemove = i * numColumns + numColumns - 1;
      if (cellIndexToRemove < cells.length) {
        grid.removeChild(cells[cellIndexToRemove]);
      }
    }
  };

  gridHistoryManager.addHistoryEntry(grid, description, performOperation);
}

/**
 * Extracts grid information from a grid element's data attributes and current state.
 * This is a key utility function used throughout the codebase for grid operations.
 *
 * The grid stores its structure in data attributes:
 * - data-column-widths: comma-separated list of column widths
 * - data-row-heights: comma-separated list of row heights
 *
 * The actual cell count is determined by counting DOM elements with class "cell".
 *
 * @param grid The grid container element
 * @returns Object containing grid dimensions and cell information
 */
export function getGridInfo(grid: HTMLElement): {
  columnCount: number;
  rowCount: number;
  columnWidths: string[];
  rowHeights: string[];
  cellCount: number;
} {
  // Parse column widths from data attribute, filtering out empty values
  const columnWidths = (grid.getAttribute("data-column-widths") || "")
    .split(",")
    .filter((width) => width.trim() !== "");
  // Parse row heights from data attribute, filtering out empty values
  const rowHeights = (grid.getAttribute("data-row-heights") || "")
    .split(",")
    .filter((height) => height.trim() !== ""); // Count actual cell elements in the DOM (may differ from expected due to spans)
  const cellCount = getGridCells(grid).length;

  return {
    columnWidths,
    rowHeights,
    cellCount,
    columnCount: columnWidths.length,
    rowCount: rowHeights.length,
  };
}

export function changeCellSpan(cell: HTMLElement, xChange: number, yChange: number): void {
  const grid = cell.closest<HTMLElement>(".grid");
  assert(!!grid, "Cell must be inside a grid element");

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

  gridHistoryManager.addHistoryEntry(grid, description, performOperation);
}

/**
 * Sets the horizontal and vertical span of a cell, which determines how many columns and rows it covers.
 * This function modifies the cell's CSS custom properties (--span-x, --span-y) and removes or adds
 * the "skip" class from covered cells as needed to maintain grid structure.
 *
 * Important: When a cell spans, it covers a rectangular area. All cells within that area,
 * except for the spanning cell itself, get the "skip" class to indicate they are not active.
 *
 * Example: In a 2x2 grid, setCellSpan(cell(0,0), 2, 2) will mark cell(0,1), cell(1,0), and cell(1,1) as skipped.
 *
 * @param cell The cell element to apply the span to
 * @param newHorizontalSpan Number of columns the cell should span (1 = no span)
 * @param newVerticalSpan Number of rows the cell should span (1 = no span)
 * @throws {Error} If the span would exceed grid boundaries
 */
export function setCellSpan(cell: HTMLElement, newHorizontalSpan: number, newVerticalSpan: number) {
  const grid = cell.closest<HTMLElement>(".grid");
  assert(!!grid, "Cell must be inside a grid element");

  const currentSpanX = parseInt(cell.style.getPropertyValue("--span-x")) || 1;
  const currentSpanY = parseInt(cell.style.getPropertyValue("--span-y")) || 1;

  if (newHorizontalSpan === currentSpanX && newVerticalSpan === currentSpanY) {
    return;
  }

  const gridInfo = getGridInfo(grid);
  const { row, column } = getRowAndColumn(grid, cell);

  // Check bounds - ensure the span doesn't exceed grid boundaries
  assert(
    column + newHorizontalSpan <= gridInfo.columnCount,
    `Horizontal span ${newHorizontalSpan} from column ${column} would exceed grid bounds (${gridInfo.columnCount} columns)`,
  );
  assert(
    row + newVerticalSpan <= gridInfo.rowCount,
    `Vertical span ${newVerticalSpan} from row ${row} would exceed grid bounds (${gridInfo.rowCount} rows)`,
  );

  // First, unmark all cells that were previously covered by this cell's span
  for (let r = row; r < row + currentSpanY; r++) {
    for (let c = column; c < column + currentSpanX; c++) {
      if (r === row && c === column) continue; // Skip the spanning cell itself
      const coveredCell = getCell(grid, r, c);
      coveredCell.classList.remove("skip");
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
      const coveredCell = getCell(grid, r, c);
      coveredCell.classList.add("skip");
    }
  }
}

/**
 * Calculates the logical row and column position of a cell within the grid.
 *
 * @param grid The grid container element
 * @param cell The cell whose position we want to find
 * @returns Object with row and column (0-based indices)
 * @throws {Error} If the cell is not found in the grid
 */
export function getRowAndColumn(
  grid: HTMLElement,
  cell: HTMLElement,
): { row: number; column: number } {
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");
  assert(cell.classList.contains("cell"), "cell parameter must have 'cell' class");

  const gridInfo = getGridInfo(grid);
  const cells = getGridCells(grid);
  const cellIndex = cells.indexOf(cell);
  assert(cellIndex !== -1, "Cell not found in the grid. Ensure it is a direct child of the grid.");
  const columnCount = gridInfo.columnCount;
  const row = Math.floor(cellIndex / columnCount);
  const column = cellIndex % columnCount;
  assert(row >= 0 && row < gridInfo.rowCount, `Row index ${row} is out of bounds`);
  assert(column >= 0 && column < gridInfo.columnCount, `Column index ${column} is out of bounds`);
  return { row, column };
}

/**
 * Retrieves the cell element at the specified logical row and column position.
 * This is the inverse of getRowAndColumn - given a position, find the cell.
 *
 * Like getRowAndColumn, this must account for cell spans when traversing the grid.
 * It uses the same algorithm but stops when it reaches the target position.
 *
 * @param grid The grid container element
 * @param row The target row (0-based)
 * @param column The target column (0-based)
 * @returns The HTMLElement at the specified position
 * @throws {Error} If the position is out of bounds or no cell is found
 */
export function getCell(grid: HTMLElement, row: number, column: number): HTMLElement {
  // Check that grid is an HTMLElement (or derivative)
  // No need to check instanceof HTMLElement since HTMLDivElement and other specific elements will pass this check
  // The presence of the 'grid' class is sufficient for our validation
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");

  const gridInfo = getGridInfo(grid);
  assert(row >= 0 && row < gridInfo.rowCount, `Row index ${row} would be out of bounds`);
  assert(
    column >= 0 && column < gridInfo.columnCount,
    `Column index ${column} would be out of bounds`,
  ); // Calculate the linear index in the DOM based on row and column
  const cellIndex = row * gridInfo.columnCount + column;
  const cells = getGridCells(grid);

  assert(
    cellIndex < cells.length,
    `Cell at row ${row}, column ${column} not found in DOM (cellIndex=${cellIndex}, cells.length=${
      cells.length
    }, gridInfo=${JSON.stringify(gridInfo)})`,
  );

  return cells[cellIndex] as HTMLElement;
}

/**
 * Adds a column at the specified index position.
 * @param grid The grid container element
 * @param index The position to insert the column (0-based). If not provided, adds at the end.
 * @param skipHistory Whether to skip adding this operation to history
 */
export const addColumnAt = (grid: HTMLElement, index?: number, skipHistory = false): void => {
  if (!grid) return;

  const gridInfo = getGridInfo(grid);
  const actualIndex = index ?? gridInfo.columnCount;

  assert(
    actualIndex >= 0 && actualIndex <= gridInfo.columnCount,
    `Column index ${actualIndex} is out of bounds`,
  );
  const description = `Add Column at ${actualIndex}`;
  const performOperation = () => {
    const numRows = gridInfo.rowCount;
    if (numRows === 0) return;

    // Collect reference nodes BEFORE changing the grid structure
    const referenceNodes: (HTMLElement | null)[] = [];
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      // Find reference node for insertion. If adding at the end, it's null.
      // Otherwise, it's the cell at the insertion index for the current row.
      const referenceNode =
        actualIndex < gridInfo.columnCount ? getCell(grid, rowIndex, actualIndex) : null;
      referenceNodes.push(referenceNode);
    }

    // Now update the grid structure
    const currentColumnWidths = grid.getAttribute("data-column-widths") || "";
    const columnWidths = currentColumnWidths ? currentColumnWidths.split(",") : [];

    // Insert new column width at the specified index
    columnWidths.splice(actualIndex, 0, defaultColumnWidth);
    grid.setAttribute("data-column-widths", columnWidths.join(",")); // Insert new cells at the appropriate positions
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      const newCell = createCell();

      grid.insertBefore(newCell, referenceNodes[rowIndex]);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    gridHistoryManager.addHistoryEntry(grid, description, performOperation);
  }
};

/**
 * Adds a row at the specified index position.
 * @param grid The grid container element
 * @param index The position to insert the row (0-based). If not provided, adds at the end.
 * @param skipHistory Whether to skip adding this operation to history
 */
export const addRowAt = (grid: HTMLElement, index?: number, skipHistory = false): void => {
  if (!grid) return;

  const gridInfo = getGridInfo(grid);
  const actualIndex = index ?? gridInfo.rowCount;

  assert(
    actualIndex >= 0 && actualIndex <= gridInfo.rowCount,
    `Row index ${actualIndex} is out of bounds`,
  );
  const description = `Add Row at ${actualIndex}`;
  const performOperation = () => {
    const numColumns = gridInfo.columnCount;
    if (numColumns === 0) return;

    // Find the reference node for insertion BEFORE changing the grid structure
    // If adding at the end, referenceNode is null.
    // Otherwise, it's the first cell of the row at the insertion index.
    const referenceNode = actualIndex < gridInfo.rowCount ? getCell(grid, actualIndex, 0) : null;

    // Now update the grid structure
    const currentRowHeights = grid.getAttribute("data-row-heights") || "";
    const rowHeights = currentRowHeights ? currentRowHeights.split(",") : [];

    // Insert new row height at the specified index
    rowHeights.splice(actualIndex, 0, defaultRowHeight);
    grid.setAttribute("data-row-heights", rowHeights.join(",")); // Insert new cells for the entire row
    for (let colIndex = 0; colIndex < numColumns; colIndex++) {
      const newCell = createCell();
      grid.insertBefore(newCell, referenceNode);
    }
  };

  if (skipHistory) {
    performOperation();
  } else {
    gridHistoryManager.addHistoryEntry(grid, description, performOperation);
  }
};

/**
 * Removes a column at the specified index position, adjusting spans as needed.
 * @param grid The grid container element
 * @param index The column index to remove (0-based)
 */
export const removeColumnAt = (grid: HTMLElement, index: number, skipHistory = false): void => {
  if (!grid) return;

  const gridInfo = getGridInfo(grid);

  assert(gridInfo.columnCount > 1, "Cannot remove the only column");
  assert(index >= 0 && index < gridInfo.columnCount, `Column index ${index} is out of bounds`);
  const description = `Remove Column at ${index}`;
  const performOperation = () => {
    // Collect cells to remove BEFORE changing the grid structure
    const cellsToRemove: HTMLElement[] = [];
    for (let rowIndex = 0; rowIndex < gridInfo.rowCount; rowIndex++) {
      cellsToRemove.push(getCell(grid, rowIndex, index));
    } // First adjust spans of cells that were affected by the removal
    const cells = getGridCells(grid);
    cells.forEach((cell) => {
      const htmlCell = cell as HTMLElement;
      const { column: cellColumn } = getRowAndColumn(grid, htmlCell);
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
    const currentColumnWidths = grid.getAttribute("data-column-widths") || "";
    const columnWidths = currentColumnWidths ? currentColumnWidths.split(",") : [];
    columnWidths.splice(index, 1);
    grid.setAttribute("data-column-widths", columnWidths.join(","));

    // Remove the collected cells
    cellsToRemove.forEach((cell) => grid.removeChild(cell));
  };

  if (skipHistory) {
    performOperation();
  } else {
    gridHistoryManager.addHistoryEntry(grid, description, performOperation);
  }
};

/**
 * Removes a row at the specified index position, adjusting spans as needed.
 * @param grid The grid container element
 * @param index The row index to remove (0-based)
 */
export const removeRowAt = (grid: HTMLElement, index: number, skipHistory = false): void => {
  if (!grid) return;

  const gridInfo = getGridInfo(grid);

  assert(gridInfo.rowCount > 1, "Cannot remove the only row");
  assert(index >= 0 && index < gridInfo.rowCount, `Row index ${index} is out of bounds`);
  const description = `Remove Row at ${index}`;
  const performOperation = () => {
    // Collect cells to remove BEFORE changing the grid structure
    const cellsToRemove: HTMLElement[] = [];
    for (let columnIndex = 0; columnIndex < gridInfo.columnCount; columnIndex++) {
      cellsToRemove.push(getCell(grid, index, columnIndex));
    } // First adjust spans of cells that were affected by the removal
    const cells = getGridCells(grid);
    cells.forEach((cell) => {
      const htmlCell = cell as HTMLElement;
      const { row: cellRow } = getRowAndColumn(grid, htmlCell);
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
    const currentRowHeights = grid.getAttribute("data-row-heights") || "";
    const rowHeights = currentRowHeights ? currentRowHeights.split(",") : [];
    rowHeights.splice(index, 1);
    grid.setAttribute("data-row-heights", rowHeights.join(","));

    // Remove the collected cells
    cellsToRemove.forEach((cell) => grid.removeChild(cell));
  };

  if (skipHistory) {
    performOperation();
  } else {
    gridHistoryManager.addHistoryEntry(grid, description, performOperation);
  }
};

export function getRowIndex(cell: HTMLElement) {
  const grid = cell.closest<HTMLElement>(".grid");
  assert(!!grid, "Cell must be inside a grid element");

  const { row } = getRowAndColumn(grid, cell);
  return row;
}

export function setColumnWidth(
  grid: HTMLElement,
  columnIndex: number,
  width: string, // 35px, hug, fill
): void {
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");
  const gridInfo = getGridInfo(grid);
  assert(
    columnIndex >= 0 && columnIndex < gridInfo.columnCount,
    `Column index ${columnIndex} is out of bounds`,
  );

  const currentWidths = grid.getAttribute("data-column-widths") || "";
  const widthArray = currentWidths.split(",");
  if (columnIndex >= 0 && columnIndex < widthArray.length) {
    widthArray[columnIndex] = width;
    grid.setAttribute("data-column-widths", widthArray.join(","));
  }
}
export function getColumnWidth(grid: HTMLElement, columnIndex: number): string | null {
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");
  const gridInfo = getGridInfo(grid);
  assert(
    columnIndex >= 0 && columnIndex < gridInfo.columnCount,
    `Column index ${columnIndex} is out of bounds`,
  );

  const currentWidths = grid.getAttribute("data-column-widths") || "";
  const widthArray = currentWidths.split(",");
  return widthArray[columnIndex] || null;
}

/** Gets the raw height spec for a given row (e.g., "hug", "fill", or "42px"). */
export function getRowHeight(grid: HTMLElement, rowIndex: number): string | null {
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");
  const gridInfo = getGridInfo(grid);
  assert(rowIndex >= 0 && rowIndex < gridInfo.rowCount, `Row index ${rowIndex} is out of bounds`);
  const currentHeights = grid.getAttribute("data-row-heights") || "";
  const heightArray = currentHeights.split(",");
  return heightArray[rowIndex] || null;
}

/** Sets the height for a given row to a spec (e.g., "hug", "fill", or "42px"). */
export function setRowHeight(grid: HTMLElement, rowIndex: number, height: string): void {
  assert(grid.classList.contains("grid"), "grid parameter must have 'grid' class");
  const gridInfo = getGridInfo(grid);
  assert(rowIndex >= 0 && rowIndex < gridInfo.rowCount, `Row index ${rowIndex} is out of bounds`);
  const currentHeights = grid.getAttribute("data-row-heights") || "";
  const heightArray = currentHeights ? currentHeights.split(",") : [];

  // Ensure array is sized to number of rows
  if (heightArray.length < gridInfo.rowCount) {
    heightArray.length = gridInfo.rowCount;
  }
  // Fill any empty slots with 'hug'
  for (let i = 0; i < heightArray.length; i++) {
    if (!heightArray[i]) heightArray[i] = "hug";
  }
  if (rowIndex >= 0 && rowIndex < heightArray.length) {
    heightArray[rowIndex] = height;
    grid.setAttribute("data-row-heights", heightArray.join(","));
  }
}
