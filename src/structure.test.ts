import { it, expect, beforeEach, afterEach, describe } from "vite-plus/test";
import {
  addColumn,
  addColumnAt,
  addRow,
  addRowAt,
  defaultColumnWidth,
  defaultRowHeight,
  getCell,
  getTableCells,
  getTableInfo,
  moveColumnAt,
  moveRowAt,
  removeColumnAt,
  removeLastColumn,
  removeLastRow,
  removeRowAt,
  setCellSpan,
} from "./structure";

import { tableHistoryManager } from "./history";
import { attachTable } from "./attach";

beforeEach(() => {
  // Reset the DOM for each test
  document.body.innerHTML = "";
});

afterEach(() => {
  // Clean up any DOM elements and reset history
  document.body.innerHTML = "";
  tableHistoryManager.reset();
});

it("addColumn adds widths", () => {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", "100px,200px");
  table.setAttribute("data-row-heights", "50px,100px");
  document.body.appendChild(table);
  attachTable(table); // Attach table to history manager

  addColumn(table);

  expect(table.getAttribute("data-column-widths")).toBe(`100px,200px,${defaultColumnWidth}`);
});

function newTable(): HTMLDivElement {
  const table = document.createElement("div");
  document.body.appendChild(table);
  attachTable(table);
  return table;
}
it("attach(empty div) gets 2x2 table", () => {
  const table = newTable();
  const info = getTableInfo(table);
  expect(info.columnWidths).lengthOf(2);
  expect(info.rowHeights).lengthOf(2);
  expect(info.cellCount).toBe(4);
});

it("addColumn adds a new cell to all rows", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addColumn(table);
  const info = getTableInfo(table);
  expect(info.columnCount).toBe(original.columnCount + 1);
  expect(info.cellCount).toBe(original.cellCount + original.rowCount);
});
it("addRow adds a new cell to all columns", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addRow(table);
  const info = getTableInfo(table);
  expect(info.rowCount).toBe(original.rowCount + 1);
  expect(info.cellCount).toBe(original.cellCount + original.columnCount);
});
it("addRow adds heights", () => {
  const table = newTable();
  table.setAttribute("data-column-widths", "100px,200px");
  table.setAttribute("data-row-heights", "50px,100px");

  addRow(table);

  expect(table.getAttribute("data-row-heights")).toBe(`50px,100px,${defaultRowHeight}`);
});
it("removeLastRow removes the last row of cells", () => {
  const table = newTable();
  const original = getTableInfo(table);
  removeLastRow(table);
  const info = getTableInfo(table);
  expect(info.rowCount).toBe(original.rowCount - 1);
  expect(info.cellCount).toBe(original.cellCount - original.columnCount);
});

it("removeLastRow updates row heights", () => {
  const table = newTable();
  table.setAttribute("data-column-widths", "100px,200px");
  table.setAttribute("data-row-heights", "50px,100px");

  removeLastRow(table);

  expect(table.getAttribute("data-row-heights")).toBe("50px");
});

it("removeLastRow does nothing if no rows exist", () => {
  const table = newTable();
  table.setAttribute("data-row-heights", "");
  const original = getTableInfo(table);
  removeLastRow(table);
  const info = getTableInfo(table);
  expect(info.rowCount).toBe(original.rowCount);
  expect(info.cellCount).toBe(original.cellCount);
});

it("removeLastColumn removes the last column of cells", () => {
  const table = newTable();
  const original = getTableInfo(table);
  removeLastColumn(table);
  const info = getTableInfo(table);
  expect(info.columnCount).toBe(original.columnCount - 1);
  expect(info.cellCount).toBe(original.cellCount - original.rowCount);
});

it("removeLastColumn updates column widths", () => {
  const table = newTable();
  table.setAttribute("data-column-widths", "100px,200px");
  table.setAttribute("data-row-heights", "50px,100px");

  removeLastColumn(table);

  expect(table.getAttribute("data-column-widths")).toBe("100px");
});

it("removeLastColumn does nothing if no columns exist", () => {
  const table = newTable();
  table.setAttribute("data-column-widths", "");
  const original = getTableInfo(table);
  removeLastColumn(table);
  const info = getTableInfo(table);
  expect(info.columnCount).toBe(original.columnCount);
  expect(info.cellCount).toBe(original.cellCount);
});

function expectCellToBeSkipped(table: HTMLElement, row: number, column: number) {
  const cell = getCell(table, row, column);
  expect(cell.classList.contains("bloom-skip")).toBeTruthy();
}

function expectCellToNotBeSkipped(table: HTMLElement, row: number, column: number) {
  const cell = getCell(table, row, column);
  expect(cell.classList.contains("bloom-skip")).toBeFalsy();
}
describe("span-related tests", () => {
  it("setCellSpan(2,1) marks cell to the right with 'skip' class", () => {
    const table = newTable();
    const original = getTableInfo(table);
    // mark the one we expect to be removed
    const cellR0C1 = getCell(table, 0, 1);
    cellR0C1.id = "cell-R0C1";
    expect(document.getElementById("cell-R0C1")).toBeTruthy();

    // Set span for the first cell to be two columns wide
    const cellR0C0 = getCell(table, 0, 0);
    setCellSpan(cellR0C0, 2, 1);
    const info = getTableInfo(table);
    expect(info.columnCount).toBe(original.columnCount);
    expect(info.rowCount).toBe(original.rowCount);
    // expect data-* and CSS var to have been set
    expect(cellR0C0.getAttribute("data-span-x")).toBe("2");
    const styleString = cellR0C0.getAttribute("style");
    expect(styleString).toContain("--span-x: 2");

    // now look at the neighboring cell
    expectCellToBeSkipped(table, 0, 1);
  });

  it("setCellSpan(1,2) marks cell to below with 'skip' class", () => {
    const table = newTable();
    const original = getTableInfo(table);
    // mark the one we expect to be removed
    const cellR1C0 = getCell(table, 1, 0);
    cellR1C0.id = "cell-R1C0";
    expect(document.getElementById("cell-R1C0")).toBeTruthy();

    // Set span for the first cell to be two rows tall
    const cellR0C0 = getCell(table, 0, 0);
    setCellSpan(cellR0C0, 1, 2);
    const info = getTableInfo(table);
    expect(info.columnCount).toBe(original.columnCount);
    expect(info.rowCount).toBe(original.rowCount);
    // expect data-* and CSS var to have been set
    expect(cellR0C0.getAttribute("data-span-y")).toBe("2");
    const styleString = cellR0C0.getAttribute("style");
    expect(styleString).toContain("--span-y: 2");

    // now look at the neighboring cell
    expectCellToBeSkipped(table, 1, 0);
  });

  it("setCellSpan(2,2) marks cells to the right and below as skipped", () => {
    const table = newTable();
    const original = getTableInfo(table);
    // mark the ones we expect to be removed
    const cellR0C1 = getCell(table, 0, 1);
    cellR0C1.id = "cell-R0C1";
    const cellR1C0 = getCell(table, 1, 0);
    cellR1C0.id = "cell-R1C0";
    const cellR1C1 = getCell(table, 1, 1);
    cellR1C1.id = "cell-R1C1";
    expect(document.getElementById("cell-R0C1")).toBeTruthy();
    expect(document.getElementById("cell-R1C0")).toBeTruthy();
    expect(document.getElementById("cell-R1C1")).toBeTruthy();

    // Set span for the first cell to be two columns wide and two rows tall
    const cellR0C0 = getCell(table, 0, 0);
    setCellSpan(cellR0C0, 2, 2);
    const info = getTableInfo(table);
    expect(info.columnCount).toBe(original.columnCount);
    expect(info.rowCount).toBe(original.rowCount);
    // expect data-* and CSS var to have been set
    expect(cellR0C0.getAttribute("data-span-x")).toBe("2");
    expect(cellR0C0.getAttribute("data-span-y")).toBe("2");
    const styleString = cellR0C0.getAttribute("style");
    expect(styleString).toContain("--span-x: 2");
    expect(styleString).toContain("--span-y: 2");

    // three cells should be skipped
    expectCellToBeSkipped(table, 0, 1); // right
    expectCellToBeSkipped(table, 1, 0); // below
    expectCellToBeSkipped(table, 1, 1); // below and to the right
  });

  it("reducing span from (2,1) to (1,1) unskips cells", () => {
    const table = newTable();
    // First expand the span
    const cellR0C0 = getCell(table, 0, 0);
    setCellSpan(cellR0C0, 2, 1);
    expectCellToBeSkipped(table, 0, 1);

    // Now reduce the span back to 1x1
    setCellSpan(cellR0C0, 1, 1);
    // expect the data-* and style to reflect 1x1
    expect(cellR0C0.getAttribute("data-span-x")).toBe("1");
    expect(cellR0C0.getAttribute("data-span-y")).toBe("1");
    const styleString = cellR0C0.getAttribute("style") || "";
    expect(styleString).not.toContain("--span-x");
    expect(styleString).not.toContain("--span-y");
    expectCellToNotBeSkipped(table, 0, 1); // should no longer be skipped
  });

  it("reducing span from (1,2) to (1,1) unskips cell", () => {
    const table = newTable();

    // First expand the vertical span to remove a cell
    const cellR0C0 = getCell(table, 0, 0);
    setCellSpan(cellR0C0, 1, 2);
    expectCellToBeSkipped(table, 1, 0);
    expectCellToNotBeSkipped(table, 0, 1);

    // Now reduce the span back to 1x1 - should unskip the cell
    setCellSpan(cellR0C0, 1, 1);
    expectCellToNotBeSkipped(table, 1, 0); // should no longer be skipped
  });

  it("reducing span from (2,2) to (1,1) adds cells back", () => {
    const table = newTable();

    // First expand the span
    const cellR0C0 = getCell(table, 0, 0);
    setCellSpan(cellR0C0, 2, 2);

    expectCellToBeSkipped(table, 0, 1); // right
    expectCellToBeSkipped(table, 1, 0); // below
    expectCellToBeSkipped(table, 1, 1); // below and to the right

    // Now reduce the span back to 1x1
    setCellSpan(cellR0C0, 1, 1);

    expectCellToNotBeSkipped(table, 0, 1); // should no longer be skipped
    expectCellToNotBeSkipped(table, 1, 0); // should no longer be skipped
    expectCellToNotBeSkipped(table, 1, 1); // should no longer be skipped
  });

  it("expanding from (1,1) to (3,1) should fail if exceeds table bounds", () => {
    const table = newTable(); // 2x2 table
    const cellR0C0 = getCell(table, 0, 0);

    // Should throw error when trying to span 3 columns in a 2-column table
    expect(() => setCellSpan(cellR0C0, 3, 1)).toThrow();
  });

  it("expanding from (1,1) to (1,3) should fail if exceeds table bounds", () => {
    const table = newTable(); // 2x2 table
    const cellR0C0 = getCell(table, 0, 0);

    // Should throw error when trying to span 3 rows in a 2-row table
    expect(() => setCellSpan(cellR0C0, 1, 3)).toThrow();
  });
});

// Basic positional add/remove tests
it("addColumnAt(0) adds column at start", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addColumnAt(table, 0);
  const info = getTableInfo(table);
  expect(info.columnCount).toBe(original.columnCount + 1);
  expect(info.cellCount).toBe(original.cellCount + original.rowCount);
});

it("addColumnAt(1) adds column in middle", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addColumnAt(table, 1);
  const info = getTableInfo(table);
  expect(info.columnCount).toBe(original.columnCount + 1);
  expect(info.cellCount).toBe(original.cellCount + original.rowCount);
});

it("addRowAt(0) adds row at start", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addRowAt(table, 0);
  const info = getTableInfo(table);
  expect(info.rowCount).toBe(original.rowCount + 1);
  expect(info.cellCount).toBe(original.cellCount + original.columnCount);
});

it("addRowAt(1) adds row in middle", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addRowAt(table, 1);
  const info = getTableInfo(table);
  expect(info.rowCount).toBe(original.rowCount + 1);
  expect(info.cellCount).toBe(original.cellCount + original.columnCount);
});

it("removeColumnAt(0) removes first column", () => {
  const table = newTable();
  addColumn(table); // Make sure we have enough columns
  const original = getTableInfo(table);
  removeColumnAt(table, 0);
  const info = getTableInfo(table);
  expect(info.columnCount).toBe(original.columnCount - 1);
  expect(info.cellCount).toBe(original.cellCount - original.rowCount);
});

it("removeRowAt(0) removes first row", () => {
  const table = newTable();
  addRow(table); // Make sure we have enough rows
  const original = getTableInfo(table);
  removeRowAt(table, 0);
  const info = getTableInfo(table);
  expect(info.rowCount).toBe(original.rowCount - 1);
  expect(info.cellCount).toBe(original.cellCount - original.columnCount);
});

it("removeColumnAt throws error when removing only column", () => {
  const table = newTable();
  // Remove all but one column
  while (getTableInfo(table).columnCount > 1) {
    removeLastColumn(table);
  }
  expect(() => removeColumnAt(table, 0)).toThrow();
});

it("removeRowAt throws error when removing only row", () => {
  const table = newTable();
  // Remove all but one row
  while (getTableInfo(table).rowCount > 1) {
    removeLastRow(table);
  }
  expect(() => removeRowAt(table, 0)).toThrow();
});

// Test cell positioning after operations
it("addColumnAt(0) inserts cells at correct positions", () => {
  const table = newTable();
  // Label cells before operation
  const cells = Array.from(table.children).filter((child) =>
    child.classList.contains("bloom-cell"),
  ) as HTMLElement[];
  cells.forEach((cell, index) => {
    cell.id = `original-${index}`;
  });

  const originalInfo = getTableInfo(table);
  addColumnAt(table, 0);
  const newInfo = getTableInfo(table);

  expect(newInfo.columnCount).toBe(originalInfo.columnCount + 1);
  expect(newInfo.cellCount).toBe(originalInfo.cellCount + originalInfo.rowCount);
  // Check that original cells can still be found (they moved positions)
  const originalCells = Array.from(table.children).filter(
    (child) => child.classList.contains("bloom-cell") && child.id.startsWith("original-"),
  ) as HTMLElement[];
  expect(originalCells.length).toBe(originalInfo.cellCount);
});

it("removeColumnAt(1) removes correct cells", () => {
  const table = newTable();
  addColumn(table); // Start with 3 columns

  const originalInfo = getTableInfo(table);
  removeColumnAt(table, 1); // Remove middle column
  const newInfo = getTableInfo(table);

  expect(newInfo.columnCount).toBe(originalInfo.columnCount - 1);
  expect(newInfo.cellCount).toBe(originalInfo.cellCount - originalInfo.rowCount);
});

// Test span handling during removal
it("removeColumnAt reduces span when removing column", () => {
  const table = newTable();
  addColumn(table); // 3x2 table

  const cell = getCell(table, 0, 0);
  setCellSpan(cell, 3, 1); // Span across all 3 columns

  removeColumnAt(table, 1); // Remove middle column

  const spanX = parseInt(cell.style.getPropertyValue("--span-x")) || 1;
  expect(spanX).toBe(2); // Should be reduced from 3 to 2
});

it("removeRowAt reduces span when removing row", () => {
  const table = newTable();
  addRow(table); // 2x3 table

  const cell = getCell(table, 0, 0);
  setCellSpan(cell, 1, 3); // Span across all 3 rows

  removeRowAt(table, 1); // Remove middle row

  const spanY = parseInt(cell.style.getPropertyValue("--span-y")) || 1;
  expect(spanY).toBe(2); // Should be reduced from 3 to 2
});

// Error handling tests
it("addColumnAt throws error for invalid index", () => {
  const table = newTable();
  const info = getTableInfo(table);
  expect(() => addColumnAt(table, -1)).toThrow();
  expect(() => addColumnAt(table, info.columnCount + 1)).toThrow();
});

it("addRowAt throws error for invalid index", () => {
  const table = newTable();
  const info = getTableInfo(table);
  expect(() => addRowAt(table, -1)).toThrow();
  expect(() => addRowAt(table, info.rowCount + 1)).toThrow();
});

it("removeColumnAt throws error for invalid index", () => {
  const table = newTable();
  const info = getTableInfo(table);
  expect(() => removeColumnAt(table, -1)).toThrow();
  expect(() => removeColumnAt(table, info.columnCount)).toThrow();
});

it("removeRowAt throws error for invalid index", () => {
  const table = newTable();
  const info = getTableInfo(table);
  expect(() => removeRowAt(table, -1)).toThrow();
  expect(() => removeRowAt(table, info.rowCount)).toThrow();
});

// Test that operations work correctly at end positions
it("addColumnAt works when adding at end", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addColumnAt(table, original.columnCount); // Add at end
  const info = getTableInfo(table);
  expect(info.columnCount).toBe(original.columnCount + 1);
});

it("addRowAt works when adding at end", () => {
  const table = newTable();
  const original = getTableInfo(table);
  addRowAt(table, original.rowCount); // Add at end
  const info = getTableInfo(table);
  expect(info.rowCount).toBe(original.rowCount + 1);
});

// Complex span scenario
it("complex span handling: multiple cells affected", () => {
  const table = newTable();
  addColumn(table);
  addColumn(table); // 4x2 table

  // Set up multiple spans
  const cell00 = getCell(table, 0, 0);
  const cell01 = getCell(table, 0, 2);
  setCellSpan(cell00, 2, 1); // Spans columns 0-1
  setCellSpan(cell01, 2, 1); // Spans columns 2-3

  removeColumnAt(table, 1); // Remove column 1

  // Check that spans were adjusted correctly
  const span00 = parseInt(cell00.style.getPropertyValue("--span-x")) || 1;
  const span01 = parseInt(cell01.style.getPropertyValue("--span-x")) || 1;

  expect(span00).toBe(1); // Reduced from 2 to 1
  expect(span01).toBe(2); // Should remain 2 (now spans columns 1-2)
});

// Tests for proper cell positioning and content preservation
describe("Cell positioning and content preservation", () => {
  it("addColumnAt(0) preserves cell content and positions correctly", () => {
    const table = newTable(); // Add content to cells to verify they're preserved
    const cells = getTableCells(table);
    cells.forEach((cell, index) => {
      const div = cell.querySelector("div");
      if (div) div.textContent = `Original-${index}`;
      cell.id = `orig-${index}`;
    });

    const originalInfo = getTableInfo(table);
    addColumnAt(table, 0);
    const newInfo = getTableInfo(table);

    // Check structure
    expect(newInfo.columnCount).toBe(originalInfo.columnCount + 1);
    expect(newInfo.cellCount).toBe(originalInfo.cellCount + originalInfo.rowCount); // Check that original cells still exist with their content
    const originalCells = Array.from(table.children).filter(
      (child) => child.classList.contains("bloom-cell") && child.id.startsWith("orig-"),
    ) as HTMLElement[];
    expect(originalCells.length).toBe(originalInfo.cellCount);

    // Verify content is preserved
    originalCells.forEach((cell) => {
      const div = cell.querySelector("div");
      expect(div?.textContent).toMatch(/^Original-\d+$/);
    });
  });

  it("addRowAt(0) preserves cell content and positions correctly", () => {
    const table = newTable(); // Add content to cells to verify they're preserved
    const cells = getTableCells(table);
    cells.forEach((cell, index) => {
      const div = cell.querySelector("div");
      if (div) div.textContent = `Original-${index}`;
      cell.id = `orig-${index}`;
    });

    const originalInfo = getTableInfo(table);
    addRowAt(table, 0);
    const newInfo = getTableInfo(table);

    // Check structure
    expect(newInfo.rowCount).toBe(originalInfo.rowCount + 1);
    expect(newInfo.cellCount).toBe(originalInfo.cellCount + originalInfo.columnCount); // Check that original cells still exist with their content
    const originalCells = Array.from(table.children).filter(
      (child) => child.classList.contains("bloom-cell") && child.id.startsWith("orig-"),
    ) as HTMLElement[];
    expect(originalCells.length).toBe(originalInfo.cellCount);

    // Verify content is preserved
    originalCells.forEach((cell) => {
      const div = cell.querySelector("div");
      expect(div?.textContent).toMatch(/^Original-\d+$/);
    });
  });

  it("removeColumnAt preserves unaffected cell content", () => {
    const table = newTable();
    addColumn(table); // 3x2 table

    // Add content to cells
    const cells = getTableCells(table);
    cells.forEach((cell, index) => {
      const div = cell.querySelector("div");
      if (div) div.textContent = `Cell-${index}`;
      cell.id = `cell-${index}`;
    });

    // Remove middle column
    removeColumnAt(table, 1);

    // Cells at positions that weren't removed should still exist
    // In a 3x2 table, removing column 1 should remove cells at (0,1) and (1,1)
    // Original cells: (0,0)=0, (0,1)=1, (0,2)=2, (1,0)=3, (1,1)=4, (1,2)=5
    // After removing column 1: cells 1 and 4 should be gone
    expect(document.getElementById("cell-0")).toBeTruthy(); // (0,0)
    expect(document.getElementById("cell-1")).toBeNull(); // (0,1) - removed
    expect(document.getElementById("cell-2")).toBeTruthy(); // (0,2)
    expect(document.getElementById("cell-3")).toBeTruthy(); // (1,0)
    expect(document.getElementById("cell-4")).toBeNull(); // (1,1) - removed
    expect(document.getElementById("cell-5")).toBeTruthy(); // (1,2)

    // Verify remaining cells have their content
    expect(document.getElementById("cell-0")?.querySelector("div")?.textContent).toBe("Cell-0");
    expect(document.getElementById("cell-2")?.querySelector("div")?.textContent).toBe("Cell-2");
    expect(document.getElementById("cell-3")?.querySelector("div")?.textContent).toBe("Cell-3");
    expect(document.getElementById("cell-5")?.querySelector("div")?.textContent).toBe("Cell-5");
  });

  it("removeRowAt preserves unaffected cell content", () => {
    const table = newTable();
    addRow(table); // 2x3 table

    // Add content to cells
    const cells = getTableCells(table);
    cells.forEach((cell, index) => {
      const div = cell.querySelector("div");
      if (div) div.textContent = `Cell-${index}`;
      cell.id = `cell-${index}`;
    });

    // Remove middle row
    removeRowAt(table, 1);

    // Cells at positions that weren't removed should still exist
    // In a 2x3 table, removing row 1 should remove cells at (1,0) and (1,1)
    // Original cells: (0,0)=0, (0,1)=1, (1,0)=2, (1,1)=3, (2,0)=4, (2,1)=5
    // After removing row 1: cells 2 and 3 should be gone
    expect(document.getElementById("cell-0")).toBeTruthy(); // (0,0)
    expect(document.getElementById("cell-1")).toBeTruthy(); // (0,1)
    expect(document.getElementById("cell-2")).toBeNull(); // (1,0) - removed
    expect(document.getElementById("cell-3")).toBeNull(); // (1,1) - removed
    expect(document.getElementById("cell-4")).toBeTruthy(); // (2,0)
    expect(document.getElementById("cell-5")).toBeTruthy(); // (2,1)

    // Verify remaining cells have their content
    expect(document.getElementById("cell-0")?.querySelector("div")?.textContent).toBe("Cell-0");
    expect(document.getElementById("cell-1")?.querySelector("div")?.textContent).toBe("Cell-1");
    expect(document.getElementById("cell-4")?.querySelector("div")?.textContent).toBe("Cell-4");
    expect(document.getElementById("cell-5")?.querySelector("div")?.textContent).toBe("Cell-5");
  });
});

// Edge case tests
describe("Edge cases for add/remove operations", () => {
  it("addColumnAt and removeColumnAt work correctly at start, middle, and end", () => {
    const table = newTable();
    addColumn(table);
    addColumn(table); // 4x2 table

    // Test adding at start
    const startInfo = getTableInfo(table);
    addColumnAt(table, 0);
    expect(getTableInfo(table).columnCount).toBe(startInfo.columnCount + 1);

    // Test adding in middle
    const midInfo = getTableInfo(table);
    addColumnAt(table, 2);
    expect(getTableInfo(table).columnCount).toBe(midInfo.columnCount + 1);

    // Test adding at end
    const endInfo = getTableInfo(table);
    addColumnAt(table, endInfo.columnCount);
    expect(getTableInfo(table).columnCount).toBe(endInfo.columnCount + 1);

    // Now test removing from different positions
    const beforeRemove = getTableInfo(table);

    // Remove from end
    removeColumnAt(table, beforeRemove.columnCount - 1);
    expect(getTableInfo(table).columnCount).toBe(beforeRemove.columnCount - 1);

    // Remove from middle
    const midRemove = getTableInfo(table);
    removeColumnAt(table, Math.floor(midRemove.columnCount / 2));
    expect(getTableInfo(table).columnCount).toBe(midRemove.columnCount - 1);

    // Remove from start
    const startRemove = getTableInfo(table);
    removeColumnAt(table, 0);
    expect(getTableInfo(table).columnCount).toBe(startRemove.columnCount - 1);
  });

  it("addRowAt and removeRowAt work correctly at start, middle, and end", () => {
    const table = newTable();
    addRow(table);
    addRow(table); // 2x4 table

    // Test adding at start
    const startInfo = getTableInfo(table);
    addRowAt(table, 0);
    expect(getTableInfo(table).rowCount).toBe(startInfo.rowCount + 1);

    // Test adding in middle
    const midInfo = getTableInfo(table);
    addRowAt(table, 2);
    expect(getTableInfo(table).rowCount).toBe(midInfo.rowCount + 1);

    // Test adding at end
    const endInfo = getTableInfo(table);
    addRowAt(table, endInfo.rowCount);
    expect(getTableInfo(table).rowCount).toBe(endInfo.rowCount + 1);

    // Now test removing from different positions
    const beforeRemove = getTableInfo(table);

    // Remove from end
    removeRowAt(table, beforeRemove.rowCount - 1);
    expect(getTableInfo(table).rowCount).toBe(beforeRemove.rowCount - 1);

    // Remove from middle
    const midRemove = getTableInfo(table);
    removeRowAt(table, Math.floor(midRemove.rowCount / 2));
    expect(getTableInfo(table).rowCount).toBe(midRemove.rowCount - 1);

    // Remove from start
    const startRemove = getTableInfo(table);
    removeRowAt(table, 0);
    expect(getTableInfo(table).rowCount).toBe(startRemove.rowCount - 1);
  });
});
describe("inserted rows/columns inherit the source's settings", () => {
  function build(cols: string[], rows: string[]): HTMLDivElement {
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", cols.join(","));
    table.setAttribute("data-row-heights", rows.join(","));
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const cell = document.createElement("div");
        cell.className = "bloom-cell";
        table.appendChild(cell);
      }
    }
    document.body.appendChild(table);
    attachTable(table);
    return table;
  }

  it("addRowAt copies the source row's height and cell fill/align/pad/corners", () => {
    const table = build(["100px", "fill"], ["20px", "30px"]);
    // Decorate source row 0
    const c00 = getCell(table, 0, 0);
    const c01 = getCell(table, 0, 1);
    c00.setAttribute("data-bg", "#ff0000");
    c00.setAttribute("data-align", "end");
    c01.setAttribute("data-pad", "8px");
    c01.setAttribute("data-corners", '{"radius":4}');

    // Insert a new row below row 0 (at index 1), sourced from row 0
    addRowAt(table, 1, false, 0);

    expect(table.getAttribute("data-row-heights")).toBe("20px,20px,30px");
    const n0 = getCell(table, 1, 0);
    const n1 = getCell(table, 1, 1);
    expect(n0.getAttribute("data-bg")).toBe("#ff0000");
    expect(n0.getAttribute("data-align")).toBe("end");
    expect(n1.getAttribute("data-pad")).toBe("8px");
    expect(n1.getAttribute("data-corners")).toBe('{"radius":4}');
  });

  it("addColumnAt copies the source column's width and cell settings", () => {
    const table = build(["100px", "fill"], ["20px", "30px"]);
    const c01 = getCell(table, 0, 1);
    const c11 = getCell(table, 1, 1);
    c01.setAttribute("data-bg", "#00ff00");
    c11.setAttribute("data-align", "start");

    // Insert a new column left of column 1, sourced from column 1
    addColumnAt(table, 1, false, 1);

    expect(table.getAttribute("data-column-widths")).toBe("100px,fill,fill");
    expect(getCell(table, 0, 1).getAttribute("data-bg")).toBe("#00ff00");
    expect(getCell(table, 1, 1).getAttribute("data-align")).toBe("start");
  });

  it("does not copy settings when no source index is given", () => {
    const table = build(["100px", "fill"], ["20px", "30px"]);
    getCell(table, 0, 0).setAttribute("data-bg", "#ff0000");
    addRowAt(table, 1);
    expect(getCell(table, 1, 0).getAttribute("data-bg")).toBe(null);
    expect(table.getAttribute("data-row-heights")).toBe(`20px,${defaultRowHeight},30px`);
  });

  it("inserted row inherits the source row's borders and keeps neighbours aligned", () => {
    const table = build(["100px", "fill"], ["20px", "30px"]);
    // Vertical edges R x (C+1): give source row 0 a left perimeter border
    const left = { weight: 2, style: "solid", color: "#123456" };
    table.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [left, {}, {}],
        [{}, {}, {}],
      ]),
    );
    // Horizontal edges (R+1) x C, all empty
    table.setAttribute(
      "data-edges-h",
      JSON.stringify([
        [{}, {}],
        [{}, {}],
        [{}, {}],
      ]),
    );

    addRowAt(table, 1, false, 0);

    const v = JSON.parse(table.getAttribute("data-edges-v")!);
    expect(v).lengthOf(3); // one row added
    expect(v[0][0]).toEqual(left); // original source row preserved
    expect(v[1][0]).toEqual(left); // new row inherited the left border
    const h = JSON.parse(table.getAttribute("data-edges-h")!);
    expect(h).lengthOf(4); // one boundary added (R+1 -> R+2)
  });
});

describe("moveRowAt / moveColumnAt", () => {
  // Build a table whose cells carry their "r,c" coordinates as text so we can
  // assert the DOM order after a move.
  function buildLabeled(cols: string[], rows: string[]): HTMLDivElement {
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", cols.join(","));
    table.setAttribute("data-row-heights", rows.join(","));
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const cell = document.createElement("div");
        cell.className = "bloom-cell";
        cell.textContent = `${r},${c}`;
        table.appendChild(cell);
      }
    }
    document.body.appendChild(table);
    attachTable(table);
    return table;
  }

  it("moveRowAt reorders cells, heights, and vertical edges", () => {
    const table = buildLabeled(["100px", "fill"], ["10px", "20px", "30px"]);
    // Tag each row's vertical edges so we can follow them.
    table.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [{ id: "r0" }, {}, {}],
        [{ id: "r1" }, {}, {}],
        [{ id: "r2" }, {}, {}],
      ]),
    );

    moveRowAt(table, 0, 2); // move first row to the bottom

    expect(table.getAttribute("data-row-heights")).toBe("20px,30px,10px");
    expect(getCell(table, 0, 0).textContent).toBe("1,0");
    expect(getCell(table, 2, 1).textContent).toBe("0,1");
    const v = JSON.parse(table.getAttribute("data-edges-v")!);
    expect(v.map((row: { id?: string }[]) => row[0].id)).toEqual(["r1", "r2", "r0"]);
  });

  it("moveRowAt keeps the table's bottom horizontal boundary fixed", () => {
    const table = buildLabeled(["100px", "fill"], ["10px", "20px"]);
    table.setAttribute(
      "data-edges-h",
      JSON.stringify([[{ id: "top" }, {}], [{ id: "mid" }, {}], [{ id: "bottom" }, {}]]),
    );
    moveRowAt(table, 0, 1); // swap the two rows
    const h = JSON.parse(table.getAttribute("data-edges-h")!);
    // Row-top boundaries swap; the final (table-bottom) boundary stays put.
    expect(h.map((row: { id?: string }[]) => row[0].id)).toEqual(["mid", "top", "bottom"]);
  });

  it("moveColumnAt reorders cells and widths", () => {
    const table = buildLabeled(["100px", "200px", "fill"], ["10px", "20px"]);
    moveColumnAt(table, 2, 0); // move last column to the front

    expect(table.getAttribute("data-column-widths")).toBe("fill,100px,200px");
    expect(getCell(table, 0, 0).textContent).toBe("0,2");
    expect(getCell(table, 1, 2).textContent).toBe("1,1");
  });

  it("moveColumnAt keeps the table's right vertical boundary fixed", () => {
    const table = buildLabeled(["100px", "200px"], ["10px", "20px"]);
    table.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [{ id: "left" }, { id: "mid" }, { id: "right" }],
        [{ id: "left" }, { id: "mid" }, { id: "right" }],
      ]),
    );
    moveColumnAt(table, 0, 1); // swap the two columns
    const v = JSON.parse(table.getAttribute("data-edges-v")!);
    // Column-left boundaries swap; the final (table-right) boundary stays put.
    expect(v[0].map((e: { id?: string }) => e.id)).toEqual(["mid", "left", "right"]);
  });

  it("moveRowAt is a no-op when from === to", () => {
    const table = buildLabeled(["100px", "fill"], ["10px", "20px"]);
    moveRowAt(table, 1, 1);
    expect(table.getAttribute("data-row-heights")).toBe("10px,20px");
    expect(getCell(table, 0, 0).textContent).toBe("0,0");
  });
});
