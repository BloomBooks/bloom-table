import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import BloomTable from "./BloomTable";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";

describe("BloomTable controller", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
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
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    expect(cells.length).toBeGreaterThan(0);
    const first = cells[0];
    ctrl.setSpan(first, 2, 1);
    expect(first.getAttribute("data-span-x")).toBe("2");
    // structure.setCellSpan should add skip to covered neighbor if present
    const neighbor = cells[1];
    if (neighbor) {
      expect(neighbor.classList.contains("bloom-skip")).toBe(true);
    }
  });

  it("addRowAt with a source override copies that row's settings, not the selected row's", () => {
    const { table, ctrl } = setupTable(); // 2x2
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    // Style row 1 and select a cell in row 0.
    cells[2].setAttribute("data-bg", "#112233");
    cells[2].setAttribute("data-content-type", "image");
    cells[0].classList.add("cell--selected");

    ctrl.addRowAt(2, 1); // append below, sourcing from row 1 (the adjacent row)

    const newCells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell")).slice(4);
    expect(newCells[0].getAttribute("data-bg")).toBe("#112233");
    expect(newCells[0].getAttribute("data-content-type")).toBe("image");
  });

  it("supports add/remove row/column and renders", () => {
    const { table, ctrl } = setupTable();
    const initialCells = table.querySelectorAll(".bloom-cell").length;
    ctrl.addRow();
    ctrl.addColumn();
    const afterAdd = table.querySelectorAll(".bloom-cell").length;
    expect(afterAdd).toBeGreaterThan(initialCells);
    ctrl.removeLastColumn();
    ctrl.removeLastRow();
    const afterRemove = table.querySelectorAll(".bloom-cell").length;
    expect(afterRemove).toBeLessThan(afterAdd);
  });

  it("addColumnAt inserts columns at correct positions", () => {
    const { table, ctrl } = setupTable();
    const initialCellCount = table.querySelectorAll(".bloom-cell").length;
    const initialColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;

    // Add column at start
    ctrl.addColumnAt(0);

    const afterStart = table.querySelectorAll(".bloom-cell").length;
    const startColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(startColumnCount).toBe(initialColumnCount + 1);
    expect(afterStart).toBeGreaterThan(initialCellCount);

    // Add column in middle
    ctrl.addColumnAt(1);

    const afterMiddle = table.querySelectorAll(".bloom-cell").length;
    const middleColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(middleColumnCount).toBe(startColumnCount + 1);
    expect(afterMiddle).toBeGreaterThan(afterStart);

    // Add column at end
    ctrl.addColumnAt(middleColumnCount);

    const afterEnd = table.querySelectorAll(".bloom-cell").length;
    const endColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(endColumnCount).toBe(middleColumnCount + 1);
    expect(afterEnd).toBeGreaterThan(afterMiddle);
  });

  it("addRowAt inserts rows at correct positions", () => {
    const { table, ctrl } = setupTable();
    const initialCellCount = table.querySelectorAll(".bloom-cell").length;
    const initialRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;

    // Add row at start
    ctrl.addRowAt(0);

    const afterStart = table.querySelectorAll(".bloom-cell").length;
    const startRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(startRowCount).toBe(initialRowCount + 1);
    expect(afterStart).toBeGreaterThan(initialCellCount);

    // Add row in middle
    ctrl.addRowAt(1);

    const afterMiddle = table.querySelectorAll(".bloom-cell").length;
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

    const beforeRemove = table.querySelectorAll(".bloom-cell").length;
    const beforeColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    const beforeRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;

    // Remove column
    ctrl.removeColumnAt(1);

    const afterColumnRemove = table.querySelectorAll(".bloom-cell").length;
    const afterColumnCount = table.getAttribute("data-column-widths")?.split(",").length || 0;
    expect(afterColumnCount).toBe(beforeColumnCount - 1);
    expect(afterColumnRemove).toBeLessThan(beforeRemove);

    // Remove row
    ctrl.removeRowAt(0);

    const afterRowRemove = table.querySelectorAll(".bloom-cell").length;
    const afterRowCount = table.getAttribute("data-row-heights")?.split(",").length || 0;
    expect(afterRowCount).toBe(beforeRowCount - 1);
    expect(afterRowRemove).toBeLessThan(afterColumnRemove);
  });

  describe("Cell merging and splitting", () => {
    it("can merge cells horizontally", () => {
      const { table, ctrl } = setupTable();
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
      const firstCell = cells[0];
      const secondCell = cells[1];

      expect(firstCell).toBeTruthy();
      expect(secondCell).toBeTruthy();

      // Initially, cells should not be skipped
      expect(firstCell.classList.contains("bloom-skip")).toBe(false);
      expect(secondCell.classList.contains("bloom-skip")).toBe(false);

      // Merge first cell to span 2 columns horizontally
      ctrl.setSpan(firstCell, 2, 1);

      // Check span attributes
      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");

      // Second cell should now be marked as skip (covered by the span)
      expect(secondCell.classList.contains("bloom-skip")).toBe(true);
      expect(firstCell.classList.contains("bloom-skip")).toBe(false);
    });

    it("can merge cells vertically", () => {
      const { table, ctrl } = setupTable();
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
      const firstCell = cells[0];

      // Find the cell directly below the first cell
      // In default table setup, this should be at position based on column count
      const columnCount = table.getAttribute("data-column-widths")?.split(",").length || 2;
      const cellBelow = cells[columnCount]; // Next row, same column

      expect(firstCell).toBeTruthy();
      expect(cellBelow).toBeTruthy();

      // Initially, cells should not be skipped
      expect(firstCell.classList.contains("bloom-skip")).toBe(false);
      expect(cellBelow.classList.contains("bloom-skip")).toBe(false);

      // Merge first cell to span 2 rows vertically
      ctrl.setSpan(firstCell, 1, 2);

      // Check span attributes
      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");

      // Cell below should now be marked as skip (covered by the span)
      expect(cellBelow.classList.contains("bloom-skip")).toBe(true);
      expect(firstCell.classList.contains("bloom-skip")).toBe(false);
    });

    it("can merge cells in both directions (2x2 block)", () => {
      const { table, ctrl } = setupTable();

      // Add extra rows and columns to ensure we have enough cells
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
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
      expect(rightCell.classList.contains("bloom-skip")).toBe(true);
      expect(belowCell.classList.contains("bloom-skip")).toBe(true);
      expect(diagonalCell.classList.contains("bloom-skip")).toBe(true);
      expect(firstCell.classList.contains("bloom-skip")).toBe(false);
    });

    it("can split merged cells back to individual cells", () => {
      const { table, ctrl } = setupTable();
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
      const firstCell = cells[0];
      const secondCell = cells[1];

      // First merge the cells
      ctrl.setSpan(firstCell, 2, 1);

      // Verify they are merged
      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(secondCell.classList.contains("bloom-skip")).toBe(true);

      // Now split them back
      ctrl.setSpan(firstCell, 1, 1);

      // Check that span is reset
      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");

      // Second cell should no longer be skipped
      expect(secondCell.classList.contains("bloom-skip")).toBe(false);
      expect(firstCell.classList.contains("bloom-skip")).toBe(false);
    });

    it("can split a 2x2 merged cell back to individual cells", () => {
      const { table, ctrl } = setupTable();

      // Add extra rows and columns to ensure we have enough cells
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
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
      expect(rightCell.classList.contains("bloom-skip")).toBe(true);
      expect(belowCell.classList.contains("bloom-skip")).toBe(true);
      expect(diagonalCell.classList.contains("bloom-skip")).toBe(true);

      // Now split back to 1x1
      ctrl.setSpan(firstCell, 1, 1);

      // Check that all cells are now individual
      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");
      expect(rightCell.classList.contains("bloom-skip")).toBe(false);
      expect(belowCell.classList.contains("bloom-skip")).toBe(false);
      expect(diagonalCell.classList.contains("bloom-skip")).toBe(false);
    });

    it("can modify span from one configuration to another", () => {
      const { table, ctrl } = setupTable();

      // Add extra rows and columns for flexibility
      ctrl.addRow();
      ctrl.addColumn();

      const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
      const firstCell = cells[0];
      const columnCount = table.getAttribute("data-column-widths")?.split(",").length || 3;

      // Start with horizontal span (1x2 -> 2 columns)
      ctrl.setSpan(firstCell, 2, 1);

      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("1");
      expect(cells[1].classList.contains("bloom-skip")).toBe(true);
      expect(cells[columnCount].classList.contains("bloom-skip")).toBe(false);

      // Change to vertical span (2x1 -> 2 rows)
      ctrl.setSpan(firstCell, 1, 2);

      expect(firstCell.getAttribute("data-span-x")).toBe("1");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");
      expect(cells[1].classList.contains("bloom-skip")).toBe(false); // No longer covered
      expect(cells[columnCount].classList.contains("bloom-skip")).toBe(true); // Now covered

      // Change to 2x2 span
      ctrl.setSpan(firstCell, 2, 2);

      expect(firstCell.getAttribute("data-span-x")).toBe("2");
      expect(firstCell.getAttribute("data-span-y")).toBe("2");
      expect(cells[1].classList.contains("bloom-skip")).toBe(true);
      expect(cells[columnCount].classList.contains("bloom-skip")).toBe(true);
      expect(cells[columnCount + 1].classList.contains("bloom-skip")).toBe(true);
    });

    it("maintains proper getSpan functionality", () => {
      const { table, ctrl } = setupTable();
      const firstCell = table.querySelector<HTMLElement>(".bloom-cell");
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
      const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
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

describe("BloomTable undo of structural operations", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
  });

  function setup3x3(): { table: HTMLElement; ctrl: BloomTable } {
    const table = document.createElement("div");
    document.body.appendChild(table);
    attachTable(table); // 2x2
    const ctrl = new BloomTable(table);
    ctrl.addRow();
    ctrl.addColumn();
    // Give every cell distinct text so restores are checkable.
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    cells.forEach((c, i) => (c.textContent = `cell-${i}`));
    return { table, ctrl };
  }

  it("undo of removeRowAt restores every cell's content and the row heights", () => {
    const { table, ctrl } = setup3x3();
    const heightsBefore = table.getAttribute("data-row-heights");
    const textsBefore = Array.from(table.querySelectorAll(".bloom-cell")).map(
      (c) => c.textContent,
    );

    ctrl.removeRowAt(1);
    expect(table.querySelectorAll(".bloom-cell").length).toBe(6);

    expect(ctrl.undo()).toBe(true);
    expect(table.getAttribute("data-row-heights")).toBe(heightsBefore);
    const textsAfter = Array.from(table.querySelectorAll(".bloom-cell")).map(
      (c) => c.textContent,
    );
    expect(textsAfter).toEqual(textsBefore);
  });

  it("undo of addColumnAt restores the column widths and cell count", () => {
    const { table, ctrl } = setup3x3();
    const widthsBefore = table.getAttribute("data-column-widths");

    ctrl.addColumnAt(1);
    expect(table.getAttribute("data-column-widths")!.split(",").length).toBe(4);

    expect(ctrl.undo()).toBe(true);
    expect(table.getAttribute("data-column-widths")).toBe(widthsBefore);
    expect(table.querySelectorAll(".bloom-cell").length).toBe(9);
  });

  it("undo of a merge removes the skip classes and the span attributes", () => {
    const { table, ctrl } = setup3x3();
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));

    ctrl.setSpan(cells[0], 2, 2);
    expect(cells[1].classList.contains("bloom-skip")).toBe(true);

    expect(ctrl.undo()).toBe(true);
    // Undo restores innerHTML, so re-query the (recreated) cells.
    const restored = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    expect(restored.length).toBe(9);
    expect(restored.filter((c) => c.classList.contains("bloom-skip")).length).toBe(0);
    const spanX = restored[0].getAttribute("data-span-x");
    expect(spanX === null || spanX === "1").toBe(true);
  });

  it("undo of duplicateRowAt removes the copy and keeps the source intact", () => {
    const { table, ctrl } = setup3x3();
    const htmlBefore = table.innerHTML;

    ctrl.duplicateRowAt(1);
    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(4);

    expect(ctrl.undo()).toBe(true);
    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(3);
    expect(table.innerHTML).toBe(htmlBefore);
  });
});

describe("BloomTable selection-driven index math", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
  });

  function setup3x3(): { table: HTMLElement; ctrl: BloomTable; cells: HTMLElement[] } {
    const table = document.createElement("div");
    document.body.appendChild(table);
    attachTable(table);
    const ctrl = new BloomTable(table);
    ctrl.addRow();
    ctrl.addColumn();
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    return { table, ctrl, cells };
  }

  it("addRow with a selected cell copies that cell's row and focuses its column", () => {
    const { table, ctrl, cells } = setup3x3();
    // Mark row 1 so inheritance is visible; select r1c2 (index 5 with 3 cols).
    cells[3].setAttribute("data-bg", "#112233");
    cells[4].setAttribute("data-bg", "#112233");
    cells[5].setAttribute("data-bg", "#112233");
    cells[5].classList.add("cell--selected");

    ctrl.addRow();

    const all = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    expect(all.length).toBe(12);
    const newRow = all.slice(9);
    // Inherits the SELECTED row's settings, not row 0's.
    expect(newRow.map((c) => c.getAttribute("data-bg"))).toEqual([
      "#112233",
      "#112233",
      "#112233",
    ]);
    // Focus lands in the new row at the selected column (2).
    expect(newRow[2].contains(document.activeElement)).toBe(true);
  });

  it("addColumn with a selected cell copies that cell's column and focuses its row", () => {
    const { table, ctrl, cells } = setup3x3();
    // Mark column 1; select r2c1 (index 7).
    cells[1].setAttribute("data-bg", "#445566");
    cells[4].setAttribute("data-bg", "#445566");
    cells[7].setAttribute("data-bg", "#445566");
    cells[7].classList.add("cell--selected");

    ctrl.addColumn();

    expect(table.getAttribute("data-column-widths")!.split(",").length).toBe(4);
    const all = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    // New column is the last in each row (indexes 3, 7, 11 with 4 cols).
    const newCol = [all[3], all[7], all[11]];
    expect(newCol.map((c) => c.getAttribute("data-bg"))).toEqual([
      "#445566",
      "#445566",
      "#445566",
    ]);
    // Focus lands in the new column at the selected row (2).
    expect(newCol[2].contains(document.activeElement)).toBe(true);
  });

  it("the selection math still holds when a merge's skip cells sit earlier in the child list", () => {
    const { table, ctrl, cells } = setup3x3();
    // Merge r0c0 across two columns: cells[1] becomes a skip cell but remains a
    // child, so row-major child indexing stays intact.
    ctrl.setSpan(cells[0], 2, 1);
    expect(cells[1].classList.contains("bloom-skip")).toBe(true);

    cells[3].setAttribute("data-bg", "#778899");
    cells[4].setAttribute("data-bg", "#778899");
    cells[5].setAttribute("data-bg", "#778899");
    cells[5].classList.add("cell--selected"); // r1c2

    ctrl.addRow();

    const all = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    const newRow = all.slice(9);
    expect(newRow.map((c) => c.getAttribute("data-bg"))).toEqual([
      "#778899",
      "#778899",
      "#778899",
    ]);
  });

  it("removeRowAt keeps focus in the selected column of the surviving row", () => {
    const { table, ctrl, cells } = setup3x3();
    cells[4].classList.add("cell--selected"); // r1c1

    ctrl.removeRowAt(1);

    const all = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    expect(all.length).toBe(6);
    // Focus target: row min(1, rows-1)=1, column 1 -> index 4 of the 2x3 grid.
    expect(all[4].contains(document.activeElement)).toBe(true);
  });
});
