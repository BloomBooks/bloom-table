import * as React$1 from "react";
import React from "react";

//#region src/grid.d.ts
/**
 * The spanning (anchor) cell covering a grid position, with its position and
 * span. null (from coverAt) when no non-skip cell covers the position.
 */
type SpanCover = {
  anchor: HTMLElement;
  row: number;
  column: number;
  spanX: number;
  spanY: number;
};
//#endregion
//#region src/table-model.d.ts
interface CornersSpec {
  radius: number;
}
declare const defaultColumnWidth = "fill";
declare const defaultRowHeight = "hug";
declare function getGapX(table: HTMLElement): string[];
declare function setGapX(table: HTMLElement, gaps: string[] | string): void;
declare function getGapY(table: HTMLElement): string[];
declare function setGapY(table: HTMLElement, gaps: string[] | string): void;
type CellAlign = "start" | "center" | "end";
declare function getCellAlign(cell: HTMLElement): CellAlign | null;
declare function setCellAlign(cell: HTMLElement, align: CellAlign | null): void;
declare function getCellPadding(cell: HTMLElement): string | null;
declare function setCellPadding(cell: HTMLElement, padding: string | null): void;
declare function getCellCorners(cell: HTMLElement): CornersSpec | null;
declare function setCellCorners(cell: HTMLElement, corners: CornersSpec | null): void;
declare function getCellBackground(cell: HTMLElement): string | null;
declare function setCellBackground(cell: HTMLElement, color: string | null): void;
declare function getTableBackground(table: HTMLElement): string | null;
declare function setTableBackground(table: HTMLElement, color: string | null): void;
//#endregion
//#region src/structure.d.ts
/**
 * Per-cell appearance settings that a newly inserted row/column should inherit
 * from the selected (source) row/column. These are the formatting attributes
 * (fill, alignment, padding, corners) — NOT span (which is positional) or
 * content-type/content (a new cell starts empty). Borders are handled
 * separately via the edge arrays.
 */
declare const CELL_SETTING_ATTRS: readonly ["data-bg", "data-align", "data-pad", "data-corners"];
type CellSettings = Partial<Record<(typeof CELL_SETTING_ATTRS)[number], string | null>> & {
  contentType?: string;
};
declare function snapshotCellSettings(cell: HTMLElement): CellSettings;
declare function applyCellSettings(cell: HTMLElement, snap: CellSettings): void;
/**
 * Gets all cell elements from a table, including those marked as "skip".
 * This is the canonical way to get cells from a table that handles the table structure properly.
 *
 * @param table The table container element
 * @returns Array of all cell elements in DOM order
 */
declare function getTableCells(table: HTMLElement): HTMLElement[];
declare const getTargetTable: () => HTMLElement | null;
declare const addRow: (table: HTMLElement, skipHistory?: boolean, sourceIndex?: number) => void;
declare const removeLastRow: (table: HTMLElement) => void;
declare const addColumn: (table: HTMLElement, skipHistory?: boolean, sourceIndex?: number) => void;
declare const undoLastOperation: (table: HTMLElement) => boolean;
declare const canUndo: () => boolean;
declare const getLastOperation: () => string | null;
declare function removeLastColumn(table: HTMLElement): void;
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
declare function getTableInfo(table: HTMLElement): {
  columnCount: number;
  rowCount: number;
  columnWidths: string[];
  rowHeights: string[];
  cellCount: number;
};
declare function changeCellSpan(cell: HTMLElement, xChange: number, yChange: number): void;
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
declare function setCellSpan(cell: HTMLElement, newHorizontalSpan: number, newVerticalSpan: number): void;
/**
 * Calculates the logical row and column position of a cell within the table.
 *
 * @param table The table container element
 * @param cell The cell whose position we want to find
 * @returns Object with row and column (0-based indices)
 * @throws {Error} If the cell is not found in the table
 */
declare function getRowAndColumn(table: HTMLElement, cell: HTMLElement): {
  row: number;
  column: number;
};
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
declare function getCell(table: HTMLElement, row: number, column: number): HTMLElement;
/**
 * Adds a column at the specified index position.
 * @param table The table container element
 * @param index The position to insert the column (0-based). If not provided, adds at the end.
 * @param skipHistory Whether to skip adding this operation to history
 */
declare const addColumnAt: (table: HTMLElement, index?: number, skipHistory?: boolean, sourceIndex?: number) => void;
/**
 * Adds a row at the specified index position.
 * @param table The table container element
 * @param index The position to insert the row (0-based). If not provided, adds at the end.
 * @param skipHistory Whether to skip adding this operation to history
 */
declare const addRowAt: (table: HTMLElement, index?: number, skipHistory?: boolean, sourceIndex?: number) => void;
/**
 * Duplicates the row at `sourceRow`, inserting the copy directly below it.
 * Unlike addRowAt (whose new cells inherit only settings), this copies
 * everything: contents, content types, spans, and borders. A vertical span
 * that continues below the source row grows one row taller (the copy's cell
 * is covered by it); a vertical span that ENDS at the source row leaves an
 * ordinary unmerged cell in the copy.
 */
declare const duplicateRowAt: (table: HTMLElement, sourceRow: number, skipHistory?: boolean) => void;
/**
 * Duplicates the column at `sourceColumn`, inserting the copy directly to its
 * right. Copies everything: contents, content types, spans, and borders.
 * A horizontal span that continues right of the source column grows one column
 * wider (the copy's cell is covered by it); a horizontal span that ENDS at the
 * source column leaves an ordinary unmerged cell in the copy.
 */
declare const duplicateColumnAt: (table: HTMLElement, sourceColumn: number, skipHistory?: boolean) => void;
/**
 * Removes a column at the specified index position, adjusting spans, edges and
 * gaps as needed.
 * @param table The table container element
 * @param index The column index to remove (0-based)
 */
declare const removeColumnAt: (table: HTMLElement, index: number, skipHistory?: boolean) => void;
/**
 * Removes a row at the specified index position, adjusting spans, edges and
 * gaps as needed.
 * @param table The table container element
 * @param index The row index to remove (0-based)
 */
declare const removeRowAt: (table: HTMLElement, index: number, skipHistory?: boolean) => void;
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
declare const moveRowAt: (table: HTMLElement, from: number, to: number, skipHistory?: boolean) => void;
/**
 * Moves the column at `from` to position `to`, carrying its cells, width, and
 * borders. Borders model: each column "owns" its left vertical boundary; the
 * table's final right boundary stays fixed. Horizontal edges (per-column)
 * travel with the column.
 * @param table The table container element
 * @param from Source column index (0-based)
 * @param to Destination column index (0-based)
 */
declare const moveColumnAt: (table: HTMLElement, from: number, to: number, skipHistory?: boolean) => void;
declare function getRowIndex(cell: HTMLElement): number;
declare function setColumnWidth(table: HTMLElement, columnIndex: number, width: string): void;
declare function getColumnWidth(table: HTMLElement, columnIndex: number): string | null;
/** Gets the raw height spec for a given row (e.g., "hug", "fill", or "42px"). */
declare function getRowHeight(table: HTMLElement, rowIndex: number): string | null;
/** Sets the height for a given row to a spec (e.g., "hug", "fill", or "42px"). */
declare function setRowHeight(table: HTMLElement, rowIndex: number, height: string): void;
//#endregion
//#region src/types.d.ts
type CellContentType = {
  id: string;
  englishName: string;
  templateHtml: string;
  regexToIdentify: RegExp;
  icon: string;
};
//#endregion
//#region src/drag-to-resize.d.ts
declare class DragToResize {
  private attachedTables;
  private cursorStyledElement;
  private dragState;
  /**
   * Attach interactive UI handlers to a table element and register with table-history
   */
  attach(div: HTMLElement): void;
  /**
   * Detach interactive UI handlers from a table element and unregister from table-history
   */
  detach(div: HTMLElement): void;
  /**
   * Which resize a press at this point would begin, or null for none.
   *
   * The two methods here are for a host that gets the press before the table
   * does, and whose own layer may be painted over the table so that the press
   * never reaches it at all: Bloom listens on an ancestor in the capture phase,
   * and its Comical canvas covers the table. Such a host asks this on each
   * mouse move to show the resize cursor, and calls beginResizeAtPoint on a
   * press. They work from the point rather than the event's target, since the
   * target is whatever the host has painted on top.
   */
  resizeEdgeAtPoint(event: MouseEvent): "row" | "column" | null;
  /**
   * Begin a row or column resize at this point, as a press on the table itself
   * would; the document-level handlers here carry it through. Answers whether a
   * resize began, so the host can leave the press alone when it did not.
   */
  beginResizeAtPoint(event: MouseEvent): boolean;
  private getResizeInfoAtPoint;
  private updateCursorOnMouseMove;
  /**
   * Put a resize cursor on one element, clearing whatever element we last put
   * one on. Pass (null, null) to clear without setting a new one, so elements
   * we merely passed over do not keep an inline cursor style (which would
   * otherwise end up in saved content).
   */
  private setHoverCursor;
  private handleMouseDown;
  private startResize;
  private handleMouseLeave;
  private handleGlobalMouseMove;
  private handleGlobalMouseUp;
  /**
   * End the current drag without committing: clear the active-row marker, drop
   * the drag state and release the latched body cursor.
   */
  private cancelDrag;
  private commitResizeOperation;
  private calculateFinalColumnWidth;
  private updateColumnWidthPreview;
  private updateRowHeightPreview;
  private resetDragState;
  private getResizeInfo;
  private findParentTable;
  private handleDoubleClick;
  private getCurrentColumnWidth;
  private getCurrentRowHeight;
}
declare const dragToResize: DragToResize;
//#endregion
//#region src/attach.d.ts
declare function attachTable(tableDiv: HTMLElement): void;
declare function detachTable(tableDiv: HTMLElement): void;
//#endregion
//#region src/history.d.ts
interface TableState {
  innerHTML: string;
  attributes?: Record<string, string>;
}
interface DebugEntry {
  label: string;
  detail?: string;
  timestamp: number;
  tableInDom: boolean;
}
type OperationDescription = string | {
  label: string;
  detail?: string;
};
declare class TableHistoryManager {
  private history;
  private redoStack;
  private maxEntriesPerTable;
  private attachedTables;
  private operationInProgress;
  reset(): void;
  getEntriesForDebug(): DebugEntry[];
  getRedoEntriesForDebug(): DebugEntry[];
  private toDebugEntry;
  private captureTableState;
  addHistoryEntry(table: HTMLElement, description: OperationDescription, performOperation: () => void, // The function that actually performs the DOM change
  undoOperation?: (table: HTMLElement, prevState: TableState) => void, redoOperation?: (table: HTMLElement) => void): boolean;
  undo(table: HTMLElement): boolean;
  redo(table: HTMLElement): boolean;
  undoLast(): boolean;
  redoLast(): boolean;
  attachTable(table: HTMLElement): void;
  detachTable(table: HTMLElement): void;
  isAttached(table: HTMLElement): boolean;
  canUndo(table?: HTMLElement): boolean;
  canRedo(table?: HTMLElement): boolean;
  getLastOperationLabel(): string | null;
  getNextRedoLabel(): string | null;
  clearHistory(): void;
  private defaultUndoOperation;
  private reattachRestoredTables;
  private findTopLevelTable;
}
declare const tableHistoryManager: TableHistoryManager;
//#endregion
//#region src/BloomTable.d.ts
declare class BloomTable {
  private table;
  constructor(table: HTMLElement);
  private focusEditableInCell;
  addRow(): void;
  removeLastRow(): void;
  addColumn(): void;
  removeLastColumn(): void;
  addRowAt(index: number, sourceRowOverride?: number): void;
  addColumnAt(index: number, sourceColOverride?: number): void;
  removeRowAt(index: number): void;
  removeColumnAt(index: number): void;
  duplicateRowAt(index: number): void;
  duplicateColumnAt(index: number): void;
  moveRowAt(from: number, to: number): void;
  moveColumnAt(from: number, to: number): void;
  setColumnWidth(index: number, value: string): void;
  setRowHeight(index: number, value: string): void;
  getRowHeight(index: number): string | null;
  getColumnWidth(index: number): string | null;
  getSpan(cell: HTMLElement): {
    x: number;
    y: number;
  };
  setTableCorners(radiusPx: number): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  setSpan(cell: HTMLElement, x: number, y: number): void;
}
//#endregion
//#region src/cell-contents.d.ts
declare function contentTypeOptions(): {
  id: string;
  englishName: string;
  icon: string;
}[];
declare const defaultCellContentsForEachType: CellContentType[];
declare const kTableCellContentChangedEvent = "tableCellContentChanged";
declare function registerCellContentType(type: CellContentType, options?: {
  makeDefault?: boolean;
}): void;
declare function unregisterCellContentType(id: string): void;
declare function setDefaultCellContentTypeId(id: string): void;
declare function getDefaultCellContentTypeId(): string;
declare function getCurrentContentTypeId(cell: HTMLElement): string | undefined;
declare function setupContentsOfCell(cell: HTMLElement, targetType?: string, putInHistory?: boolean, notifyHost?: boolean): HTMLElement | null;
//#endregion
//#region src/structural-chrome.d.ts
/**
 * Install the host's answer to "does this table get the structural chrome?",
 * called with each table as its chrome is about to be shown or repositioned.
 * Pass undefined to remove a gate, after which every table gets the chrome
 * again.
 */
declare function setStructuralChromeGate(fn: ((table: HTMLElement) => boolean) | undefined): void;
//#endregion
//#region src/cell-menu-host.d.ts
/**
 * The ids the menu composition asks about.
 *
 * - `contentType` is the Content Type row, and `contentType:<id>` is one type
 *   within it, so `contentType:image` is the Image button.
 * - `alignment`, `padding`, `fill`, `borderStyle`, `borderWeight` and `corners`
 *   are the rows of the Format section. `fill` is the row that holds both colour
 *   pickers, Fill and Border color, because they share one row.
 * - `paintFormat` is Paint format, in the Cell, Row and Column menus.
 *   `copyProperties` and `pasteProperties` are its Table menu counterparts.
 * - `merge` and `split` are the Cell menu's span commands.
 *
 * A `contentType:<id>` is only asked about once its row has been allowed.
 */
declare const cellMenuItemIds: readonly ["contentType", "alignment", "padding", "fill", "borderStyle", "borderWeight", "corners", "paintFormat", "copyProperties", "pasteProperties", "merge", "split"];
/** One of the ids above, or `contentType:<content type id>`. */
type CellMenuItemId = string;
/**
 * Install the host's answer to "does this cell's menu offer this item?". It is
 * asked as a menu is built, with the item's id, the cell the menu acts on, and
 * that cell's table. Pass undefined to remove a filter, after which every menu
 * offers everything again.
 *
 * Write the answer as a list of what to keep rather than a list of what to
 * remove. A host that names what to remove silently gains any item a later
 * version of the library adds.
 */
declare function setCellMenuItemFilter(fn: ((itemId: CellMenuItemId, cell: HTMLElement | null, table: HTMLElement | null) => boolean) | undefined): void;
/**
 * Install the host's chance to open a cell's menu itself. A right-click on a cell
 * asks this first, with the cell, its table, and the point the user clicked. A
 * host that answers true has opened its own menu and the library opens none; a
 * host that answers false leaves the right-click to the library, as does having
 * no handler at all.
 *
 * A host answers true where it needs the cell's items shown beside items of its
 * own that the library knows nothing about. Bloom does it for a picture in a
 * calendar month grid, whose menu has to carry the image commands as well as the
 * content type. It builds that menu from getCellMenuItems (cell-menu-model.ts),
 * so both menus offer the same cell items.
 */
declare function setCellMenuOpenHandler(fn: ((cell: HTMLElement, table: HTMLElement, position: {
  x: number;
  y: number;
}) => boolean) | undefined): void;
//#endregion
//#region src/table-size-buttons.d.ts
/**
 * Open the Cell menu for `cell` at the given viewport point. This is the one
 * Cell menu: a right-click uses it, and so does a host that puts the menu on a
 * button of its own. It returns false, and opens nothing, while Paint Format
 * mode runs, because a menu on top of that mode would let the user re-enter it
 * with a different pattern.
 */
declare function openCellMenu(cell: HTMLElement, position: {
  x: number;
  y: number;
}): boolean;
//#endregion
//#region src/components/CellMenuItems.d.ts
interface CellMenuItemsProps {
  /** The cell whose menu this is. */
  cell: HTMLElement | null;
  /**
   * Translate one label. `id` is the item's id (or `<choice id>:<option id>`), so a
   * host can map ids to its own strings. The default returns the English label the
   * library gives, because the library does not localize.
   */
  localize?: (englishLabel: string, id: string) => string;
  /**
   * Dismiss the menu this sits in. Called just before a command runs, which is what
   * the library's popup and Bloom's menu both want; choosing a content type leaves
   * the menu open, so the user can try another.
   */
  closeMenu?: () => void;
  /**
   * Draw the Format rows — the sliders and colour pickers — into `container`. Only
   * the library's own popup passes this, because those rows are still its own DOM
   * widgets. A host that leaves it out gets no Format section.
   */
  renderFormatControls?: (container: HTMLElement) => void;
}
declare const CellMenuItems: React$1.FunctionComponent<CellMenuItemsProps>;
//#endregion
//#region src/prepare-for-save.d.ts
declare function removeTableEditingArtifacts(root?: ParentNode): void;
//#endregion
//#region src/table-renderer.d.ts
declare function render(table: HTMLElement): void;
//#endregion
//#region src/edge-utils.d.ts
type UIStyle = "none" | "solid" | "dashed" | "dotted" | "double";
interface UIBorder {
  weight: number;
  style: UIStyle;
  color?: string;
}
declare function ensureEdgesArrays(table: HTMLElement): void;
declare function applyOuterBorders(table: HTMLElement, borders: {
  top?: UIBorder | null;
  right?: UIBorder | null;
  bottom?: UIBorder | null;
  left?: UIBorder | null;
}, colorFallback?: string): void;
declare function applyUniformInner(table: HTMLElement, kind: "innerV" | "innerH", border: UIBorder | null, colorFallback?: string): void;
declare function setDefaultBorder(table: HTMLElement, border: UIBorder | null, colorFallback?: string): void;
declare function applyCellPerimeter(table: HTMLElement, cell: HTMLElement, map: {
  top?: UIBorder | null;
  right?: UIBorder | null;
  bottom?: UIBorder | null;
  left?: UIBorder | null;
}, outerColorFallback?: string, innerColorFallback?: string): void;
//#endregion
//#region src/components/BorderControl/logic/types.d.ts
type EdgeKey = "top" | "right" | "bottom" | "left" | "innerH" | "innerV";
type BorderWeight = 0 | 1 | 2 | 4;
type BorderStyle = "none" | "solid" | "dashed" | "dotted" | "double";
type CornerRadius = 0 | 2 | 4 | 8 | 16;
interface EdgeValue {
  weight: BorderWeight;
  style: BorderStyle;
  radius: CornerRadius;
}
type BorderValueMap = Record<EdgeKey, EdgeValue>;
//#endregion
//#region src/border-state.d.ts
/** RESOLVED outer/inner border values for the table panel. Stored edge
 *  entries are tri-state — explicitly painted, explicitly none (weight 0),
 *  or never set (null: renders with the table default and follows later
 *  default edits) — but this map collapses the last state: a never-set edge
 *  reports the default value it currently renders with, indistinguishable
 *  from an edge somebody explicitly set to that value. The edge-utils writers
 *  compensate: writing a value a never-set entry already renders via the
 *  default leaves the entry unset, so reading this map and writing it back
 *  unchanged does not freeze inheriting edges at today's default. */
declare function getTableOuterBorderValueMap(table: HTMLElement): BorderValueMap;
/** RESOLVED values for a cell's four perimeter edges (inner keys are stubbed
 *  to none — a single cell has no interior). Like the table map above, this
 *  collapses the stored tri-state: a never-set edge reports the table default
 *  it currently renders with, and an edge this cell explicitly declined
 *  (weight 0 / 'none') reports plain none. Callers writing the map back rely
 *  on applyCellPerimeter's guard to keep never-set entries unset when the
 *  value round-trips unchanged. */
declare function getCellPerimeterValueMap(cell: HTMLElement): BorderValueMap;
//#endregion
//#region src/components/TableApiContext.d.ts
/** Every table operation the React panel needs, bundled so a host can inject a
 *  realm-correct implementation. Types are derived from the real functions. */
interface TableApi {
  BloomTable: typeof BloomTable;
  getRowIndex: typeof getRowIndex;
  getRowAndColumn: typeof getRowAndColumn;
  canUndo: typeof canUndo;
  undoLastOperation: typeof undoLastOperation;
  getTargetTable: typeof getTargetTable;
  setupContentsOfCell: typeof setupContentsOfCell;
  contentTypeOptions: typeof contentTypeOptions;
  getCurrentContentTypeId: typeof getCurrentContentTypeId;
  render: typeof render;
  applyCellPerimeter: typeof applyCellPerimeter;
  ensureEdgesArrays: typeof ensureEdgesArrays;
  applyUniformInner: typeof applyUniformInner;
  setDefaultBorder: typeof setDefaultBorder;
  applyOuterBorders: typeof applyOuterBorders;
  getCellPerimeterValueMap: typeof getCellPerimeterValueMap;
  getTableOuterBorderValueMap: typeof getTableOuterBorderValueMap;
  getCellAlign: typeof getCellAlign;
  setCellAlign: typeof setCellAlign;
  getCellCorners: typeof getCellCorners;
  setCellCorners: typeof setCellCorners;
  getCellPadding: typeof getCellPadding;
  setCellPadding: typeof setCellPadding;
  getCellBackground: typeof getCellBackground;
  setCellBackground: typeof setCellBackground;
  getTableBackground: typeof getTableBackground;
  setTableBackground: typeof setTableBackground;
  getGapX: typeof getGapX;
  setGapX: typeof setGapX;
  getGapY: typeof getGapY;
  setGapY: typeof setGapY;
}
/** The api built from this module's own functions; used when no api is injected. */
declare const defaultTableApi: TableApi;
declare const TableApiContext: import("react").Context<TableApi>;
/** Read the injected table api (falls back to defaultTableApi via the context). */
declare const useTableApi: () => TableApi;
//#endregion
//#region src/components/ColorPickerContext.d.ts
interface ColorPickerProps {
  /** Current color as a CSS color string. Empty string means "unset / default". */
  value: string;
  /** Called in realtime as the color changes. Empty string clears the color. */
  onChange: (color: string) => void;
  /** Accessible label / tooltip, e.g. "Table background". */
  label?: string;
}
type ColorPickerComponent = React.ComponentType<ColorPickerProps>;
/** Minimal built-in picker so the demo / same-realm hosts work without injection. */
declare const DefaultColorPicker: ColorPickerComponent;
declare const ColorPickerContext: React.Context<ColorPickerComponent>;
/** Read the injected color picker (falls back to DefaultColorPicker). */
declare const useColorPicker: () => ColorPickerComponent;
//#endregion
//#region src/components/TableMenu.d.ts
declare const TableMenu: React.FC<{
  currentCell: HTMLElement | null | undefined;
  tableApi?: TableApi;
  colorPicker?: ColorPickerComponent;
}>;
//#endregion
export { BloomTable, CellContentType, type CellMenuItemId, CellMenuItems, type CellMenuItemsProps, CellSettings, type ColorPickerComponent, ColorPickerContext, type ColorPickerProps, DefaultColorPicker, type SpanCover, type TableApi, TableApiContext, TableMenu, addColumn, addColumnAt, addRow, addRowAt, applyCellSettings, attachTable, canUndo, cellMenuItemIds, changeCellSpan, contentTypeOptions, defaultCellContentsForEachType, defaultColumnWidth, defaultRowHeight, defaultTableApi, detachTable, dragToResize, duplicateColumnAt, duplicateRowAt, getCell, getColumnWidth, getCurrentContentTypeId, getDefaultCellContentTypeId, getLastOperation, getRowAndColumn, getRowHeight, getRowIndex, getTableCells, getTableInfo, getTargetTable, kTableCellContentChangedEvent, moveColumnAt, moveRowAt, openCellMenu, registerCellContentType, removeColumnAt, removeLastColumn, removeLastRow, removeRowAt, removeTableEditingArtifacts, setCellMenuItemFilter, setCellMenuOpenHandler, setCellSpan, setColumnWidth, setDefaultCellContentTypeId, setRowHeight, setStructuralChromeGate, setupContentsOfCell, snapshotCellSettings, tableHistoryManager, undoLastOperation, unregisterCellContentType, useColorPicker, useTableApi };