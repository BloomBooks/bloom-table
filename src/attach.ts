import { dragToResize } from "./drag-to-resize";
import { tableHistoryManager } from "./history";
import { addColumn, addRow } from "./structure";
import { migrateTable } from "./migrate";
import { attachTextEditing } from "./text-editing";
import { render } from "./table-renderer";
import { ensureSelectionHighlighting } from "./selection-highlight";
import { ensureTableSizeButtons } from "./table-size-buttons";

export function attachTable(tableDiv: HTMLElement): void {
  if (!tableDiv) throw new Error("Table element is required");

  // Ensure the table has the correct class and attributes
  tableDiv.classList.add("table");
  // Install global selection highlighter once
  ensureSelectionHighlighting();
  // Install global table size buttons once
  ensureTableSizeButtons();
  if (!tableDiv.hasAttribute("data-column-widths")) {
    tableDiv.setAttribute("data-column-widths", "");
    // add two columns by default
    addColumn(tableDiv, true);
    addColumn(tableDiv, true);
  }
  if (!tableDiv.hasAttribute("data-row-heights")) {
    tableDiv.setAttribute("data-row-heights", "");
    // add two rows by default
    addRow(tableDiv, true);
    addRow(tableDiv, true);
  }
  // todo do a sanity check on the tableDiv to ensure it has the right structure
  migrateTable(tableDiv);

  // Attach the table to the history manager
  tableHistoryManager.attachTable(tableDiv);
  // Attach resize handlers
  dragToResize.attach(tableDiv);

  attachTextEditing(tableDiv);

  // Apply initial render so styles (borders, corners, spans) are applied immediately
  render(tableDiv);
}

export function detachTable(tableDiv: HTMLElement): void {
  if (!tableDiv) throw new Error("Table element is required");

  // Detach from history manager
  tableHistoryManager.detachTable(tableDiv);
  // Detach resize handlers
  dragToResize.detach(tableDiv);
}