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

  // Read-only view of the undo stack for diagnostics (oldest first). Exposes
  // labels and timing only, not the captured states.
  getEntriesForDebug(): { label: string; timestamp: number; tableInDom: boolean }[] {
    return this.history.map((e) => ({
      label: e.label,
      timestamp: e.timestamp,
      tableInDom: !!e.table && document.body.contains(e.table),
    }));
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
  // Returns true if the operation ran to completion (and so was recorded in
  // history). If the operation throws, the table is put back the way it was and
  // false is returned, so callers can skip whatever they would have done on
  // success (e.g. notifying the host that a cell's contents changed).
  addHistoryEntry(
    table: HTMLElement,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    performOperation: () => void, // The function that actually performs the DOM change
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undoOperation?: (table: HTMLElement, prevState: TableState) => void,
  ): boolean {
    // Find the top-level table - we may have been handed a child table, but our history is for the top-level table
    const topLevelTable = this.findTopLevelTable(table);

    if (!topLevelTable || !this.isAttached(topLevelTable)) {
      console.warn(
        "TableHistoryManager: Attempted to add history entry for a detached or null table.",
      );
      return false;
    }
    if (this.operationInProgress) {
      console.warn(
        "TableHistoryManager: Operation already in progress. Skipping new history entry.",
      );
      return false;
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
      // The operation may have mutated the table before it threw. We captured
      // the pre-operation state for exactly this case, so put the table back
      // rather than leaving it half-changed with no history entry to undo.
      try {
        this.defaultUndoOperation(topLevelTable, stateBeforeOperation);
      } catch (restoreError) {
        console.error(
          "TableHistoryManager: Failed to restore the table after a failed operation:",
          restoreError,
        );
      }
    } finally {
      this.operationInProgress = false;
      if (operationSuccess) {
        const event = new CustomEvent("tableHistoryUpdated", {
          detail: { operation: description, canUndo: this.canUndo() },
        });
        document.dispatchEvent(event);
      }
    }
    return operationSuccess;
  }
  undo(table: HTMLElement): boolean {
    if (!this.canUndo()) {
      console.warn(
        "TableHistoryManager: Cannot undo. Either history is empty or an operation is in progress.",
      );
      return false;
    }

    // Find the top-level table to ensure we're undoing on the same table level that was captured
    const topLevelTable = this.findTopLevelTable(table);
    if (!topLevelTable || !this.isAttached(topLevelTable)) {
      console.warn("TableHistoryManager: Cannot undo. Top-level table not found or not attached.");
      return false;
    }

    // Every attached table shares this one undo stack, so the newest entry may
    // belong to a different table than the one the caller handed us. Applying
    // its snapshot here would replace this table's entire contents with another
    // table's markup, and that replacement would not itself be in history. So
    // refuse, leaving the entry for the table it was captured from.
    const newestEntry = this.history[this.history.length - 1];
    if (newestEntry.table && newestEntry.table !== topLevelTable) {
      console.warn(
        "TableHistoryManager: Cannot undo. The most recent operation belongs to a different table.",
      );
      return false;
    }

    const entry = this.history.pop();
    if (!entry) {
      console.warn("TableHistoryManager: History is empty, cannot undo.");
      return false;
    }

    this.operationInProgress = true;
    let undoSuccess = false;
    try {
      const undoOp =
        entry.undoOperation || ((table, state) => this.defaultUndoOperation(table, state));
      // Apply to the table the snapshot came from (checked above to be the
      // caller's top-level table).
      undoOp(entry.table ?? topLevelTable, entry.state);
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
  // reference. Acts on the table recorded on the entry. Convenient for host apps
  // wiring table undo into an app-wide undo command.
  undoLast(): boolean {
    if (!this.canUndo()) return false;
    // An entry whose table is gone (detached, or never recorded) cannot be
    // undone anywhere: its snapshot is that table's markup, so applying it to
    // some other attached table would destroy that table. Discard such entries
    // and move on to the newest one that still has its table.
    while (this.history.length > 0) {
      const entry = this.history[this.history.length - 1];
      if (entry.table && this.isAttached(entry.table)) {
        return this.undo(entry.table);
      }
      console.warn(
        `TableHistoryManager: Dropping history entry "${entry.label}" because its table is no longer attached.`,
      );
      this.history.pop();
    }
    return false;
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
    let parentTable = currentTable.parentElement?.closest<HTMLElement>(".bloom-table");

    // Keep moving up until we find a table that has no parent table
    while (parentTable) {
      currentTable = parentTable;
      parentTable = currentTable.parentElement?.closest<HTMLElement>(".bloom-table");
    }

    return currentTable;
  }
}

export const tableHistoryManager = new TableHistoryManager();
