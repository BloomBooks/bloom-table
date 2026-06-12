import { tableHistoryManager } from "./history";
import { setColumnWidth, getTableCells, getTableInfo, getRowAndColumn } from "./structure";
import { render } from "./table-renderer";

interface DragState {
  isDragging: boolean;
  dragType: "row" | "column" | null;
  targetElement: HTMLElement | null;
  targetIndex: number;
  startX: number;
  startY: number;
  originalValue: string;
  hasStartedOperation: boolean;
  columnLeftEdge?: number;
  rowTopEdge?: number;
  baseDimension?: number; // Store the original width/height for "hug" values
}

// Unit conversion helpers
const PX_PER_IN = 96;
const MM_PER_IN = 25.4;
const PX_TO_MM = MM_PER_IN / PX_PER_IN; // ≈ 0.264583...
const MM_TO_PX = PX_PER_IN / MM_PER_IN; // ≈ 3.779528...

function parseSizeToPx(size: string): number | null {
  const s = (size || "").trim();
  const mm = s.match(/^([0-9.]+)mm$/i);
  if (mm) return parseFloat(mm[1]) * MM_TO_PX;
  const px = s.match(/^([0-9.]+)px$/i);
  if (px) return parseFloat(px[1]);
  return null;
}

function formatMm(px: number): string {
  const mm = px * PX_TO_MM;
  // one decimal place like "2.1mm"
  return `${mm.toFixed(1)}mm`;
}

export class DragToResize {
  private attachedTables = new Set<HTMLElement>();
  private dragState: DragState = {
    isDragging: false,
    dragType: null,
    targetElement: null,
    targetIndex: -1,
    startX: 0,
    startY: 0,
    originalValue: "",
    hasStartedOperation: false,
    baseDimension: undefined,
  };

  /**
   * Attach interactive UI handlers to a table element and register with table-history
   */
  attach(div: HTMLElement): void {
    if (this.attachedTables.has(div)) {
      return; // Already attached
    }

    this.attachedTables.add(div);

    div.addEventListener("mousemove", this.updateCursorOnMouseMove);
    div.addEventListener("mousedown", this.handleMouseDown);
    div.addEventListener("dblclick", this.handleDoubleClick);
    div.addEventListener("mouseleave", this.handleMouseLeave);

    // Add global mouse move and up listeners for dragging
    document.addEventListener("mousemove", this.handleGlobalMouseMove);
    document.addEventListener("mouseup", this.handleGlobalMouseUp);
  }

  /**
   * Detach interactive UI handlers from a table element and unregister from table-history
   */
  detach(div: HTMLElement): void {
    if (!this.attachedTables.has(div)) {
      return; // Not attached
    }

    this.attachedTables.delete(div);
    tableHistoryManager.detachTable(div); // Remove event listeners
    div.removeEventListener("mousemove", this.updateCursorOnMouseMove);
    div.removeEventListener("mousedown", this.handleMouseDown);
    div.removeEventListener("dblclick", this.handleDoubleClick);
    div.removeEventListener("mouseleave", this.handleMouseLeave);

    // If no tables are attached, remove global listeners
    if (this.attachedTables.size === 0) {
      document.removeEventListener("mousemove", this.handleGlobalMouseMove);
      document.removeEventListener("mouseup", this.handleGlobalMouseUp);
    }
  }

  private updateCursorOnMouseMove = (event: MouseEvent): void => {
    if (this.dragState.isDragging) {
      // If dragging, the cursor is already set and latched, so do nothing here.
      return;
    }
    const target = event.target as HTMLElement; // the element that triggered the event, which could be a child of a cell

    const resizeInfo = this.getResizeInfo(target, event);

    if (resizeInfo) {
      target.style.cursor = resizeInfo.type === "row" ? "ns-resize" : "ew-resize";
      event.stopPropagation();
    } else {
      target.style.cursor = "default";
    }
  };
  private handleMouseDown = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const resizeInfo = this.getResizeInfo(target, event);

    if (resizeInfo) {
      event.preventDefault(); // Capture the appropriate edge position based on resize type
      event.stopPropagation();
      let columnLeftEdge: number | undefined;
      let rowTopEdge: number | undefined;
      if (resizeInfo.type === "column") {
        columnLeftEdge = this.getColumnLeftEdge(resizeInfo.element, resizeInfo.index);
        document.body.style.cursor = "ew-resize"; // Latch cursor
      } else if (resizeInfo.type === "row") {
        rowTopEdge = this.getRowTopEdge(resizeInfo.element, resizeInfo.index);
        console.info(`handleMouseDown: Row top edge is ${rowTopEdge}`);
        document.body.style.cursor = "ns-resize"; // Latch cursor
        // Mark active row being resized so UI can reflect this row
        try {
          resizeInfo.element.setAttribute("data-ui-active-row-index", String(resizeInfo.index));
        } catch {}
      }
      this.dragState = {
        isDragging: true,
        dragType: resizeInfo.type,
        targetElement: resizeInfo.element,
        targetIndex: resizeInfo.index,
        startX: event.clientX,
        startY: event.clientY,
        originalValue: resizeInfo.currentValue,
        hasStartedOperation: false,
        columnLeftEdge: columnLeftEdge,
        rowTopEdge: rowTopEdge,
        baseDimension:
          resizeInfo.currentValue === "hug"
            ? resizeInfo.type === "column"
              ? this.getCurrentColumnWidth(resizeInfo.element, resizeInfo.index)
              : this.getCurrentRowHeight(resizeInfo.element, resizeInfo.index)
            : undefined,
      };
    }
  };

  private handleMouseLeave = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    target.style.cursor = "default";
  };

  private handleGlobalMouseMove = (event: MouseEvent): void => {
    if (!this.dragState.isDragging || !this.dragState.targetElement) {
      return;
    }

    event.preventDefault();

    // Start operation on first significant movement
    if (!this.dragState.hasStartedOperation) {
      const deltaX = Math.abs(event.clientX - this.dragState.startX);
      const deltaY = Math.abs(event.clientY - this.dragState.startY);

      if (deltaX > 3 || deltaY > 3) {
        this.dragState.hasStartedOperation = true;
      }
    }

    const deltaX = event.clientX - this.dragState.startX;
    const deltaY = event.clientY - this.dragState.startY;

    if (this.dragState.dragType === "column") {
      let effectiveDeltaX = deltaX;
      const table = this.dragState.targetElement;
      if (table.parentElement) {
        const parentStyle = window.getComputedStyle(table.parentElement);
        // When the table is centered horizontally, a change in its width will cause its left position to shift.
        // This makes the column divider the user is dragging move at a different speed than the mouse cursor.
        // To compensate for this, we check if the parent is a flex container that centers the table.
        // If so, we double the horizontal delta of the mouse movement. This is a heuristic that works
        // for the common case of `display: flex; justify-content: center;`.
        if (parentStyle.display === "flex" && parentStyle.justifyContent === "center") {
          effectiveDeltaX *= 2;
        }
      }
      this.updateColumnWidthPreview(this.dragState.targetElement, effectiveDeltaX);
    } else if (this.dragState.dragType === "row") {
      this.updateRowHeightPreview(this.dragState.targetElement, deltaY);
    }
  };

  private handleGlobalMouseUp = (): void => {
    if (this.dragState.isDragging && this.dragState.hasStartedOperation) {
      // Commit the operation through table-history
      this.commitResizeOperation();
    }
    // Clear active row marker if any
    try {
      if (this.dragState.dragType === "row" && this.dragState.targetElement) {
        this.dragState.targetElement.removeAttribute("data-ui-active-row-index");
      }
    } catch {}
    this.resetDragState();
    document.body.style.cursor = "default"; // Release cursor
  };
  private commitResizeOperation(): void {
    //console.info("commitResizeOperation: Invoked.");
    if (!this.dragState.targetElement || !this.dragState.dragType) {
      //console.info("commitResizeOperation: Missing targetElement or dragType.");
      return;
    }

    const table =
      this.dragState.dragType === "column"
        ? this.dragState.targetElement
        : this.findParentTable(this.dragState.targetElement, false);
    if (!table) {
      console.warn("CommitResizeOperation: Could not find parent table.");
      return;
    }

    const operationType = this.dragState.dragType;
    const targetElement = this.dragState.targetElement; // This is the table for column, row for row resize

    // Capture these values from the current drag state for the undo closure
    const capturedOriginalValue = this.dragState.originalValue;
    const capturedTargetIndex = this.dragState.targetIndex;

    let description: string;
    let performOperation: () => void;
    let undoOperation: (tableElement: HTMLElement, prevState: import("./history").TableState) => void;

    if (operationType === "column") {
      const newWidth = this.calculateFinalColumnWidth(targetElement); // targetElement is table here
      description = `Resize Column ${capturedTargetIndex + 1} to ${newWidth}`;

      performOperation = () => {
        const currentWidths = targetElement.getAttribute("data-column-widths") || "";
        const widthArray = currentWidths.split(",");
        if (capturedTargetIndex >= 0 && capturedTargetIndex < widthArray.length) {
          widthArray[capturedTargetIndex] = newWidth;
          targetElement.setAttribute("data-column-widths", widthArray.join(","));
        }
      };
      undoOperation = (tableElement) => {
        // We need to revert the specific column to its capturedOriginalValue.
        const currentWidths = tableElement.getAttribute("data-column-widths") || "";
        const columnWidthsArray = currentWidths.split(",");
        if (capturedTargetIndex >= 0 && capturedTargetIndex < columnWidthsArray.length) {
          columnWidthsArray[capturedTargetIndex] = capturedOriginalValue; // Use the value from before drag
        }
        tableElement.setAttribute("data-column-widths", columnWidthsArray.join(","));
        // Re-render so the CSS table template reflects the reverted width (the
        // data attribute alone does not update the visual layout).
        render(tableElement);
      };
    } else if (operationType === "row") {
      const tableElement = targetElement; // targetElement is the table for row resizing
      const currentRowHeights = tableElement.getAttribute("data-row-heights") || "";
      const rowHeights = currentRowHeights.split(",");
      const newHeight = rowHeights[capturedTargetIndex] || "hug";

      description = `Resize Row ${capturedTargetIndex + 1} to ${newHeight}`;

      performOperation = () => {
        // The height is already set during preview, so nothing to do here
      };

      undoOperation = (tableElement: HTMLElement) => {
        // Restore the specific row height to its original value
        const currentRowHeights = tableElement.getAttribute("data-row-heights") || "";
        const rowHeights = currentRowHeights.split(",");
        if (capturedTargetIndex >= 0 && capturedTargetIndex < rowHeights.length) {
          rowHeights[capturedTargetIndex] = capturedOriginalValue;
          tableElement.setAttribute("data-row-heights", rowHeights.join(","));
        }
        // Re-render so the CSS table template reflects the reverted height.
        render(tableElement);
      };
    } else {
      throw new Error(
        `Unsupported drag type: ${this.dragState.dragType}. Expected 'row' or 'column'.`,
      );
    }

    tableHistoryManager.addHistoryEntry(table, description, performOperation, undoOperation);
  }

  private calculateFinalColumnWidth(table: HTMLElement): string {
    const currentWidths = table.getAttribute("data-column-widths") || "";
    const widthArray = currentWidths.split(",");

    // Get the current temporary width that was set during preview
    if (this.dragState.targetIndex < widthArray.length) {
      return widthArray[this.dragState.targetIndex];
    }
    return "hug";
  }
  private updateColumnWidthPreview(table: HTMLElement, deltaX: number): void {
    const currentWidths = table.getAttribute("data-column-widths") || "";
    const widthArray = currentWidths.split(",");

    // Get the base width (original width when dragging started)
    let baseWidth: number;
    if (this.dragState.originalValue === "hug") {
      // Use the stored base dimension calculated at drag start
      baseWidth =
        this.dragState.baseDimension ||
        this.getCurrentColumnWidth(table, this.dragState.targetIndex);
    } else {
      // For fixed-width columns, parse the original value
      const match = this.dragState.originalValue.match(/([0-9.]+)px/);
      baseWidth = match ? parseFloat(match[1]) : 50;
    }

    // Apply the delta to the base width
    const newWidth = Math.max(50, baseWidth + deltaX);

    if (this.dragState.targetIndex < widthArray.length) {
      widthArray[this.dragState.targetIndex] = `${newWidth}px`;
      table.setAttribute("data-column-widths", widthArray.join(","));

      // Re-render the table to update the visual layout during drag
      render(table);
    }
  }
  private updateRowHeightPreview(table: HTMLElement, deltaY: number): void {
    // Get the base height (original height when dragging started)
    let baseHeight: number;
    if (this.dragState.originalValue === "hug") {
      // Use the stored base dimension calculated at drag start
      baseHeight =
        this.dragState.baseDimension || this.getCurrentRowHeight(table, this.dragState.targetIndex);
    } else {
      // For fixed-height rows, parse the original value (supports px or mm)
      const parsed = parseSizeToPx(this.dragState.originalValue);
      baseHeight = parsed ?? 20;
    }

    // Apply the delta to the base height
    const newHeightPx = Math.max(20, baseHeight + deltaY);

    // Update the row height in the table's data-row-heights attribute
    const currentRowHeights = table.getAttribute("data-row-heights") || "";
    let rowHeights = currentRowHeights ? currentRowHeights.split(",") : [];

    // Ensure the array has an entry for each table row
    try {
      const info = getTableInfo(table);
      const needed = info.rowCount;
      if (rowHeights.length < needed) {
        rowHeights = rowHeights.concat(Array(needed - rowHeights.length).fill("hug"));
      }
    } catch {}

    if (this.dragState.targetIndex >= 0 && this.dragState.targetIndex < rowHeights.length) {
      // Store in mm for rows
      rowHeights[this.dragState.targetIndex] = formatMm(newHeightPx);
      table.setAttribute("data-row-heights", rowHeights.join(","));

      // Re-render the table to update the visual layout during drag
      render(table);

      // Debug preview write
      // eslint-disable-next-line no-console
      console.log(
        "[drag-to-resize] preview row",
        this.dragState.targetIndex,
        "->",
        rowHeights[this.dragState.targetIndex],
      );
    }
  }
  private resetDragState(): void {
    this.dragState = {
      isDragging: false,
      dragType: null,
      targetElement: null,
      targetIndex: -1,
      startX: 0,
      startY: 0,
      originalValue: "",
      hasStartedOperation: false,
      columnLeftEdge: undefined,
      rowTopEdge: undefined,
      baseDimension: undefined,
    };
  }
  private getResizeInfo(
    target: HTMLElement,
    event: MouseEvent,
  ): {
    type: "row" | "column";
    element: HTMLElement;
    currentValue: string;
    index: number;
  } | null {
    const cell = target.closest<HTMLElement>(".cell");

    if (!cell) {
      return null;
    }
    const table = cell.closest<HTMLElement>(".table");
    if (!table) {
      throw new Error("getResizeInfo: Could not find parent table.");
    }

    const rect = cell.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // console.info(`getResizeInfo: target=${this.tagInfo(target)}`);
    // console.info(`boudingClientRect:${JSON.stringify(rect)} x:${x}, y:${y}`);

    const edgeThreshold = 5; // pixels from edge to trigger resize    // Check if we're near the bottom edge (row resize)
    if (y >= rect.height - edgeThreshold && y <= rect.height) {
      // Determine which row this cell is in
      const { row: rowIndex } = getRowAndColumn(table, cell);
      if (rowIndex >= 0) {
        // For row resizing, we need to get/set data-row-height on the table itself
        // but track which row we're resizing
        const currentRowHeights = table.getAttribute("data-row-heights") || "";
        const rowHeights = currentRowHeights.split(",");
        const currentHeight = rowIndex < rowHeights.length ? rowHeights[rowIndex] : "hug";

        return {
          type: "row",
          element: table, // We store height info on the table, not individual cells
          currentValue: currentHeight,
          index: rowIndex,
        };
      }
    }

    // Check if we're near the right edge (column resize)
    if (x >= rect.width - edgeThreshold && x <= rect.width) {
      const { column: columnIndex } = getRowAndColumn(table, cell);
      const columnWidths = table.getAttribute("data-column-widths") || "";
      const widthArray = columnWidths.split(",");

      if (columnIndex < widthArray.length) {
        return {
          type: "column",
          element: table,
          currentValue: widthArray[columnIndex] || "hug",
          index: columnIndex,
        };
      }
    }

    return null;
  }

  private findParentTable(row: HTMLElement, _verbose: boolean): HTMLElement | null {
    return row.closest<HTMLElement>(".table") || null;
  }

  private handleDoubleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;

    const resizeInfo = this.getResizeInfo(target, event);
    if (resizeInfo && resizeInfo.type === "row") {
      event.preventDefault();
      event.stopPropagation();

      const tableElement = resizeInfo.element; // This is the table element
      const rowIndex = resizeInfo.index;
      const currentRowHeights = tableElement.getAttribute("data-row-heights") || "";
      const rowHeights = currentRowHeights.split(",");
      const currentHeight = rowIndex < rowHeights.length ? rowHeights[rowIndex] : "hug";

      const description = `Auto-size Row ${rowIndex + 1}`;

      const performOperation = () => {
        const currentRowHeights = tableElement.getAttribute("data-row-heights") || "";
        const rowHeights = currentRowHeights.split(",");
        if (rowIndex >= 0 && rowIndex < rowHeights.length) {
          rowHeights[rowIndex] = "hug";
          tableElement.setAttribute("data-row-heights", rowHeights.join(","));
        }
        render(tableElement);
      };

      const undoOperation = (tableElement: HTMLElement) => {
        const currentRowHeights = tableElement.getAttribute("data-row-heights") || "";
        const rowHeights = currentRowHeights.split(",");
        if (rowIndex >= 0 && rowIndex < rowHeights.length) {
          rowHeights[rowIndex] = currentHeight;
          tableElement.setAttribute("data-row-heights", rowHeights.join(","));
        }
        render(tableElement);
      };

      tableHistoryManager.addHistoryEntry(tableElement, description, performOperation, undoOperation);
    } else if (resizeInfo && resizeInfo.type === "column") {
      event.preventDefault();
      event.stopPropagation();

      const table = resizeInfo.element;
      if (!table) {
        console.warn("HandleDoubleClick: Could not find parent table.");
        return;
      }

      const columnIndex = resizeInfo.index;
      const currentWidths = table.getAttribute("data-column-widths") || "";
      const widthArray = currentWidths.split(",");
      const currentWidth = columnIndex < widthArray.length ? widthArray[columnIndex] : "hug";

      const description = `Auto-size Column ${columnIndex + 1}`;

      const performOperation = () => {
        setColumnWidth(table, columnIndex, "hug");
        render(table);
      };

      const undoOperation = (tableElement: HTMLElement) => {
        const currentWidths = tableElement.getAttribute("data-column-widths") || "";
        const widthArray = currentWidths.split(",");
        if (columnIndex >= 0 && columnIndex < widthArray.length) {
          widthArray[columnIndex] = currentWidth;
          tableElement.setAttribute("data-column-widths", widthArray.join(","));
        }
        render(tableElement);
      };

      tableHistoryManager.addHistoryEntry(table, description, performOperation, undoOperation);
    }
  };
  private getColumnLeftEdge(table: HTMLElement, columnIndex: number): number {
    // Force layout to ensure we get current measurements
    table.offsetHeight;

    // Try to find a cell in the target column to get its position
    const tableInfo = getTableInfo(table);

    // Look for a cell in the first row at the target column
    if (tableInfo.rowCount > 0 && columnIndex < tableInfo.columnCount) {
      try {
        const cells = getTableCells(table);
        const targetCellIndex = columnIndex; // First row, target column

        if (targetCellIndex < cells.length) {
          const cellElement = cells[targetCellIndex];
          const rect = cellElement.getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          return rect.left - tableRect.left;
        }
      } catch (error) {
        console.warn("Could not get cell position, falling back to computed style");
      }
    }

    // Fallback: calculate based on table computed style
    const computedStyle = window.getComputedStyle(table);
    const gridTemplateColumns = computedStyle.gridTemplateColumns;

    if (gridTemplateColumns && gridTemplateColumns !== "none") {
      const columnWidths = gridTemplateColumns.split(" ");
      let leftPosition = 0;

      for (let i = 0; i < columnIndex && i < columnWidths.length; i++) {
        const match = columnWidths[i].match(/([0-9.]+)px/);
        if (match) {
          leftPosition += parseFloat(match[1]);
        }
      }

      return leftPosition;
    } // Ultimate fallback
    return 0;
  }

  private getRowTopEdge(table: HTMLElement, rowIndex: number): number {
    console.info(`getRowTopEdge: Called for table with row index:`, rowIndex);

    // Force layout to ensure we get current measurements
    table.offsetHeight;

    // Get the computed table template rows
    const computedStyle = window.getComputedStyle(table);
    const gridTemplateRows = computedStyle.gridTemplateRows;
    console.info(`getRowTopEdge: Table template rows:`, gridTemplateRows);

    if (gridTemplateRows && gridTemplateRows !== "none") {
      const rowHeights = gridTemplateRows.split(" ");
      console.info(`getRowTopEdge: Parsed row heights:`, rowHeights);

      let topPosition = 0;

      // Sum up the heights of all rows before the target row
      for (let i = 0; i < rowIndex && i < rowHeights.length; i++) {
        const heightValue = rowHeights[i];
        let height = 0;

        // Extract pixel value from computed style
        const match = heightValue.match(/([0-9.]+)px/);
        if (match) {
          height = parseFloat(match[1]);
        }

        console.info(`getRowTopEdge: Row ${i} height from table template:`, height);
        topPosition += height;
      }

      console.info(`getRowTopEdge: Calculated top position:`, topPosition);
      return topPosition;
    }

    console.warn(`getRowTopEdge: Could not parse table template rows, returning 0`);
    return 0;
  }

  private getCurrentColumnWidth(table: HTMLElement, columnIndex: number): number {
    // Force layout to ensure we get current measurements
    table.offsetHeight;

    // Try to get the width from a cell in the target column
    const tableInfo = getTableInfo(table);

    if (tableInfo.rowCount > 0 && columnIndex < tableInfo.columnCount) {
      try {
        const cells = getTableCells(table);
        const targetCellIndex = columnIndex; // First row, target column

        if (targetCellIndex < cells.length) {
          const cellElement = cells[targetCellIndex];
          const rect = cellElement.getBoundingClientRect();
          return rect.width;
        }
      } catch (error) {
        console.warn("Could not get cell width, falling back to computed style");
      }
    }

    // Fallback: get width from computed table template
    const computedStyle = window.getComputedStyle(table);
    const gridTemplateColumns = computedStyle.gridTemplateColumns;

    if (gridTemplateColumns && gridTemplateColumns !== "none") {
      const columnWidths = gridTemplateColumns.split(" ");

      if (columnIndex < columnWidths.length) {
        const widthValue = columnWidths[columnIndex];
        const match = widthValue.match(/([0-9.]+)px/);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }

    // Ultimate fallback
    return 100;
  }

  private getCurrentRowHeight(table: HTMLElement, rowIndex: number): number {
    // Force layout to ensure we get current measurements
    table.offsetHeight;

    // Try to get the height from a cell in the target row
    const tableInfo = getTableInfo(table);

    if (tableInfo.rowCount > rowIndex && tableInfo.columnCount > 0) {
      try {
        const cells = getTableCells(table);
        // Get the first cell in the target row
        const targetCellIndex = rowIndex * tableInfo.columnCount;

        if (targetCellIndex < cells.length) {
          const cellElement = cells[targetCellIndex];
          const rect = cellElement.getBoundingClientRect();
          return rect.height;
        }
      } catch (error) {
        console.warn("Could not get cell height, falling back to computed style");
      }
    }

    // Fallback: get height from computed table template
    const computedStyle = window.getComputedStyle(table);
    const gridTemplateRows = computedStyle.gridTemplateRows;

    if (gridTemplateRows && gridTemplateRows !== "none") {
      const rowHeights = gridTemplateRows.split(" ");

      if (rowIndex < rowHeights.length) {
        const heightValue = rowHeights[rowIndex];
        const match = heightValue.match(/([0-9.]+)px/);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }

    // Ultimate fallback
    return 30;
  }
}

// Export a singleton instance
export const dragToResize = new DragToResize();
