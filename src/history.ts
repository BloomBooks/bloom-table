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
  // Populated only while the entry sits on the redo stack: the table's full
  // state at the moment undo ran, which is what redo restores. Captured at
  // undo time (not entry-creation time) so redo also brings back mutations
  // that never entered history (typing) and works for entries whose
  // performOperation was a no-op (drag-to-resize applies during the preview).
  redoState?: TableState;
}

// Restoring a snapshot rewrites the table's innerHTML, so every NESTED table it
// contains comes back as fresh elements nobody ever attached: they render but
// cannot be edited. The fix is to attach them again after each restore, and
// attachTable lives in attach.ts — which imports this module, so importing it
// back would close a cycle. attach.ts registers its re-attacher at load time
// instead, the same indirection paint-format uses (setPaintFormatExiter).
let restoreReattacher: (table: HTMLElement) => void = () => {};
export function setRestoreReattacher(fn: (table: HTMLElement) => void): void {
  restoreReattacher = fn;
}

class TableHistoryManager {
  private history: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  // Cap is per table, not global: one busy table must not evict another
  // table's entries.
  private maxEntriesPerTable: number = 50;
  private attachedTables = new Set<HTMLElement>();
  private operationInProgress = false; // Prevents nested or concurrent operations

  // For testing purposes only
  reset(): void {
    this.history = [];
    this.redoStack = [];
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

  // Same view over the redo stack.
  getRedoEntriesForDebug(): { label: string; timestamp: number; tableInDom: boolean }[] {
    return this.redoStack.map((e) => ({
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
      // Evict the oldest entry belonging to THIS table when over its cap. (A
      // global shift here could evict another table's oldest entry just
      // because this table was busy.)
      let countForTable = this.history.filter((e) => e.table === topLevelTable).length;
      while (countForTable > this.maxEntriesPerTable) {
        const oldest = this.history.findIndex((e) => e.table === topLevelTable);
        this.history.splice(oldest, 1);
        countForTable--;
      }
      // A new operation invalidates redo for this table only. Operations on
      // one table cannot change another table's state (per-table ownership),
      // so other tables' redo entries stay valid and remain.
      this.redoStack = this.redoStack.filter((e) => e.table !== topLevelTable);
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
          detail: { operation: description, canUndo: this.canUndo(), canRedo: this.canRedo() },
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
      // Capture the table's CURRENT state before undoing, so redo can return
      // the user to exactly the state this undo destroys — including mutations
      // that never entered history (typing) and changes an entry's no-op
      // performOperation didn't make (drag-to-resize applies during the
      // preview). See HistoryEntry.redoState.
      entry.redoState = this.captureTableState(entry.table ?? topLevelTable);
      const undoOp =
        entry.undoOperation || ((table, state) => this.defaultUndoOperation(table, state));
      // Apply to the table the snapshot came from (checked above to be the
      // caller's top-level table).
      undoOp(entry.table ?? topLevelTable, entry.state);
      this.reattachRestoredTables(entry.table ?? topLevelTable);
      undoSuccess = true;
      this.redoStack.push(entry);
    } catch (error) {
      console.error("TableHistoryManager: Error during undo operation:", error);
      // Put the entry back since the undo failed
      entry.redoState = undefined;
      this.history.push(entry);
    } finally {
      this.operationInProgress = false;
      const event = new CustomEvent("tableHistoryUpdated", {
        detail: {
          operation: `Undo ${entry.label}`,
          undoSuccess: undoSuccess,
          canUndo: this.canUndo(),
          canRedo: this.canRedo(),
        },
      });
      document.dispatchEvent(event);
    }
    return undoSuccess;
  }

  // Reapply the most recently undone operation on `table`. Restores the full
  // snapshot captured when undo ran (entry.redoState) via the default
  // attribute+innerHTML restore: custom undoOperation functions (the selective
  // restores in drag-to-resize) are undo-only, and the full-state restore is
  // correct here because redoState is a complete snapshot taken from the very
  // table it is restored to.
  //
  // As with undo, the restore rebuilds any NESTED table as fresh elements, so
  // reattachRestoredTables gives them their behavior back afterwards. The old
  // elements stay pinned in the attached-table sets.
  redo(table: HTMLElement): boolean {
    if (!this.canRedo()) {
      console.warn(
        "TableHistoryManager: Cannot redo. Either the redo stack is empty or an operation is in progress.",
      );
      return false;
    }

    const topLevelTable = this.findTopLevelTable(table);
    if (!topLevelTable || !this.isAttached(topLevelTable)) {
      console.warn("TableHistoryManager: Cannot redo. Top-level table not found or not attached.");
      return false;
    }

    // Same ownership rule as undo: the newest redo entry may belong to a
    // different table than the caller's; refuse, leaving the entry in place.
    const newestEntry = this.redoStack[this.redoStack.length - 1];
    if (newestEntry.table && newestEntry.table !== topLevelTable) {
      console.warn(
        "TableHistoryManager: Cannot redo. The most recent undone operation belongs to a different table.",
      );
      return false;
    }

    const entry = this.redoStack.pop();
    if (!entry) {
      console.warn("TableHistoryManager: Redo stack is empty, cannot redo.");
      return false;
    }
    if (!entry.redoState) {
      // Defensive: every entry gets a redoState when undo moves it here.
      console.warn(
        `TableHistoryManager: Dropping redo entry "${entry.label}" because it has no captured state.`,
      );
      return false;
    }

    this.operationInProgress = true;
    let redoSuccess = false;
    try {
      this.defaultUndoOperation(entry.table ?? topLevelTable, entry.redoState);
      this.reattachRestoredTables(entry.table ?? topLevelTable);
      redoSuccess = true;
      // The redo was the most recent mutation, so the entry becomes the newest
      // history entry again. Drop the snapshot so it can never be reused stale.
      entry.redoState = undefined;
      this.history.push(entry);
    } catch (error) {
      console.error("TableHistoryManager: Error during redo operation:", error);
      // Put the entry back since the redo failed
      this.redoStack.push(entry);
    } finally {
      this.operationInProgress = false;
      const event = new CustomEvent("tableHistoryUpdated", {
        detail: {
          operation: `Redo ${entry.label}`,
          redoSuccess: redoSuccess,
          canUndo: this.canUndo(),
          canRedo: this.canRedo(),
        },
      });
      document.dispatchEvent(event);
    }
    return redoSuccess;
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

  // Redo the most recently undone operation without the caller needing to hold
  // a table reference; mirrors undoLast(). With eager pruning on detach, the
  // dropping below is a backstop for entries whose table was never recorded.
  redoLast(): boolean {
    if (!this.canRedo()) return false;
    while (this.redoStack.length > 0) {
      const entry = this.redoStack[this.redoStack.length - 1];
      if (entry.table && this.isAttached(entry.table)) {
        return this.redo(entry.table);
      }
      console.warn(
        `TableHistoryManager: Dropping redo entry "${entry.label}" because its table is no longer attached.`,
      );
      this.redoStack.pop();
    }
    return false;
  }

  attachTable(table: HTMLElement): void {
    this.attachedTables.add(table);
    //console.info("TableHistoryManager: Table attached.");
  }

  detachTable(table: HTMLElement): void {
    this.attachedTables.delete(table);
    // Eagerly prune the detached table's entries from both stacks, so
    // canUndo()/canRedo() stay truthful the moment the table leaves (no lazy
    // discovery in undoLast). Entries are always keyed to the TOP-LEVEL table,
    // so detaching a nested table removes nothing belonging to its outer table.
    const before = this.history.length + this.redoStack.length;
    this.history = this.history.filter((e) => e.table !== table);
    this.redoStack = this.redoStack.filter((e) => e.table !== table);
    if (this.history.length + this.redoStack.length < before) {
      const event = new CustomEvent("tableHistoryUpdated", {
        detail: { operation: "Detach Table", canUndo: this.canUndo(), canRedo: this.canRedo() },
      });
      document.dispatchEvent(event);
    }
  }

  isAttached(table: HTMLElement): boolean {
    return this.attachedTables.has(table);
  }

  // With no argument: is there anything on the stack at all (legacy meaning).
  // With a table: would undo(table) actually do something — the newest entry
  // must belong to this table's top-level table and that table must be
  // attached. Without this, a menu shows Undo enabled while the newest entry
  // belongs to another table and the click silently no-ops.
  canUndo(table?: HTMLElement): boolean {
    if (!table) {
      return this.history.length > 0 && !this.operationInProgress;
    }
    const e = this.history[this.history.length - 1];
    const top = this.findTopLevelTable(table);
    // The !e.table branch keeps legacy entries (no table recorded) undoable
    // from anywhere, matching undo()'s behavior for such entries.
    return !!e && !this.operationInProgress && this.isAttached(top) && (!e.table || e.table === top);
  }

  // Same shape as canUndo, over the redo stack.
  canRedo(table?: HTMLElement): boolean {
    if (!table) {
      return this.redoStack.length > 0 && !this.operationInProgress;
    }
    const e = this.redoStack[this.redoStack.length - 1];
    const top = this.findTopLevelTable(table);
    return !!e && !this.operationInProgress && this.isAttached(top) && (!e.table || e.table === top);
  }

  getLastOperationLabel(): string | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1].label;
  }

  // Label of the operation redo() would reapply, for tooltips.
  getNextRedoLabel(): string | null {
    if (this.redoStack.length === 0) {
      return null;
    }
    return this.redoStack[this.redoStack.length - 1].label;
  }

  clearHistory(): void {
    this.history = [];
    this.redoStack = [];
    //    console.info("TableHistoryManager: History cleared.");
    // Dispatch a custom event to notify that history has been cleared
    const event = new CustomEvent("tableHistoryUpdated", {
      detail: { operation: "Clear History", canUndo: false, canRedo: false },
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

  // Give the tables inside a just-restored snapshot their behavior back. The
  // restore writes attributes and innerHTML on the SAME outer element, so that
  // element keeps its listeners; only the nested tables are new. attachTable is
  // idempotent, so a nested table a custom undoOperation left untouched is not
  // disturbed, and attaching renders each one.
  private reattachRestoredTables(table: HTMLElement): void {
    table
      .querySelectorAll<HTMLElement>(".bloom-table")
      .forEach((nested) => restoreReattacher(nested));
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
