import {
  addRow as structAddRow,
  removeLastRow as structRemoveLastRow,
  addColumn as structAddColumn,
  removeLastColumn as structRemoveLastColumn,
  setCellSpan as structSetCellSpan,
  addRowAt as structAddRowAt,
  addColumnAt as structAddColumnAt,
  removeRowAt as structRemoveRowAt,
  removeColumnAt as structRemoveColumnAt,
} from "./structure";
import {
  getColumnWidths,
  setColumnWidths,
  getRowHeights,
  setRowHeights,
  setGridCorners,
  setSpan,
  getSpan,
} from "./grid-model";
import { gridHistoryManager } from "./history";
import { render } from "./grid-renderer";
import { getCell } from "./structure";

export class BloomGrid {
  constructor(private grid: HTMLElement) {
    if (!this.grid.classList.contains("grid")) {
      this.grid.classList.add("grid");
    }
  }

  private focusEditableInCell(cell: HTMLElement | null | undefined) {
    if (!cell) return;
    const editable = cell.querySelector<HTMLElement>("[contenteditable]");
    try {
      (editable ?? cell).focus();
    } catch {}
  }

  // Structure ops (already history-wrapped in structure.ts)
  addRow(): void {
    // Capture selected column (if any) before insertion
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetCol = 0;
    if (sel) {
      const widths = getColumnWidths(this.grid);
      // Compute column by index of selected cell
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const col = widths.length > 0 ? cellIndex % widths.length : 0;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widths.length - 1)));
    }
    structAddRow(this.grid);
    render(this.grid);
    const rowIndex = Math.max(0, getRowHeights(this.grid).length - 1);
    this.focusEditableInCell(getCell(this.grid, rowIndex, targetCol));
  }

  removeLastRow(): void {
    // Capture target column from current selection, and last row index before removal
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetCol = 0;
    const widthsBefore = getColumnWidths(this.grid);
    const heightsBefore = getRowHeights(this.grid);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const col = cellIndex % widthsBefore.length;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widthsBefore.length - 1)));
    }
    const removedIndex = Math.max(0, heightsBefore.length - 1);
    structRemoveLastRow(this.grid);
    render(this.grid);
    const heightsAfter = getRowHeights(this.grid);
    if (heightsAfter.length > 0) {
      const targetRow = Math.min(removedIndex, heightsAfter.length - 1);
      this.focusEditableInCell(getCell(this.grid, targetRow, targetCol));
    }
  }

  addColumn(): void {
    // Capture selected row (if any) before insertion
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetRow = 0;
    if (sel) {
      const heights = getRowHeights(this.grid);
      const widths = getColumnWidths(this.grid);
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const row = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
      targetRow = Math.max(0, Math.min(row, Math.max(0, heights.length - 1)));
    }
    structAddColumn(this.grid);
    render(this.grid);
    const colIndex = Math.max(0, getColumnWidths(this.grid).length - 1);
    this.focusEditableInCell(getCell(this.grid, targetRow, colIndex));
  }

  removeLastColumn(): void {
    // Capture target row from current selection, and last column index before removal
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetRow = 0;
    const heightsBefore = getRowHeights(this.grid);
    const widthsBefore = getColumnWidths(this.grid);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const row = Math.floor(cellIndex / Math.max(1, widthsBefore.length));
      targetRow = Math.max(0, Math.min(row, Math.max(0, heightsBefore.length - 1)));
    }
    const removedIndex = Math.max(0, widthsBefore.length - 1);
    structRemoveLastColumn(this.grid);
    render(this.grid);
    const widthsAfter = getColumnWidths(this.grid);
    if (widthsAfter.length > 0) {
      const targetCol = Math.min(removedIndex, widthsAfter.length - 1);
      this.focusEditableInCell(getCell(this.grid, targetRow, targetCol));
    }
  }

  // Positioned structure ops
  addRowAt(index: number): void {
    // Capture selected column (if any) before insertion
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetCol = 0;
    if (sel) {
      const widths = getColumnWidths(this.grid);
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const col = widths.length > 0 ? cellIndex % widths.length : 0;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widths.length - 1)));
    }
    structAddRowAt(this.grid, index);
    render(this.grid);
    this.focusEditableInCell(getCell(this.grid, index, targetCol));
  }

  addColumnAt(index: number): void {
    // Capture selected row (if any) before insertion
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetRow = 0;
    if (sel) {
      const heights = getRowHeights(this.grid);
      const widths = getColumnWidths(this.grid);
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const row = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
      targetRow = Math.max(0, Math.min(row, Math.max(0, heights.length - 1)));
    }
    structAddColumnAt(this.grid, index);
    render(this.grid);
    this.focusEditableInCell(getCell(this.grid, targetRow, index));
  }

  removeRowAt(index: number): void {
    // Capture selected column from current selection prior to removal
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetCol = 0;
    const widthsBefore = getColumnWidths(this.grid);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const col = cellIndex % widthsBefore.length;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widthsBefore.length - 1)));
    }
    structRemoveRowAt(this.grid, index);
    render(this.grid);
    const heightsAfter = getRowHeights(this.grid);
    if (heightsAfter.length > 0) {
      const targetRow = Math.min(index, heightsAfter.length - 1);
      this.focusEditableInCell(getCell(this.grid, targetRow, targetCol));
    }
  }

  removeColumnAt(index: number): void {
    // Capture selected row from current selection prior to removal
    const sel = this.grid.querySelector<HTMLElement>(".cell.cell--selected");
    let targetRow = 0;
    const widthsBefore = getColumnWidths(this.grid);
    const heightsBefore = getRowHeights(this.grid);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.grid.children).indexOf(sel);
      const row = Math.floor(cellIndex / Math.max(1, widthsBefore.length));
      targetRow = Math.max(0, Math.min(row, Math.max(0, heightsBefore.length - 1)));
    }
    structRemoveColumnAt(this.grid, index);
    render(this.grid);
    const widthsAfter = getColumnWidths(this.grid);
    if (widthsAfter.length > 0) {
      const targetCol = Math.min(index, widthsAfter.length - 1);
      this.focusEditableInCell(getCell(this.grid, targetRow, targetCol));
    }
  }

  // Column/Row sizing with history integration
  setColumnWidth(index: number, value: string): void {
    const perform = () => {
      const widths = getColumnWidths(this.grid);
      if (index < 0 || index >= widths.length) return;
      widths[index] = value;
      setColumnWidths(this.grid, widths);
    };
    gridHistoryManager.addHistoryEntry(this.grid, `Set Column ${index} Width`, perform);
    render(this.grid);
  }

  setRowHeight(index: number, value: string): void {
    const perform = () => {
      const heights = getRowHeights(this.grid);
      if (index < 0 || index >= heights.length) return;
      heights[index] = value;
      setRowHeights(this.grid, heights);
    };
    gridHistoryManager.addHistoryEntry(this.grid, `Set Row ${index} Height`, perform);
    render(this.grid);
  }

  // Getters to read current specs for UI
  getRowHeight(index: number): string | null {
    const heights = getRowHeights(this.grid);
    return index >= 0 && index < heights.length ? heights[index] : null;
  }

  getColumnWidth(index: number): string | null {
    const widths = getColumnWidths(this.grid);
    return index >= 0 && index < widths.length ? widths[index] : null;
  }

  getSpan(cell: HTMLElement): { x: number; y: number } {
    return getSpan(cell);
  }

  // Borders are modeled via unified edge arrays; callers should use grid-model setEdgesH/V helpers directly.

  setGridCorners(radiusPx: number): void {
    const perform = () => setGridCorners(this.grid, { radius: radiusPx });
    gridHistoryManager.addHistoryEntry(this.grid, "Set Grid Corners", perform);
    render(this.grid);
  }

  // Spans: write data-*, and call structure's setCellSpan to maintain skip semantics today
  setSpan(cell: HTMLElement, x: number, y: number): void {
    const perform = () => {
      setSpan(cell, { x, y });
      // maintain skip coverage using existing structure helper (also sets CSS vars for now)
      structSetCellSpan(cell, x, y);
    };
    gridHistoryManager.addHistoryEntry(this.grid, `Set Cell Span ${x}x${y}`, perform);
    render(this.grid);
  }
}

export default BloomGrid;
