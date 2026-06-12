import React, { useState, useEffect } from "react";
import * as Grid from "../";

interface SelectedCellInfoProps {
  updateTrigger?: any; // Optional prop that can be used to trigger updates
}

const SelectedCellInfo: React.FC<SelectedCellInfoProps> = ({ updateTrigger }) => {
  const [cellInfo, setCellInfo] = useState<{
    selected: boolean;
    row: number;
    column: number;
    spanX: number;
    spanY: number;
  }>({
    selected: false,
    row: -1,
    column: -1,
    spanX: 1,
    spanY: 1,
  });

  const updateSelectedCellInfo = () => {
    const grid = Grid.getTargetGrid();
    if (!grid) {
      setCellInfo({
        selected: false,
        row: -1,
        column: -1,
        spanX: 1,
        spanY: 1,
      });
      return;
    }

    const selectedCell = document.activeElement?.closest(".cell") as HTMLElement;
    if (!selectedCell) {
      setCellInfo({
        selected: false,
        row: -1,
        column: -1,
        spanX: 1,
        spanY: 1,
      });
      return;
    }

    // Get cell position information
    const { row, column } = Grid.getRowAndColumn(grid, selectedCell);
    const spanX = parseInt(selectedCell.style.getPropertyValue("--span-x")) || 1;
    const spanY = parseInt(selectedCell.style.getPropertyValue("--span-y")) || 1;

    setCellInfo({
      selected: true,
      row,
      column,
      spanX,
      spanY,
    });
  };

  useEffect(() => {
    // Update initial state
    updateSelectedCellInfo();

    // Listen for focus changes to update cell info
    const handleFocusChange = () => {
      updateSelectedCellInfo();
    };

    // Listen for grid history updates which may affect selection
    const handleGridHistoryUpdated = () => {
      updateSelectedCellInfo();
    };

    // Add event listeners
    document.addEventListener("focusin", handleFocusChange);
    document.addEventListener("focusout", handleFocusChange);
    document.addEventListener("gridHistoryUpdated", handleGridHistoryUpdated);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChange);
      document.removeEventListener("gridHistoryUpdated", handleGridHistoryUpdated);
    };
  }, [updateTrigger]); // Re-attach listeners if updateTrigger changes

  if (!cellInfo.selected) {
    return (
      <div className="selected-cell-info">
        <div className="p-2 mb-2 bg-gray-100 rounded">
          <p>No cell selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="selected-cell-info">
      <div className="p-2 mb-2 bg-gray-100 rounded flex gap-4">
        <div>
          <span className="font-medium">Selected: </span>
          <span>
            Row {cellInfo.row + 1}, Column {cellInfo.column + 1}
          </span>
        </div>
        <div>
          <span className="font-medium">Size: </span>
          <span>
            {cellInfo.spanX} × {cellInfo.spanY} cells
          </span>
        </div>
      </div>
    </div>
  );
};

export default SelectedCellInfo;
