export interface GridState {
  innerHTML: string;
  attributes?: Record<string, string>;
}

export interface HistoryEntry {
  state: GridState; // The state *before* the operation was performed
  timestamp: number;
  label: string;
  undoOperation?: (grid: HTMLElement, prevState: GridState) => void;
}

class GridHistoryManager {
  private history: HistoryEntry[] = [];
  private maxHistorySize: number = 50;
  private attachedGrids = new Set<HTMLElement>();
  private operationInProgress = false; // Prevents nested or concurrent operations

  // For testing purposes only
  reset(): void {
    this.history = [];
    this.attachedGrids = new Set();
    this.operationInProgress = false;
  }
  private captureGridState(grid: HTMLElement): GridState {
    const attributes: Record<string, string> = {};

    // Safely iterate through attributes
    if (grid.attributes) {
      for (let i = 0; i < grid.attributes.length; i++) {
        const attr = grid.attributes[i];
        if (attr && attr.name) {
          attributes[attr.name] = attr.value || "";
        }
      }
    }

    return {
      innerHTML: grid.innerHTML,
      attributes,
    };
  }
  addHistoryEntry(
    grid: HTMLElement,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    performOperation: () => void, // The function that actually performs the DOM change
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undoOperation?: (grid: HTMLElement, prevState: GridState) => void,
  ): void {
    // Find the top-level grid - we may have been handed a child grid, but our history is for the top-level grid
    const topLevelGrid = this.findTopLevelGrid(grid);

    if (!topLevelGrid || !this.isAttached(topLevelGrid)) {
      console.warn(
        "GridHistoryManager: Attempted to add history entry for a detached or null grid.",
      );
      return;
    }
    if (this.operationInProgress) {
      console.warn(
        "GridHistoryManager: Operation already in progress. Skipping new history entry.",
      );
      return;
    }

    // Capture the state of the grid
    const stateBeforeOperation = this.captureGridState(topLevelGrid);

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
        undoOperation: undoOperation || ((grid, state) => this.defaultUndoOperation(grid, state)),
      };
      this.history.push(entry);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    } catch (error) {
      console.error("GridHistoryManager: Error during operation execution:", error);
    } finally {
      this.operationInProgress = false;
      if (operationSuccess) {
        const event = new CustomEvent("gridHistoryUpdated", {
          detail: { operation: description, canUndo: this.canUndo() },
        });
        document.dispatchEvent(event);
      }
    }
  }
  undo(grid: HTMLElement): boolean {
    if (!this.canUndo()) {
      console.warn(
        "GridHistoryManager: Cannot undo. Either history is empty or an operation is in progress.",
      );
      return false;
    }

    const entry = this.history.pop();
    if (!entry) {
      console.warn("GridHistoryManager: History is empty, cannot undo.");
      return false;
    }

    // Find the top-level grid to ensure we're undoing on the same grid level that was captured
    const topLevelGrid = this.findTopLevelGrid(grid);
    if (!topLevelGrid || !this.isAttached(topLevelGrid)) {
      console.warn("GridHistoryManager: Cannot undo. Top-level grid not found or not attached.");
      // Put the entry back since we couldn't undo
      this.history.push(entry);
      return false;
    }

    this.operationInProgress = true;
    let undoSuccess = false;
    try {
      const undoOp =
        entry.undoOperation || ((grid, state) => this.defaultUndoOperation(grid, state));
      undoOp(topLevelGrid, entry.state);
      undoSuccess = true;
    } catch (error) {
      console.error("GridHistoryManager: Error during undo operation:", error);
      // Put the entry back since the undo failed
      this.history.push(entry);
    } finally {
      this.operationInProgress = false;
      const event = new CustomEvent("gridHistoryUpdated", {
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

  attachGrid(grid: HTMLElement): void {
    this.attachedGrids.add(grid);
    //console.info("GridHistoryManager: Grid attached.");
  }

  detachGrid(grid: HTMLElement): void {
    this.attachedGrids.delete(grid);
    //console.info("GridHistoryManager: Grid detached.");
  }

  isAttached(grid: HTMLElement): boolean {
    return this.attachedGrids.has(grid);
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
    //    console.info("GridHistoryManager: History cleared.");
    // Dispatch a custom event to notify that history has been cleared
    const event = new CustomEvent("gridHistoryUpdated", {
      detail: { operation: "Clear History" },
    });
    document.dispatchEvent(event);
  }
  private defaultUndoOperation(grid: HTMLElement, prevState: GridState): void {
    // First, remove all existing attributes
    const attributesToRemove: string[] = [];
    for (let i = 0; i < grid.attributes.length; i++) {
      const attr = grid.attributes[i];
      if (attr && attr.name) {
        attributesToRemove.push(attr.name);
      }
    }

    // Remove attributes
    attributesToRemove.forEach((name) => {
      grid.removeAttribute(name);
    });

    // Then restore the previous attributes
    if (prevState.attributes) {
      Object.entries(prevState.attributes).forEach(([name, value]) => {
        grid.setAttribute(name, value);
      });
    }

    // Finally, restore the innerHTML
    grid.innerHTML = prevState.innerHTML;
  }

  private findTopLevelGrid(grid: HTMLElement): HTMLElement {
    // Start from the current grid and traverse up to find the top-level grid
    let currentGrid = grid;
    let parentGrid = currentGrid.parentElement?.closest<HTMLElement>(".grid");

    // Keep moving up until we find a grid that has no parent grid
    while (parentGrid) {
      currentGrid = parentGrid;
      parentGrid = currentGrid.parentElement?.closest<HTMLElement>(".grid");
    }

    return currentGrid;
  }
}

export const gridHistoryManager = new GridHistoryManager();
