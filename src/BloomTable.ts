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
  setTableCorners,
  setSpan,
  getSpan,
} from "./table-model";
import { tableHistoryManager } from "./history";
import { render } from "./table-renderer";
import { getCell } from "./structure";

export class BloomTable {
  constructor(private table: HTMLElement) {
    if (!this.table.classList.contains("bloom-table")) {
      this.table.classList.add("bloom-table");
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
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetCol = 0;
    if (sel) {
      const widths = getColumnWidths(this.table);
      // Compute column by index of selected cell
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const col = widths.length > 0 ? cellIndex % widths.length : 0;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widths.length - 1)));
    }
    structAddRow(this.table);
    render(this.table);
    const rowIndex = Math.max(0, getRowHeights(this.table).length - 1);
    this.focusEditableInCell(getCell(this.table, rowIndex, targetCol));
  }

  removeLastRow(): void {
    // Capture target column from current selection, and last row index before removal
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetCol = 0;
    const widthsBefore = getColumnWidths(this.table);
    const heightsBefore = getRowHeights(this.table);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const col = cellIndex % widthsBefore.length;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widthsBefore.length - 1)));
    }
    const removedIndex = Math.max(0, heightsBefore.length - 1);
    structRemoveLastRow(this.table);
    render(this.table);
    const heightsAfter = getRowHeights(this.table);
    if (heightsAfter.length > 0) {
      const targetRow = Math.min(removedIndex, heightsAfter.length - 1);
      this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
    }
  }

  addColumn(): void {
    // Capture selected row (if any) before insertion
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetRow = 0;
    if (sel) {
      const heights = getRowHeights(this.table);
      const widths = getColumnWidths(this.table);
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const row = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
      targetRow = Math.max(0, Math.min(row, Math.max(0, heights.length - 1)));
    }
    structAddColumn(this.table);
    render(this.table);
    const colIndex = Math.max(0, getColumnWidths(this.table).length - 1);
    this.focusEditableInCell(getCell(this.table, targetRow, colIndex));
  }

  removeLastColumn(): void {
    // Capture target row from current selection, and last column index before removal
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetRow = 0;
    const heightsBefore = getRowHeights(this.table);
    const widthsBefore = getColumnWidths(this.table);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const row = Math.floor(cellIndex / Math.max(1, widthsBefore.length));
      targetRow = Math.max(0, Math.min(row, Math.max(0, heightsBefore.length - 1)));
    }
    const removedIndex = Math.max(0, widthsBefore.length - 1);
    structRemoveLastColumn(this.table);
    render(this.table);
    const widthsAfter = getColumnWidths(this.table);
    if (widthsAfter.length > 0) {
      const targetCol = Math.min(removedIndex, widthsAfter.length - 1);
      this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
    }
  }

  // Positioned structure ops
  addRowAt(index: number): void {
    // Capture selected column (if any) before insertion
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetCol = 0;
    if (sel) {
      const widths = getColumnWidths(this.table);
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const col = widths.length > 0 ? cellIndex % widths.length : 0;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widths.length - 1)));
    }
    structAddRowAt(this.table, index);
    render(this.table);
    this.focusEditableInCell(getCell(this.table, index, targetCol));
  }

  addColumnAt(index: number): void {
    // Capture selected row (if any) before insertion
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetRow = 0;
    if (sel) {
      const heights = getRowHeights(this.table);
      const widths = getColumnWidths(this.table);
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const row = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
      targetRow = Math.max(0, Math.min(row, Math.max(0, heights.length - 1)));
    }
    structAddColumnAt(this.table, index);
    render(this.table);
    this.focusEditableInCell(getCell(this.table, targetRow, index));
  }

  removeRowAt(index: number): void {
    // Capture selected column from current selection prior to removal
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetCol = 0;
    const widthsBefore = getColumnWidths(this.table);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const col = cellIndex % widthsBefore.length;
      targetCol = Math.max(0, Math.min(col, Math.max(0, widthsBefore.length - 1)));
    }
    structRemoveRowAt(this.table, index);
    render(this.table);
    const heightsAfter = getRowHeights(this.table);
    if (heightsAfter.length > 0) {
      const targetRow = Math.min(index, heightsAfter.length - 1);
      this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
    }
  }

  removeColumnAt(index: number): void {
    // Capture selected row from current selection prior to removal
    const sel = this.table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
    let targetRow = 0;
    const widthsBefore = getColumnWidths(this.table);
    const heightsBefore = getRowHeights(this.table);
    if (sel && widthsBefore.length > 0) {
      const cellIndex = Array.from(this.table.children).indexOf(sel);
      const row = Math.floor(cellIndex / Math.max(1, widthsBefore.length));
      targetRow = Math.max(0, Math.min(row, Math.max(0, heightsBefore.length - 1)));
    }
    structRemoveColumnAt(this.table, index);
    render(this.table);
    const widthsAfter = getColumnWidths(this.table);
    if (widthsAfter.length > 0) {
      const targetCol = Math.min(index, widthsAfter.length - 1);
      this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
    }
  }

  // Column/Row sizing with history integration
  setColumnWidth(index: number, value: string): void {
    const perform = () => {
      const widths = getColumnWidths(this.table);
      if (index < 0 || index >= widths.length) return;
      widths[index] = value;
      setColumnWidths(this.table, widths);
    };
    tableHistoryManager.addHistoryEntry(this.table, `Set Column ${index} Width`, perform);
    render(this.table);
  }

  setRowHeight(index: number, value: string): void {
    const perform = () => {
      const heights = getRowHeights(this.table);
      if (index < 0 || index >= heights.length) return;
      heights[index] = value;
      setRowHeights(this.table, heights);
    };
    tableHistoryManager.addHistoryEntry(this.table, `Set Row ${index} Height`, perform);
    render(this.table);
  }

  // Getters to read current specs for UI
  getRowHeight(index: number): string | null {
    const heights = getRowHeights(this.table);
    return index >= 0 && index < heights.length ? heights[index] : null;
  }

  getColumnWidth(index: number): string | null {
    const widths = getColumnWidths(this.table);
    return index >= 0 && index < widths.length ? widths[index] : null;
  }

  getSpan(cell: HTMLElement): { x: number; y: number } {
    return getSpan(cell);
  }

  // Borders are modeled via unified edge arrays; callers should use table-model setEdgesH/V helpers directly.

  setTableCorners(radiusPx: number): void {
    const perform = () => setTableCorners(this.table, { radius: radiusPx });
    tableHistoryManager.addHistoryEntry(this.table, "Set Table Corners", perform);
    render(this.table);
  }

  // Spans: write data-*, and call structure's setCellSpan to maintain skip semantics today
  setSpan(cell: HTMLElement, x: number, y: number): void {
    const perform = () => {
      setSpan(cell, { x, y });
      // maintain skip coverage using existing structure helper (also sets CSS vars for now)
      structSetCellSpan(cell, x, y);
    };
    tableHistoryManager.addHistoryEntry(this.table, `Set Cell Span ${x}x${y}`, perform);
    render(this.table);
  }
}

export default BloomTable;
