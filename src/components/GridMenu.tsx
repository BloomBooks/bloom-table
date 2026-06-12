import React, { useState, useEffect } from "react";
import * as Grid from "../";
import { BloomGrid } from "../";
import { setupContentsOfCell } from "../cell-contents";

import TableSection from "./TableSection";
import RowSection from "./RowSection";
import ColumnSection from "./ColumnSection";
import CellSection from "./CellSection";

const GridMenu: React.FC<{ currentCell: HTMLElement | null | undefined }> = (props) => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handler = () => {
      // Force a re-render when the grid history is updated
      forceUpdate((x) => x + 1);
    };
    document.addEventListener("gridHistoryUpdated", handler);
    return () => document.removeEventListener("gridHistoryUpdated", handler);
  }, []);

  useEffect(() => {
    if (!props.currentCell) return;
    const grid = props.currentCell.closest(".grid");
    if (!grid) return;

    const observer = new MutationObserver(() => {
      forceUpdate((x) => x + 1);
    });

    // We're interested in when the grid's columns change, which is stored
    // in the data-column-widths attribute. We also watch style in case
    // other things change that should cause a re-render.
    observer.observe(grid, {
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
  }, [props.currentCell]);

  const getTargetGridFromSelection = (): HTMLElement => {
    // Using props.currentCell is more reliable than document.activeElement,
    // because focus can move to the menu itself when we click a menu item.
    const grid = props.currentCell!.closest(".grid") as HTMLElement;
    return grid;
  };
  const getTargetGridFromCell = (cell: HTMLElement): HTMLElement => {
    // Using props.currentCell is more reliable than document.activeElement,
    // because focus can move to the menu itself when we click a menu item.
    const grid = cell.closest(".grid") as HTMLElement;
    return grid;
  };
  const handleSetCellContentType = (contentTypeId: string) => {
    assert(!!props.currentCell, "No cell selected");
    setupContentsOfCell(props.currentCell!, contentTypeId, true);
  };

  const handleExtendCell = () => {
    assert(!!props.currentCell, "No cell selected");
    const grid = getTargetGridFromCell(props.currentCell!);
    const controller = new BloomGrid(grid);
    const current = controller.getSpan(props.currentCell!);
    controller.setSpan(props.currentCell!, (current.x || 1) + 1, current.y || 1);
  };

  const handleContractCell = () => {
    assert(!!props.currentCell, "No cell selected");
    const grid = getTargetGridFromCell(props.currentCell!);
    const controller = new BloomGrid(grid);
    const current = controller.getSpan(props.currentCell!);
    const nextX = Math.max(1, (current.x || 1) - 1);
    controller.setSpan(props.currentCell!, nextX, current.y || 1);
  };
  const handleInsertRowAbove = () => {
    const grid = getTargetGridFromSelection();
    const rowIndex = Grid.getRowIndex(props.currentCell!);
    const controller = new BloomGrid(grid);
    controller.addRowAt(rowIndex);
  };
  const handleInsertRowBelow = () => {
    const grid = getTargetGridFromSelection();
    const rowIndex = Grid.getRowIndex(props.currentCell!);
    const controller = new BloomGrid(grid);
    controller.addRowAt(rowIndex + 1);
  };
  const handleDeleteRow = () => {
    const grid = getTargetGridFromSelection();
    const rowIndex = Grid.getRowIndex(props.currentCell!);
    const controller = new BloomGrid(grid);
    controller.removeRowAt(rowIndex);
  };
  const handleInsertColumnLeft = () => {
    const grid = getTargetGridFromCell(props.currentCell!); // TODO doesn't have cell param
    const columnIndex = Grid.getRowAndColumn(grid, props.currentCell!).column;
    const controller = new BloomGrid(grid);
    controller.addColumnAt(columnIndex);
  };

  const handleInsertColumnRight = () => {
    const cell = props.currentCell!;
    const grid = getTargetGridFromCell(cell);
    const columnIndex = Grid.getRowAndColumn(grid, cell).column;
    const controller = new BloomGrid(grid);
    controller.addColumnAt(columnIndex + 1);
  };

  const handleDeleteColumn = () => {
    const grid = getTargetGridFromSelection();
    const columnIndex = Grid.getRowAndColumn(grid, props.currentCell!).column;
    const controller = new BloomGrid(grid);
    controller.removeColumnAt(columnIndex);
  };

  const handleSelectParentCell = () => {
    const grid = getTargetGridFromSelection();
    const parentCell = grid.parentElement?.closest(".cell") as HTMLElement | null;
    if (parentCell) {
      parentCell.focus();
    }
  };
  const handleUndo = () => {
    const grid = props.currentCell ? getTargetGridFromSelection() : null;
    if (!grid) return;
    Grid.undoLastOperation(grid);
  };

  // (Old border toggle handlers removed in favor of BorderControl)

  const grid = props.currentCell ? getTargetGridFromSelection() : undefined;
  const parentCell = grid?.parentElement?.closest(".cell");

  // no-op placeholder removed: variable was unused
  // If there's no current context (no selected cell or not within a grid),
  // show an instructional message instead of the full menu.
  const hasContext = !!props.currentCell && !!props.currentCell.closest(".grid");
  if (!hasContext) {
    return (
      <div
        className="grid-menu border border-gray-300 rounded-md shadow-lg w-64 z-10 p-2.5"
        style={{ backgroundColor: "#2E2E2E", color: "rgba(255,255,255,0.95)" }}
      >
        Click in any table cell.
      </div>
    );
  }

  return (
    <div
      className="grid-menu border border-gray-300 rounded-md shadow-lg w-64 z-10 p-2.5"
      /* if haveSelectedCell is false, dim/disable the menu */
      style={{
        backgroundColor: "#2E2E2E",
        color: "rgba(255,255,255,0.95)",
        opacity: !!props.currentCell ? 1 : 0.5,
        pointerEvents: !!props.currentCell ? "auto" : "none",
      }}

      // onMouseDown, store the current document selection in a react state. Then onMouseUp, restore the selection.
      // TODO
    >
      {/* Table section */}
      <TableSection grid={grid} />
      <RowSection
        grid={grid}
        currentCell={props.currentCell}
        onInsertAbove={handleInsertRowAbove}
        onInsertBelow={handleInsertRowBelow}
        onDelete={handleDeleteRow}
      />

      <ColumnSection
        grid={grid}
        currentCell={props.currentCell}
        onInsertLeft={handleInsertColumnLeft}
        onInsertRight={handleInsertColumnRight}
        onDelete={handleDeleteColumn}
      />
      <CellSection
        currentCell={props.currentCell}
        onSetContentType={handleSetCellContentType}
        onExtend={handleExtendCell}
        onContract={handleContractCell}
      />

      {/* Top actions: Undo + Select Parent */}
      <div className="flex items-center gap-2 px-2 pb-2 border-gray-200 mb-2">
        <button
          className="px-2 py-1 rounded-md text-sm"
          style={{
            backgroundColor: Grid.canUndo() && grid ? "#2D8294" : "#555",
            color: "rgba(255,255,255,0.95)",
            cursor: Grid.canUndo() && grid ? "pointer" : "not-allowed",
            opacity: Grid.canUndo() && grid ? 1 : 0.6,
          }}
          disabled={!Grid.canUndo() || !grid}
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
  // Store the grid reference
  const gridRef = useRef<HTMLElement | null>(null);

  // Helper function to get grid state information
  const getGridState = (grid: HTMLElement | null) => {
    if (!grid) return { rowCount: 0, columnCount: 0, hasBorders: false };

    const rowHeightsAttr = grid.getAttribute("data-row-heights");
    const rowCount = rowHeightsAttr ? rowHeightsAttr.split(",").length : 0;

    const columnWidthsAttr = grid.getAttribute("data-column-widths");
    const columnCount = columnWidthsAttr
      ? columnWidthsAttr.split(",").length
      : 0;

    const borderWidth =
      grid.style.getPropertyValue("--cell-border-width") ||
      getComputedStyle(grid).getPropertyValue("--cell-border-width");
    const hasBorders = borderWidth !== "0px" && borderWidth !== "0";

    return { rowCount, columnCount, hasBorders };
  }; // Update all UI state based on current grid
  const updateUIState = () => {
    const grid = Grid.getTargetGrid();
    gridRef.current = grid;
    const { rowCount, columnCount, hasBorders } = getGridState(grid);

    setCanUndo(Grid.canUndo());
    setCanRemoveRow(rowCount > 1);
    setCanRemoveColumn(columnCount > 1);
    setShowBorders(hasBorders);
    // we can always add rows/columns if we have the focus is in a grid
    setCanAddColumn(!!grid);
    setCanAddRow(!!grid);

    // Check if a cell is selected and update our stored reference
    const currentlyFocusedCell = document.activeElement?.closest(
      ".cell"
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

export default GridMenu;
