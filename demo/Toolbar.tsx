import React, { useState, useEffect } from "react";
import TableMenu from "../src/components/TableMenu";
import { tableHistoryManager } from "../src";

const Toolbar: React.FC<{}> = () => {
  const [currentCell, setCurrentCell] = useState<HTMLDivElement | null>(null);
  const [canUndo, setCanUndo] = useState(tableHistoryManager.canUndo());
  const [lastOperation, setLastOperation] = useState(tableHistoryManager.getLastOperationLabel());

  useEffect(() => {
    const handleHistoryUpdate = () => {
      setCanUndo(tableHistoryManager.canUndo());
      setLastOperation(tableHistoryManager.getLastOperationLabel());
    };

    document.addEventListener("tableHistoryUpdated", handleHistoryUpdate);

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
      document.removeEventListener("tableHistoryUpdated", handleHistoryUpdate);
      document.removeEventListener("focusin", handleCellFocus, true);
    };
  }, []);

  const isUndoable = canUndo && currentCell;
  const undoLabel = canUndo && lastOperation ? `Undo: ${lastOperation}` : "Undo";

  return (
    <>
      <TableMenu currentCell={currentCell} />
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          disabled={!isUndoable}
          onMouseDown={(e) => e.preventDefault()} // Prevent default to avoid losing focus
          onClick={() => {
            if (currentCell) {
              tableHistoryManager.undo(currentCell!.closest(".table") as HTMLElement);
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
