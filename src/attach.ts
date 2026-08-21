import { dragToResize } from "./drag-to-resize";
import { tableHistoryManager } from "./history";
import { addColumn, addRow } from "./structure";
import { migrateTable } from "./migrate";
import { attachTextEditing, detachTextEditing } from "./text-editing";
import { render } from "./table-renderer";
import { ensureSelectionHighlighting } from "./selection-highlight";
import { ensureTableSizeButtons, scrubStaleAnchorNames } from "./table-size-buttons";

export function attachTable(tableDiv: HTMLElement): void {
  if (!tableDiv) throw new Error("Table element is required");

  // Ensure the table has the correct class and attributes
  tableDiv.classList.add("bloom-table");
  // Install global selection highlighter once
  ensureSelectionHighlighting();
  // Install global table size buttons once
  ensureTableSizeButtons();
  // Drop anchor names baked into saved content by a previous session — they
  // collide with this session's freshly minted ones (pills would anchor to the
  // wrong cell). Stale selection classes from a save mislead the affordances
  // the same way; focus re-establishes the real selection.
  scrubStaleAnchorNames(tableDiv);
  tableDiv.classList.remove("table--selected", "bloom-pointer-near");
  tableDiv
    .querySelectorAll(".bloom-cell.cell--selected")
    .forEach((c) => c.classList.remove("cell--selected"));
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
  // Stop rewriting Enter keypresses
  detachTextEditing(tableDiv);
}
