import React, { useState, useEffect } from "react";

import TableSection from "./TableSection";
import RowSection from "./RowSection";
import ColumnSection from "./ColumnSection";
import CellSection from "./CellSection";
import { TableApi, TableApiContext, defaultTableApi } from "./TableApiContext";
import {
  ColorPickerComponent,
  ColorPickerContext,
  DefaultColorPicker,
} from "./ColorPickerContext";

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

  useEffect(() => {
    const handler = () => {
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

  const getTargetTableFromSelection = (): HTMLElement => {
    // Using currentCell is more reliable than document.activeElement,
    // because focus can move to the menu itself when we click a menu item.
    const table = currentCell!.closest(".bloom-table") as HTMLElement;
    return table;
  };
  const getTargetTableFromCell = (cell: HTMLElement): HTMLElement => {
    // Using currentCell is more reliable than document.activeElement,
    // because focus can move to the menu itself when we click a menu item.
    const table = cell.closest(".bloom-table") as HTMLElement;
    return table;
  };
  const handleSetCellContentType = (contentTypeId: string) => {
    assert(!!currentCell, "No cell selected");
    api.setupContentsOfCell(currentCell!, contentTypeId, true);
  };

  const handleExtendCell = () => {
    assert(!!currentCell, "No cell selected");
    const table = getTargetTableFromCell(currentCell!);
    const controller = new api.BloomTable(table);
    const current = controller.getSpan(currentCell!);
    controller.setSpan(currentCell!, (current.x || 1) + 1, current.y || 1);
  };

  const handleContractCell = () => {
    assert(!!currentCell, "No cell selected");
    const table = getTargetTableFromCell(currentCell!);
    const controller = new api.BloomTable(table);
    const current = controller.getSpan(currentCell!);
    const nextX = Math.max(1, (current.x || 1) - 1);
    controller.setSpan(currentCell!, nextX, current.y || 1);
  };
  const handleInsertRowAbove = () => {
    const table = getTargetTableFromSelection();
    const rowIndex = api.getRowIndex(currentCell!);
    const controller = new api.BloomTable(table);
    controller.addRowAt(rowIndex);
  };
  const handleInsertRowBelow = () => {
    const table = getTargetTableFromSelection();
    const rowIndex = api.getRowIndex(currentCell!);
    const controller = new api.BloomTable(table);
    controller.addRowAt(rowIndex + 1);
  };
  const handleDeleteRow = () => {
    const table = getTargetTableFromSelection();
    const rowIndex = api.getRowIndex(currentCell!);
    const controller = new api.BloomTable(table);
    controller.removeRowAt(rowIndex);
  };
  const handleInsertColumnLeft = () => {
    const table = getTargetTableFromCell(currentCell!); // TODO doesn't have cell param
    const columnIndex = api.getRowAndColumn(table, currentCell!).column;
    const controller = new api.BloomTable(table);
    controller.addColumnAt(columnIndex);
  };

  const handleInsertColumnRight = () => {
    const cell = currentCell!;
    const table = getTargetTableFromCell(cell);
    const columnIndex = api.getRowAndColumn(table, cell).column;
    const controller = new api.BloomTable(table);
    controller.addColumnAt(columnIndex + 1);
  };

  const handleDeleteColumn = () => {
    const table = getTargetTableFromSelection();
    const columnIndex = api.getRowAndColumn(table, currentCell!).column;
    const controller = new api.BloomTable(table);
    controller.removeColumnAt(columnIndex);
  };

  const handleSelectParentCell = () => {
    const table = getTargetTableFromSelection();
    const parentCell = table.parentElement?.closest(".bloom-cell") as HTMLElement | null;
    if (parentCell) {
      parentCell.focus();
    }
  };
  const handleUndo = () => {
    const table = currentCell ? getTargetTableFromSelection() : null;
    if (!table) return;
    api.undoLastOperation(table);
  };

  // (Old border toggle handlers removed in favor of BorderControl)

  const table = currentCell ? getTargetTableFromSelection() : undefined;
  const parentCell = table?.parentElement?.closest(".bloom-cell");

  // When there's no selected cell (or it isn't inside a table), there's nothing
  // for the cell/row/column/table controls to act on. We still render them, but
  // visibly disabled, with a hint to click a cell.
  const hasContext = !!currentCell && !!currentCell.closest(".bloom-table");

  const ColorPicker = props.colorPicker ?? DefaultColorPicker;

  return (
    <TableApiContext.Provider value={api}>
    <ColorPickerContext.Provider value={ColorPicker}>
    <div
      className="table-menu border border-gray-300 rounded-md shadow-lg w-64 z-10 p-2.5"
      style={{
        backgroundColor: "#2E2E2E",
        color: "rgba(255,255,255,0.95)",
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
          onInsertAbove={handleInsertRowAbove}
          onInsertBelow={handleInsertRowBelow}
          onDelete={handleDeleteRow}
        />

        <ColumnSection
          table={table}
          currentCell={currentCell}
          onInsertLeft={handleInsertColumnLeft}
          onInsertRight={handleInsertColumnRight}
          onDelete={handleDeleteColumn}
        />
        <CellSection
          currentCell={currentCell}
          onSetContentType={handleSetCellContentType}
          onExtend={handleExtendCell}
          onContract={handleContractCell}
        />
      </div>

      {/* Top actions: Undo + Select Parent */}
      <div className="flex items-center gap-2 px-2 pb-2 border-gray-200 mb-2">
        <button
          className="px-2 py-1 rounded-md text-sm"
          style={{
            backgroundColor: api.canUndo() && table ? "#2D8294" : "#555",
            color: "rgba(255,255,255,0.95)",
            cursor: api.canUndo() && table ? "pointer" : "not-allowed",
            opacity: api.canUndo() && table ? 1 : 0.6,
          }}
          disabled={!api.canUndo() || !table}
          onClick={handleUndo}
        >
          Undo
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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

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