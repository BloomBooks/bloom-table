import React, { useState, useEffect } from "react";
import GridMenu from "../src/components/GridMenu";
import { gridHistoryManager } from "../src";

const Toolbar: React.FC<{}> = () => {
  const [currentCell, setCurrentCell] = useState<HTMLDivElement | null>(null);
  const [canUndo, setCanUndo] = useState(gridHistoryManager.canUndo());
  const [lastOperation, setLastOperation] = useState(gridHistoryManager.getLastOperationLabel());

  useEffect(() => {
    const handleHistoryUpdate = () => {
      setCanUndo(gridHistoryManager.canUndo());
      setLastOperation(gridHistoryManager.getLastOperationLabel());
    };

    document.addEventListener("gridHistoryUpdated", handleHistoryUpdate);

    const handleCellFocus = (event: FocusEvent) => {
      const target = event.target as HTMLDivElement;
      if (target && target.closest(".cell")) {
        setCurrentCell(target.closest(".cell") as HTMLDivElement);
      }
      // Not setting to null on blur allows the menu to be used
      // without the cell losing focus.
    };

    document.addEventListener("focusin", handleCellFocus, true);

    return () => {
      document.removeEventListener("gridHistoryUpdated", handleHistoryUpdate);
      document.removeEventListener("focusin", handleCellFocus, true);
    };
  }, []);

  const isUndoable = canUndo && currentCell;
  const undoLabel = canUndo && lastOperation ? `Undo: ${lastOperation}` : "Undo";

  return (
    <>
      <GridMenu currentCell={currentCell} />
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          disabled={!isUndoable}
          onMouseDown={(e) => e.preventDefault()} // Prevent default to avoid losing focus
          onClick={() => {
            if (currentCell) {
              gridHistoryManager.undo(currentCell!.closest(".grid") as HTMLElement);
            }
          }}
          style={{
            padding: "10px 20px",
            backgroundColor: isUndoable ? "#007bff" : "#cccccc",
            color: isUndoable ? "#fff" : "#666666",
            border: "none",
            borderRadius: "5px",
            cursor: isUndoable ? "pointer" : "not-allowed",
            opacity: isUndoable ? 1 : 0.7,
          }}
        >
          {undoLabel}
        </button>
      </div>
    </>
  );
};

export default Toolbar;
