import React, { useState, useEffect, useRef } from "react";

import TableSection from "./TableSection";
import RowSection from "./RowSection";
import ColumnSection from "./ColumnSection";
import CellSection from "./CellSection";
import { TableApi, TableApiContext, defaultTableApi } from "./TableApiContext";
import { nextSplitSpan } from "./spanCommands";
import { ColorPickerComponent, ColorPickerContext, DefaultColorPicker } from "./ColorPickerContext";

// Room left between the bottom of the panel and the bottom of the window, so the
// panel's shadow and border are not flush against the edge.
const kPanelViewportGap = 8;
// A window too short even for this much panel is better scrolled by the host
// than shrunk to a few unusable rows.
const kPanelMinHeight = 120;

const TableMenu: React.FC<{
  currentCell: HTMLElement | null | undefined;
  // Host-supplied operations object. When the panel runs in a different realm
  // from the tables (e.g. Bloom's toolbox iframe), the host injects an api
  // built in the page frame so operations run there. Defaults to this module's
  // own functions, so the demo and same-realm hosts pass nothing.
  tableApi?: TableApi;
  // Host-supplied background-color picker for the Table/Cell "Background"
  // controls. Bloom injects its own; the demo passes its own. Falls back to a
  // plain <input type="color"> when omitted.
  colorPicker?: ColorPickerComponent;
}> = (props) => {
  // Resolve the api at the host (provider) level. We read props directly rather
  // than useTableApi() because TableMenu sits *outside* the provider it renders.
  const api: TableApi = props.tableApi ?? defaultTableApi;
  const [, forceUpdate] = useState(0);

  // Normalize whatever the host hands us to the actual cell element. A host
  // (e.g. Bloom) may pass the focused descendant of a cell (an editable child)
  // rather than the `.bloom-cell` div itself; the panel's operations assert a
  // real cell, so resolve to the nearest one. Null when not inside a cell.
  const currentCell = (props.currentCell?.closest(".bloom-cell") as HTMLElement | null) ?? null;

  // Where the selected cell sat, remembered while it is still in the document.
  // Undo replaces every cell element, so this is the only way back to it.
  const lastCellLocation = useRef<{ table: HTMLElement; row: number; column: number } | null>(null);
  // Deliberately re-read on EVERY render, not just when the cell element
  // changes: a structural operation (insert or delete a row above, a merge)
  // keeps the selected element and moves it to different coordinates, so a
  // location remembered per element goes stale and the next undo would refocus
  // whatever cell now sits at the old coordinates. Every such operation ends in
  // a tableHistoryUpdated render, so this runs before the location is needed.
  // The read is one cheap lookup, already guarded.
  useEffect(() => {
    if (!currentCell || !currentCell.isConnected) return;
    const t = currentCell.closest(".bloom-table") as HTMLElement | null;
    if (!t) return;
    try {
      const { row, column } = api.getRowAndColumn(t, currentCell);
      lastCellLocation.current = { table: t, row, column };
    } catch {
      // Cell isn't laid out (yet); leave the previous location alone.
    }
  });

  // The cell now occupying a remembered position, or the table's first cell if
  // that position no longer exists (e.g. undoing an insert removed the row).
  const findCellAt = (table: HTMLElement, row: number, column: number): HTMLElement | null => {
    const cells = Array.from(table.children).filter(
      (c): c is HTMLElement =>
        c instanceof HTMLElement &&
        c.classList.contains("bloom-cell") &&
        !c.classList.contains("bloom-skip"),
    );
    for (const c of cells) {
      try {
        const pos = api.getRowAndColumn(table, c);
        if (pos.row === row && pos.column === column) return c;
      } catch {
        // ignore cells we can't place
      }
    }
    return cells[0] ?? null;
  };

  useEffect(() => {
    const handler = () => {
      // Undo restores the table's innerHTML, which detaches every cell element,
      // and nothing refocuses afterwards. The host learns about a selection only
      // from a focusin, so without this the panel is left pointing at a detached
      // node: it greys out and the Undo button disables while history still has
      // entries, so a second undo is impossible until the user clicks a cell.
      // Put the selection back on the cell that took the old one's place.
      if (currentCell && !currentCell.isConnected) {
        const loc = lastCellLocation.current;
        const replacement =
          loc && loc.table.isConnected ? findCellAt(loc.table, loc.row, loc.column) : null;
        if (replacement) replacement.focus();
      }
      // Force a re-render when the table history is updated
      forceUpdate((x) => x + 1);
    };
    // Listen on the document that actually owns the tables. When the panel is
    // hosted cross-iframe, history events fire on the page frame's document,
    // not the toolbox frame's, so bind currentCell.ownerDocument when we have it.
    const doc = currentCell?.ownerDocument ?? document;
    doc.addEventListener("tableHistoryUpdated", handler);
    return () => doc.removeEventListener("tableHistoryUpdated", handler);
  }, [currentCell]);

  useEffect(() => {
    if (!currentCell) return;
    const table = currentCell.closest(".bloom-table");
    if (!table) return;

    const observer = new MutationObserver(() => {
      forceUpdate((x) => x + 1);
    });

    // We're interested in when the table's columns change, which is stored
    // in the data-column-widths attribute. We also watch style in case
    // other things change that should cause a re-render.
    observer.observe(table, {
      attributes: true,
      // Re-render when column widths, row heights, active drag row, or style change
      attributeFilter: [
        "data-column-widths",
        "data-row-heights",
        "data-ui-active-row-index",
        "style",
      ],
    });

    return () => {
      observer.disconnect();
    };
  }, [currentCell]);

  // Using currentCell is more reliable than document.activeElement, because
  // focus can move to the menu itself when we click a menu item. Null when
  // there is no selection to act on: every handler below returns early rather
  // than throwing, since the controls can still be reached by keyboard.
  const getTargetTableFromSelection = (): HTMLElement | null => {
    return (currentCell?.closest(".bloom-table") as HTMLElement | null) ?? null;
  };
  const getTargetTableFromCell = (cell: HTMLElement): HTMLElement | null => {
    return (cell.closest(".bloom-table") as HTMLElement | null) ?? null;
  };
  const handleSetCellContentType = (contentTypeId: string) => {
    if (!currentCell) return;
    api.setupContentsOfCell(currentCell, contentTypeId, true);
  };

  const handleExtendCell = () => {
    const table = currentCell ? getTargetTableFromCell(currentCell) : null;
    if (!currentCell || !table) return;
    const controller = new api.BloomTable(table);
    const current = controller.getSpan(currentCell);
    controller.setSpan(currentCell, (current.x || 1) + 1, current.y || 1);
  };

  const handleContractCell = () => {
    const table = currentCell ? getTargetTableFromCell(currentCell) : null;
    if (!currentCell || !table) return;
    const controller = new api.BloomTable(table);
    const current = controller.getSpan(currentCell);
    const next = nextSplitSpan(current.x, current.y);
    if (!next) return; // already 1x1; nothing to split
    controller.setSpan(currentCell, next.x, next.y);
  };
  const handleInsertRowAbove = () => {
    const table = getTargetTableFromSelection();
    if (!table || !currentCell) return;
    const rowIndex = api.getRowIndex(currentCell);
    const controller = new api.BloomTable(table);
    controller.addRowAt(rowIndex);
  };
  const handleInsertRowBelow = () => {
    const table = getTargetTableFromSelection();
    if (!table || !currentCell) return;
    const rowIndex = api.getRowIndex(currentCell);
    const controller = new api.BloomTable(table);
    controller.addRowAt(rowIndex + 1);
  };
  const handleDeleteRow = () => {
    const table = getTargetTableFromSelection();
    if (!table || !currentCell) return;
    const rowIndex = api.getRowIndex(currentCell);
    const controller = new api.BloomTable(table);
    controller.removeRowAt(rowIndex);
  };
  const handleInsertColumnLeft = () => {
    const table = getTargetTableFromSelection();
    if (!table || !currentCell) return;
    const columnIndex = api.getRowAndColumn(table, currentCell).column;
    const controller = new api.BloomTable(table);
    controller.addColumnAt(columnIndex);
  };

  const handleInsertColumnRight = () => {
    const table = getTargetTableFromSelection();
    if (!table || !currentCell) return;
    const columnIndex = api.getRowAndColumn(table, currentCell).column;
    const controller = new api.BloomTable(table);
    controller.addColumnAt(columnIndex + 1);
  };

  const handleDeleteColumn = () => {
    const table = getTargetTableFromSelection();
    if (!table || !currentCell) return;
    const columnIndex = api.getRowAndColumn(table, currentCell).column;
    const controller = new api.BloomTable(table);
    controller.removeColumnAt(columnIndex);
  };

  const handleSelectParentCell = () => {
    const table = getTargetTableFromSelection();
    const parent = table?.parentElement?.closest(".bloom-cell") as HTMLElement | null;
    if (parent) {
      parent.focus();
    }
  };
  const handleUndo = () => {
    const table = getTargetTableFromSelection();
    if (!table) return;
    api.undoLastOperation(table);
  };

  const handleRedo = () => {
    const table = getTargetTableFromSelection();
    if (!table) return;
    // Through api.BloomTable so the redo runs against the history manager of
    // the realm that owns the table (see TableApi's rationale).
    new api.BloomTable(table).redo();
  };

  // (Old border toggle handlers removed in favor of BorderControl)

  const table = getTargetTableFromSelection() ?? undefined;
  const parentCell = table?.parentElement?.closest(".bloom-cell");

  // Table-aware button state: canUndo()/canRedo() asked without a table can
  // report true while the newest entry belongs to a DIFFERENT table, in which
  // case the click would be refused and silently no-op. The controller passes
  // the table through, so the buttons only claim what a click would deliver.
  const undoRedoController = table ? new api.BloomTable(table) : null;
  const undoEnabled = !!undoRedoController && undoRedoController.canUndo();
  const redoEnabled = !!undoRedoController && undoRedoController.canRedo();

  // When there's no selected cell (or it isn't inside a table), there's nothing
  // for the cell/row/column/table controls to act on. We still render them, but
  // visibly disabled, with a hint to click a cell.
  const hasContext = !!currentCell && !!currentCell.closest(".bloom-table");

  const ColorPicker = props.colorPicker ?? DefaultColorPicker;

  // pointer-events:none hides the disabled sections from the mouse only; the
  // buttons inside are real buttons and stay in the tab order, so Tab+Enter
  // still reached their handlers. `inert` takes the whole subtree out of the tab
  // order and out of the accessibility tree. React 18 does not render the
  // attribute, so set the property.
  const inertWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = inertWrapRef.current;
    if (!el) return;
    (el as HTMLDivElement & { inert?: boolean }).inert = !hasContext;
  }, [hasContext]);

  // The panel is taller than a short window, so bound it against the viewport
  // from wherever the host placed it and let its content scroll inside. A plain
  // max-height in vh units is not enough: it ignores how far down the viewport
  // the panel starts, so the bottom of a panel placed below other content stays
  // out of reach. The measured height is written straight to the style, not held
  // in state, so a resize costs no render; a change under a pixel is ignored
  // because shrinking the panel can shorten the page, which nudges the panel's
  // own top and would otherwise feed itself.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const room = window.innerHeight - el.getBoundingClientRect().top - kPanelViewportGap;
      const next = `${Math.max(kPanelMinHeight, Math.round(room))}px`;
      if (el.style.maxHeight !== next) el.style.maxHeight = next;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("resize", schedule);
    // Capture: a scroll inside any ancestor moves the panel too, and scroll
    // events from a container do not reach window by bubbling.
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, []);

  return (
    <TableApiContext.Provider value={api}>
      <ColorPickerContext.Provider value={ColorPicker}>
        <div
          ref={panelRef}
          className="table-menu border border-gray-300 rounded-md shadow-lg w-64 z-10 p-2.5"
          style={{
            backgroundColor: "#2E2E2E",
            color: "rgba(255,255,255,0.95)",
            // Bounded before the effect above measures the real room, so a first
            // paint in a short window is never taller than the window.
            maxHeight: "100dvh",
            overflowY: "auto",
            // Declaring one axis makes the other compute to auto, which would put
            // a horizontal scrollbar under every panel; the control rows wrap, so
            // nothing needs to scroll sideways.
            overflowX: "hidden",
          }}
        >
          {!hasContext && (
            <div className="px-2 pb-2 text-sm" style={{ opacity: 0.85 }}>
              Click in a table cell to edit it.
            </div>
          )}
          {/* The per-cell/row/column/table controls only make sense with a selected
          cell; dim and disable them when there's nothing to act on. */}
          <div
            ref={inertWrapRef}
            aria-disabled={!hasContext}
            style={{
              opacity: hasContext ? 1 : 0.4,
              pointerEvents: hasContext ? "auto" : "none",
              filter: hasContext ? "none" : "grayscale(40%)",
            }}
          >
            {/* Table section */}
            <TableSection table={table} />
            <RowSection
              table={table}
              currentCell={currentCell}
              disabled={!hasContext}
              onInsertAbove={handleInsertRowAbove}
              onInsertBelow={handleInsertRowBelow}
              onDelete={handleDeleteRow}
            />

            <ColumnSection
              table={table}
              currentCell={currentCell}
              disabled={!hasContext}
              onInsertLeft={handleInsertColumnLeft}
              onInsertRight={handleInsertColumnRight}
              onDelete={handleDeleteColumn}
            />
            <CellSection
              currentCell={currentCell}
              disabled={!hasContext}
              onSetContentType={handleSetCellContentType}
              onExtend={handleExtendCell}
              onContract={handleContractCell}
            />
          </div>

          {/* Top actions: Undo + Redo + Select Parent */}
          <div className="flex items-center gap-2 px-2 pb-2 border-gray-200 mb-2">
            <button
              className="px-2 py-1 rounded-md text-sm"
              style={{
                backgroundColor: undoEnabled ? "#2D8294" : "#555",
                color: "rgba(255,255,255,0.95)",
                cursor: undoEnabled ? "pointer" : "not-allowed",
                opacity: undoEnabled ? 1 : 0.6,
              }}
              disabled={!undoEnabled}
              onClick={handleUndo}
            >
              Undo
            </button>
            <button
              className="px-2 py-1 rounded-md text-sm"
              style={{
                backgroundColor: redoEnabled ? "#2D8294" : "#555",
                color: "rgba(255,255,255,0.95)",
                cursor: redoEnabled ? "pointer" : "not-allowed",
                opacity: redoEnabled ? 1 : 0.6,
              }}
              disabled={!redoEnabled}
              onClick={handleRedo}
            >
              Redo
            </button>
            <button
              className="px-2 py-1 rounded-md text-sm"
              style={{
                backgroundColor: parentCell ? "#2D8294" : "#555",
                color: "rgba(255,255,255,0.95)",
                cursor: parentCell ? "pointer" : "not-allowed",
                opacity: parentCell ? 1 : 0.6,
              }}
              disabled={!parentCell}
              onClick={parentCell ? handleSelectParentCell : undefined}
              onMouseDown={(e) => e.preventDefault()}
            >
              Select Parent Cell
            </button>
          </div>
        </div>
      </ColorPickerContext.Provider>
    </TableApiContext.Provider>
  );
};

/*
const [canUndo, setCanUndo] = useState(false);
  const [showBorders, setShowBorders] = useState(true);
  const [canRemoveRow, setCanRemoveRow] = useState(true);
  const [canRemoveColumn, setCanRemoveColumn] = useState(true);
  const [canAddRow, setCanAddRow] = useState(true);
  const [canAddColumn, setCanAddColumn] = useState(true);
  const [selectionUpdateTrigger, setSelectionUpdateTrigger] = useState(0);
  const [cellSelected, setCellSelected] = useState(false);
  // Reference to the currently selected cell
  const selectedCellRef = useRef<HTMLElement | null>(null);
  // Store the table reference
  const tableRef = useRef<HTMLElement | null>(null);

  // Helper function to get table state information
  const getTableState = (table: HTMLElement | null) => {
    if (!table) return { rowCount: 0, columnCount: 0, hasBorders: false };

    const rowHeightsAttr = table.getAttribute("data-row-heights");
    const rowCount = rowHeightsAttr ? rowHeightsAttr.split(",").length : 0;

    const columnWidthsAttr = table.getAttribute("data-column-widths");
    const columnCount = columnWidthsAttr
      ? columnWidthsAttr.split(",").length
      : 0;

    const borderWidth =
      table.style.getPropertyValue("--cell-border-width") ||
      getComputedStyle(table).getPropertyValue("--cell-border-width");
    const hasBorders = borderWidth !== "0px" && borderWidth !== "0";

    return { rowCount, columnCount, hasBorders };
  }; // Update all UI state based on current table
  const updateUIState = () => {
    const table = Table.getTargetTable();
    tableRef.current = table;
    const { rowCount, columnCount, hasBorders } = getTableState(table);

    setCanUndo(api.canUndo());
    setCanRemoveRow(rowCount > 1);
    setCanRemoveColumn(columnCount > 1);
    setShowBorders(hasBorders);
    // we can always add rows/columns if we have the focus is in a table
    setCanAddColumn(!!table);
    setCanAddRow(!!table);

    // Check if a cell is selected and update our stored reference
    const currentlyFocusedCell = document.activeElement?.closest(
      ".bloom-cell"
    ) as HTMLElement;

    // Only update the stored reference if we actually have a focused cell
    // This preserves the last selected cell when focus moves to menu items
    if (currentlyFocusedCell) {
      selectedCellRef.current = currentlyFocusedCell;
    }

    // A cell is considered "selected" if we have a stored reference,
    // regardless of current focus
    setCellSelected(!!selectedCellRef.current);

    // Trigger an update for the selected cell info component
    setSelectionUpdateTrigger((prev) => prev + 1);
  }; // Function to restore focus to the previously selected cell
  const restoreCellFocus = () => {
    if (selectedCellRef.current) {
      selectedCellRef.current.focus();
    }
  };*/

// SizeControl moved into ColumnSection

export default TableMenu;
