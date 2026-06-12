import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import BloomTable from "./BloomTable";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";

describe("BloomTable controller", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset?.();
  });

  function setupTable(): { table: HTMLElement; ctrl: BloomTable } {
    const table = document.createElement("div");
    document.body.appendChild(table);
    attachTable(table);
    const ctrl = new BloomTable(table);
    return { table, ctrl };
  }

  it("renders immediately on each operation", () => {
    const { table, ctrl } = setupTable();

    const spy = vi.spyOn(table.style, "setProperty");

    ctrl.setColumnWidth(0, "120px");
    ctrl.setRowHeight(0, "34px");

    // renderer should have applied template props at least once
    const calls = spy.mock.calls.filter(
      (c) => c[0] === "--table-column-count" || c[0] === "--table-row-count",
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it("updates data attributes for sizes via history-wrapped ops", () => {
    const { table, ctrl } = setupTable();
    const before = table.getAttribute("data-column-widths");
    ctrl.setColumnWidth(0, "200px");
    expect(table.getAttribute("data-column-widths")).not.toBe(before);
    expect(table.getAttribute("data-column-widths")?.startsWith("200px")).toBe(true);
  });

  it("sets spans and maintains skip semantics", () => {
    const { table, ctrl } = setupTable();
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
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
    const { table, ctrl } = setupTable();
    const initialCells = table.querySelectorAll(".cell").length;
    ctrl.addRow();
    ctrl.addColumn();
    const afterAdd = table.querySelectorAll(".cell").length;
    expect(afterAdd).toBeGreaterThan(initialCells);
    ctrl.removeLastColumn();
    ctrl.removeLastRow();
    const afterRemove = table.querySelectorAll(".cell").length;
    expect(afterRemove).toBeLessThan(afterAdd);
  });

  it("addColumnAt inserts columns at correct positions", () => {
    const { table, ctrl } = setupTable();
    const initialCellCount = table.querySelectorAll(".cell").length;
    const initialColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;

    // Add column at start
    ctrl.addColumnAt(0);

    const afterStart = table.querySelectorAll(".cell").length;
    const startColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(startColumnCount).toBe(initialColumnCount + 1);
    expect(afterStart).toBeGreaterThan(initialCellCount);

    // Add column in middle
    ctrl.addColumnAt(1);

    const afterMiddle = table.querySelectorAll(".cell").length;
    const middleColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(middleColumnCount).toBe(startColumnCount + 1);
    expect(afterMiddle).toBeGreaterThan(afterStart);

    // Add column at end
    ctrl.addColumnAt(middleColumnCount);

    const afterEnd = table.querySelectorAll(".cell").length;
    const endColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(endColumnCount).toBe(middleColumnCount + 1);
    expect(afterEnd).toBeGreaterThan(afterMiddle);
  });

  it("addRowAt inserts rows at correct positions", () => {
    const { table, ctrl } = setupTable();
    const initialCellCount = table.querySelectorAll(".cell").length;
    const initialRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;

    // Add row at start
    ctrl.addRowAt(0);

    const afterStart = table.querySelectorAll(".cell").length;
    const startRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(startRowCount).toBe(initialRowCount + 1);
    expect(afterStart).toBeGreaterThan(initialCellCount);

    // Add row in middle
    ctrl.addRowAt(1);

    const afterMiddle = table.querySelectorAll(".cell").length;
    const middleRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(middleRowCount).toBe(startRowCount + 1);
    expect(afterMiddle).toBeGreaterThan(afterStart);
  });

  it("removeColumnAt and removeRowAt work correctly", () => {
    const { table, ctrl } = setupTable();

    // Add some extra columns and rows first
    ctrl.addColumn();
    ctrl.addColumn();
    ctrl.addRow();
    ctrl.addRow();

    const beforeRemove = table.querySelectorAll(".cell").length;
    const beforeColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    const beforeRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;

    // Remove column
    ctrl.removeColumnAt(1);

    const afterColumnRemove = table.querySelectorAll(".cell").length;
    const afterColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(afterColumnCount).toBe(beforeColumnCount - 1);
    expect(afterColumnRemove).toBeLessThan(beforeRemove);

    // Remove row
    ctrl.removeRowAt(0);

    const afterRowRemove = table.querySelectorAll(".cell").length;
    const afterRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(afterRowCount).toBe(beforeRowCount - 1);
    expect(afterRowRemove).toBeLessThan(afterColumnRemove);
  });

  describe("Cell merging and splitting", () => {
    it("can merge cells horizontally", () => {
      const { table, ctrl } = setupTable();
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
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
      const { table, ctrl } = setupTable();
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];

      // Find the cell directly below the first cell
      // In default table setup, this should be at position based on column count
      const columnCount = table.getAttribute("data-column-widths")?.split(",").length || 2;
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
      const { table, ctrl } = setupTable();

      // Add extra rows and columns to ensure we have enough cells
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const columnCount = table.getAttribute("data-column-widths")?.split(",").length || 3;

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
      const { table, ctrl } = setupTable();
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
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
      const { table, ctrl } = setupTable();

      // Add extra rows and columns to ensure we have enough cells
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const columnCount = table.getAttribute("data-column-widths")?.split(",").length || 3;

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
      const { table, ctrl } = setupTable();

      // Add extra rows and columns for flexibility
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];
      const columnCount = table.getAttribute("data-column-widths")?.split(",").length || 3;

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
      const { table, ctrl } = setupTable();
      const firstCell = table.querySelector<HTMLElement>(".cell");
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
      const { table, ctrl } = setupTable();
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".cell"));
      const firstCell = cells[0];

      const spy = vi.spyOn(table.style, "setProperty");

      // Merge cells
      ctrl.setSpan(firstCell, 2, 1);

      // Split cells back
      ctrl.setSpan(firstCell, 1, 1);

      // Should have triggered renders (table properties should be set)
      const calls = spy.mock.calls.filter(
        (c) => c[0] === "--table-column-count" || c[0] === "--table-row-count",
      );
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
