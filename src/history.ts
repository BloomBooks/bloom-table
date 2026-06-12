export interface TableState {
  innerHTML: string;
  attributes?: Record<string, string>;
}

export interface HistoryEntry {
  state: TableState; // The state *before* the operation was performed
  timestamp: number;
  label: string;
  table?: HTMLElement; // The top-level table this entry applies to
  undoOperation?: (table: HTMLElement, prevState: TableState) => void;
}

class TableHistoryManager {
  private history: HistoryEntry[] = [];
  private maxHistorySize: number = 50;
  private attachedTables = new Set<HTMLElement>();
  private operationInProgress = false; // Prevents nested or concurrent operations

  // For testing purposes only
  reset(): void {
    this.history = [];
    this.attachedTables = new Set();
    this.operationInProgress = false;
  }
  private captureTableState(table: HTMLElement): TableState {
    const attributes: Record<string, string> = {};

    // Safely iterate through attributes
    if (table.attributes) {
      for (let i = 0; i < table.attributes.length; i++) {
        const attr = table.attributes[i];
        if (attr && attr.name) {
          attributes[attr.name] = attr.value || "";
        }
      }
    }

    return {
      innerHTML: table.innerHTML,
      attributes,
    };
  }
  addHistoryEntry(
    table: HTMLElement,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    performOperation: () => void, // The function that actually performs the DOM change
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undoOperation?: (table: HTMLElement, prevState: TableState) => void,
  ): void {
    // Find the top-level table - we may have been handed a child table, but our history is for the top-level table
    const topLevelTable = this.findTopLevelTable(table);

    if (!topLevelTable || !this.isAttached(topLevelTable)) {
      console.warn(
        "TableHistoryManager: Attempted to add history entry for a detached or null table.",
      );
      return;
    }
    if (this.operationInProgress) {
      console.warn(
        "TableHistoryManager: Operation already in progress. Skipping new history entry.",
      );
      return;
    }

    // Capture the state of the table
    const stateBeforeOperation = this.captureTableState(topLevelTable);

    this.operationInProgress = true;
    let operationSuccess = false;
    try {
      performOperation(); // Execute the actual operation
      operationSuccess = true;

      // If the operation was successful, add it to history
      const entry: HistoryEntry = {
        state: stateBeforeOperation,
        timestamp: Date.now(),
        label: description,
        table: topLevelTable,
        undoOperation: undoOperation || ((table, state) => this.defaultUndoOperation(table, state)),
      };
      this.history.push(entry);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    } catch (error) {
      console.error("TableHistoryManager: Error during operation execution:", error);
    } finally {
      this.operationInProgress = false;
      if (operationSuccess) {
        const event = new CustomEvent("tableHistoryUpdated", {
          detail: { operation: description, canUndo: this.canUndo() },
        });
        document.dispatchEvent(event);
      }
    }
  }
  undo(table: HTMLElement): boolean {
    if (!this.canUndo()) {
      console.warn(
        "TableHistoryManager: Cannot undo. Either history is empty or an operation is in progress.",
      );
      return false;
    }

    const entry = this.history.pop();
    if (!entry) {
      console.warn("TableHistoryManager: History is empty, cannot undo.");
      return false;
    }

    // Find the top-level table to ensure we're undoing on the same table level that was captured
    const topLevelTable = this.findTopLevelTable(table);
    if (!topLevelTable || !this.isAttached(topLevelTable)) {
      console.warn("TableHistoryManager: Cannot undo. Top-level table not found or not attached.");
      // Put the entry back since we couldn't undo
      this.history.push(entry);
      return false;
    }

    this.operationInProgress = true;
    let undoSuccess = false;
    try {
      const undoOp =
        entry.undoOperation || ((table, state) => this.defaultUndoOperation(table, state));
      undoOp(topLevelTable, entry.state);
      undoSuccess = true;
    } catch (error) {
      console.error("TableHistoryManager: Error during undo operation:", error);
      // Put the entry back since the undo failed
      this.history.push(entry);
    } finally {
      this.operationInProgress = false;
      const event = new CustomEvent("tableHistoryUpdated", {
        detail: {
          operation: `Undo ${entry.label}`,
          undoSuccess: undoSuccess,
          canUndo: this.canUndo(),
        },
      });
      document.dispatchEvent(event);
    }
    return undoSuccess;
  }

  // Undo the most recent operation without the caller needing to hold a table
  // reference. Uses the table recorded on the entry (falling back to any
  // attached table). Convenient for host apps wiring table undo into an app-wide
  // undo command.
  undoLast(): boolean {
    if (!this.canUndo()) return false;
    const entry = this.history[this.history.length - 1];
    const target =
      entry.table && this.isAttached(entry.table)
        ? entry.table
        : this.attachedTables.values().next().value;
    if (!target) {
      console.warn("TableHistoryManager: No attached table available to undo against.");
      return false;
    }
    return this.undo(target);
  }

  attachTable(table: HTMLElement): void {
    this.attachedTables.add(table);
    //console.info("TableHistoryManager: Table attached.");
  }

  detachTable(table: HTMLElement): void {
    this.attachedTables.delete(table);
    //console.info("TableHistoryManager: Table detached.");
  }

  isAttached(table: HTMLElement): boolean {
    return this.attachedTables.has(table);
  }

  canUndo(): boolean {
    return this.history.length > 0 && !this.operationInProgress;
  }

  getLastOperationLabel(): string | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1].label;
  }

  clearHistory(): void {
    this.history = [];
    //    console.info("TableHistoryManager: History cleared.");
    // Dispatch a custom event to notify that history has been cleared
    const event = new CustomEvent("tableHistoryUpdated", {
      detail: { operation: "Clear History" },
    });
    document.dispatchEvent(event);
  }
  private defaultUndoOperation(table: HTMLElement, prevState: TableState): void {
    // First, remove all existing attributes
    const attributesToRemove: string[] = [];
    for (let i = 0; i < table.attributes.length; i++) {
      const attr = table.attributes[i];
      if (attr && attr.name) {
        attributesToRemove.push(attr.name);
      }
    }

    // Remove attributes
    attributesToRemove.forEach((name) => {
      table.removeAttribute(name);
    });

    // Then restore the previous attributes
    if (prevState.attributes) {
      Object.entries(prevState.attributes).forEach(([name, value]) => {
        table.setAttribute(name, value);
      });
    }

    // Finally, restore the innerHTML
    table.innerHTML = prevState.innerHTML;
  }

  private findTopLevelTable(table: HTMLElement): HTMLElement {
    // Start from the current table and traverse up to find the top-level table
    let currentTable = table;
    let parentTable = currentTable.parentElement?.closest<HTMLElement>(".table");

    // Keep moving up until we find a table that has no parent table
    while (parentTable) {
      currentTable = parentTable;
      parentTable = currentTable.parentElement?.closest<HTMLElement>(".table");
    }

    return currentTable;
  }
}

export const tableHistoryManager = new TableHistoryManager();
