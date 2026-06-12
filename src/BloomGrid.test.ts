import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import BloomGrid from "./BloomGrid";
import { attachGrid } from "./attach";
import { gridHistoryManager } from "./history";

describe("BloomGrid controller", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    gridHistoryManager.reset?.();
  });

  function setupGrid(): { grid: HTMLElement; ctrl: BloomGrid } {
    const grid = document.createElement("div");
    document.body.appendChild(grid);
    attachGrid(grid);
    const ctrl = new BloomGrid(grid);
    return { grid, ctrl };
  }

  it("renders immediately on each operation", () => {
    const { grid, ctrl } = setupGrid();

    const spy = vi.spyOn(grid.style, "setProperty");

    ctrl.setColumnWidth(0, "120px");
    ctrl.setRowHeight(0, "34px");

    // renderer should have applied template props at least once
    const calls = spy.mock.calls.filter(
      (c) => c[0] === "--grid-column-count" || c[0] === "--grid-row-count",
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it("updates data attributes for sizes via history-wrapped ops", () => {
    const { grid, ctrl } = setupGrid();
    const before = grid.getAttribute("data-column-widths");
    ctrl.setColumnWidth(0, "200px");
    expect(grid.getAttribute("data-column-widths")).not.toBe(before);
    expect(grid.getAttribute("data-column-widths")?.startsWith("200px")).toBe(true);
  });

  it("sets spans and maintains skip semantics", () => {
    const { grid, ctrl } = setupGrid();
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
    expect(cells.length).toBeGreaterThan(0);
    const first = cells[0];
    ctrl.setSpan(first, 2, 1);
    expect(first.getAttribute("data-span-x")).toBe("2");
    // structure.setCellSpan should add skip to covered neighbor if present
    const neighbor = cells[1];
    if (neighbor) {
      expect(neighbor.classList.contains("skip")).toBe(true);
    }
  });

  it("supports add/remove row/column and renders", () => {
    const { grid, ctrl } = setupGrid();
    const initialCells = grid.querySelectorAll(".cell").length;
    ctrl.addRow();
    ctrl.addColumn();
    const afterAdd = grid.querySelectorAll(".cell").length;
    expect(afterAdd).toBeGreaterThan(initialCells);
    ctrl.removeLastColumn();
    ctrl.removeLastRow();
    const afterRemove = grid.querySelectorAll(".cell").length;
    expect(afterRemove).toBeLessThan(afterAdd);
  });

  it("addColumnAt inserts columns at correct positions", () => {
    const { grid, ctrl } = setupGrid();
    const initialCellCount = grid.querySelectorAll(".cell").length;
    const initialColumnCount = grid.getAttribute("data-column-widths")?.split(",").length || 0;

    // Add column at start
    ctrl.addColumnAt(0);

    const afterStart = grid.querySelectorAll(".cell").length;
    const startColumnCount = grid.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(startColumnCount).toBe(initialColumnCount + 1);
    expect(afterStart).toBeGreaterThan(initialCellCount);

    // Add column in middle
    ctrl.addColumnAt(1);

    const afterMiddle = grid.querySelectorAll(".cell").length;
    const middleColumnCount = grid.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(middleColumnCount).toBe(startColumnCount + 1);
    expect(afterMiddle).toBeGreaterThan(afterStart);

    // Add column at end
    ctrl.addColumnAt(middleColumnCount);

    const afterEnd = grid.querySelectorAll(".cell").length;
    const endColumnCount = grid.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(endColumnCount).toBe(middleColumnCount + 1);
    expect(afterEnd).toBeGreaterThan(afterMiddle);
  });

  it("addRowAt inserts rows at correct positions", () => {
    const { grid, ctrl } = setupGrid();
    const initialCellCount = grid.querySelectorAll(".cell").length;
    const initialRowCount = grid.getAttribute("data-row-heights")?.split(",").length || 0;

    // Add row at start
    ctrl.addRowAt(0);

    const afterStart = grid.querySelectorAll(".cell").length;
    const startRowCount = grid.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(startRowCount).toBe(initialRowCount + 1);
    expect(afterStart).toBeGreaterThan(initialCellCount);

    // Add row in middle
    ctrl.addRowAt(1);

    const afterMiddle = grid.querySelectorAll(".cell").length;
    const middleRowCount = grid.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(middleRowCount).toBe(startRowCount + 1);
    expect(afterMiddle).toBeGreaterThan(afterStart);
  });

  it("removeColumnAt and removeRowAt work correctly", () => {
    const { grid, ctrl } = setupGrid();

    // Add some extra columns and rows first
    ctrl.addColumn();
    ctrl.addColumn();
    ctrl.addRow();
    ctrl.addRow();

    const beforeRemove = grid.querySelectorAll(".cell").length;
    const beforeColumnCount = grid.getAttribute("data-column-widths")?.split(",").length || 0;
    const beforeRowCount = grid.getAttribute("data-row-heights")?.split(",").length || 0;

    // Remove column
    ctrl.removeColumnAt(1);

    const afterColumnRemove = grid.querySelectorAll(".cell").length;
    const afterColumnCount = grid.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(afterColumnCount).toBe(beforeColumnCount - 1);
    expect(afterColumnRemove).toBeLessThan(beforeRemove);

    // Remove row
    ctrl.removeRowAt(0);

    const afterRowRemove = grid.querySelectorAll(".cell").length;
    const afterRowCount = grid.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(afterRowCount).toBe(beforeRowCount - 1);
    expect(afterRowRemove).toBeLessThan(afterColumnRemove);
  });

  describe("Cell merging and splitting", () => {
    it("can merge cells horizontally", () => {
      const { grid, ctrl } = setupGrid();
      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const secondCell = cells[1];

      expect(firstCell).toBeTruthy();
      expect(secondCell).toBeTruthy();

      // Initially, cells should not be skipped
      expect(firstCell.classList.contains("skip")).toBe(false);
      expect(secondCell.classList.contains("skip")).toBe(false);

      // Merge first cell to span 2 columns horizontally
      ctrl.setSpan(firstCell, 2, 1);

      // Check span attributes
      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");

      // Second cell should now be marked as skip (covered by the span)
      expect(secondCell.classList.contains("skip")).toBe(true);
      expect(firstCell.classList.contains("skip")).toBe(false);
    });

    it("can merge cells vertically", () => {
      const { grid, ctrl } = setupGrid();
      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];

      // Find the cell directly below the first cell
      // In default grid setup, this should be at position based on column count
      const columnCount = grid.getAttribute("data-column-widths")?.split(",").length || 2;
      const cellBelow = cells[columnCount]; // Next row, same column

      expect(firstCell).toBeTruthy();
      expect(cellBelow).toBeTruthy();

      // Initially, cells should not be skipped
      expect(firstCell.classList.contains("skip")).toBe(false);
      expect(cellBelow.classList.contains("skip")).toBe(false);

      // Merge first cell to span 2 rows vertically
      ctrl.setSpan(firstCell, 1, 2);

      // Check span attributes
      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");

      // Cell below should now be marked as skip (covered by the span)
      expect(cellBelow.classList.contains("skip")).toBe(true);
      expect(firstCell.classList.contains("skip")).toBe(false);
    });

    it("can merge cells in both directions (2x2 block)", () => {
      const { grid, ctrl } = setupGrid();

      // Add extra rows and columns to ensure we have enough cells
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const columnCount = grid.getAttribute("data-column-widths")?.split(",").length || 3;

      // Find the cells that should be covered by a 2x2 span
      const rightCell = cells[1];
      const belowCell = cells[columnCount];
      const diagonalCell = cells[columnCount + 1];

      expect(firstCell).toBeTruthy();
      expect(rightCell).toBeTruthy();
      expect(belowCell).toBeTruthy();
      expect(diagonalCell).toBeTruthy();

      // Merge first cell to span 2x2
      ctrl.setSpan(firstCell, 2, 2);

      // Check span attributes
      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");

      // All covered cells should be marked as skip
      expect(rightCell.classList.contains("skip")).toBe(true);
      expect(belowCell.classList.contains("skip")).toBe(true);
      expect(diagonalCell.classList.contains("skip")).toBe(true);
      expect(firstCell.classList.contains("skip")).toBe(false);
    });

    it("can split merged cells back to individual cells", () => {
      const { grid, ctrl } = setupGrid();
      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const secondCell = cells[1];

      // First merge the cells
      ctrl.setSpan(firstCell, 2, 1);

      // Verify they are merged
      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(secondCell.classList.contains("skip")).toBe(true);

      // Now split them back
      ctrl.setSpan(firstCell, 1, 1);

      // Check that span is reset
      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");

      // Second cell should no longer be skipped
      expect(secondCell.classList.contains("skip")).toBe(false);
      expect(firstCell.classList.contains("skip")).toBe(false);
    });

    it("can split a 2x2 merged cell back to individual cells", () => {
      const { grid, ctrl } = setupGrid();

      // Add extra rows and columns to ensure we have enough cells
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const columnCount = grid.getAttribute("data-column-widths")?.split(",").length || 3;

      const rightCell = cells[1];
      const belowCell = cells[columnCount];
      const diagonalCell = cells[columnCount + 1];

      // First merge to 2x2
      ctrl.setSpan(firstCell, 2, 2);

      // Verify all cells are in merged state
      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");
      expect(rightCell.classList.contains("skip")).toBe(true);
      expect(belowCell.classList.contains("skip")).toBe(true);
      expect(diagonalCell.classList.contains("skip")).toBe(true);

      // Now split back to 1x1
      ctrl.setSpan(firstCell, 1, 1);

      // Check that all cells are now individual
      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");
      expect(rightCell.classList.contains("skip")).toBe(false);
      expect(belowCell.classList.contains("skip")).toBe(false);
      expect(diagonalCell.classList.contains("skip")).toBe(false);
    });

    it("can modify span from one configuration to another", () => {
      const { grid, ctrl } = setupGrid();

      // Add extra rows and columns for flexibility
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const columnCount = grid.getAttribute("data-column-widths")?.split(",").length || 3;

      // Start with horizontal span (1x2 -> 2 columns)
      ctrl.setSpan(firstCell, 2, 1);

      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");
      expect(cells[1].classList.contains("skip")).toBe(true);
      expect(cells[columnCount].classList.contains("skip")).toBe(false);

      // Change to vertical span (2x1 -> 2 rows)
      ctrl.setSpan(firstCell, 1, 2);

      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");
      expect(cells[1].classList.contains("skip")).toBe(false); // No longer covered
      expect(cells[columnCount].classList.contains("skip")).toBe(true); // Now covered

      // Change to 2x2 span
      ctrl.setSpan(firstCell, 2, 2);

      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");
      expect(cells[1].classList.contains("skip")).toBe(true);
      expect(cells[columnCount].classList.contains("skip")).toBe(true);
      expect(cells[columnCount + 1].classList.contains("skip")).toBe(true);
    });

    it("maintains proper getSpan functionality", () => {
      const { grid, ctrl } = setupGrid();
      const firstCell = grid.querySelector<HTMLElement>(".cell");
      expect(firstCell).toBeTruthy();

      // Initially should be 1x1
      let span = ctrl.getSpan(firstCell!);
      expect(span.x).toBe(1);
      expect(span.y).toBe(1);

      // Add extra rows and columns for the 2x3 span
      ctrl.addRow();
      ctrl.addRow();
      ctrl.addColumn();

      // After setting span to 2x3
      ctrl.setSpan(firstCell!, 2, 3);

      span = ctrl.getSpan(firstCell!);
      expect(span.x).toBe(2);
      expect(span.y).toBe(3);
    });

    it("renders when merging and splitting", () => {
      const { grid, ctrl } = setupGrid();
      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];

      const spy = vi.spyOn(grid.style, "setProperty");

      // Merge cells
      ctrl.setSpan(firstCell, 2, 1);

      // Split cells back
      ctrl.setSpan(firstCell, 1, 1);

      // Should have triggered renders (grid properties should be set)
      const calls = spy.mock.calls.filter(
        (c) => c[0] === "--grid-column-count" || c[0] === "--grid-row-count",
      );
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
