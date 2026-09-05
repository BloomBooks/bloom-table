import { describe, it, expect } from "vite-plus/test";
import { describeTarget, describeCellPosition, kWholeTableTarget } from "./operation-detail";

function makeTable(columns: number, rows: number): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", Array(columns).fill("hug").join(","));
  table.setAttribute("data-row-heights", Array(rows).fill("hug").join(","));
  for (let i = 0; i < columns * rows; i++) {
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    table.appendChild(cell);
  }
  return table;
}

const cellAt = (table: HTMLElement, i: number): HTMLElement => table.children[i] as HTMLElement;
const cells = (table: HTMLElement, ...indexes: number[]): HTMLElement[] =>
  indexes.map((i) => cellAt(table, i));

describe("describeTarget", () => {
  it("names the whole table with the number of cells it wrote to", () => {
    const table = makeTable(3, 2);
    const all = Array.from(table.children) as HTMLElement[];
    expect(describeTarget(table, "table", all)).toBe(`${kWholeTableTarget} (6 cells)`);
  });

  it("numbers a cell's row and column from one, as a person reads them", () => {
    const table = makeTable(3, 2);
    // Document index 4 is row 1, column 1 counting from zero.
    expect(describeTarget(table, "cell", cells(table, 4))).toBe("cell at row 2, column 2");
  });

  it("names the row a row command wrote to, with its cell count", () => {
    const table = makeTable(3, 2);
    expect(describeTarget(table, "row", cells(table, 3, 4, 5))).toBe("row 2 (3 cells)");
  });

  it("names the column a column command wrote to, with its cell count", () => {
    const table = makeTable(3, 2);
    expect(describeTarget(table, "column", cells(table, 2, 5))).toBe("column 3 (2 cells)");
  });

  it("writes one cell in the singular", () => {
    const table = makeTable(2, 1);
    expect(describeTarget(table, "row", cells(table, 0, 1))).toContain("2 cells");
    expect(describeTarget(table, "table", cells(table, 0))).toContain("1 cell)");
  });

  it("names the row asked for when a spanning cell starts above it", () => {
    // The cell at (0,0) spans both rows, so a command on row 2 collects a cell
    // whose own position is row 1. The largest start is the row asked for.
    const table = makeTable(2, 2);
    cellAt(table, 0).setAttribute("data-span-y", "2");
    cellAt(table, 2).classList.add("bloom-skip");

    expect(describeTarget(table, "row", cells(table, 0, 3))).toBe("row 2 (2 cells)");
  });

  it("says so when a command wrote to no cells", () => {
    expect(describeTarget(makeTable(2, 2), "row", [])).toBe("no cells");
  });

  it("counts the cells when none of them belongs to the table", () => {
    const table = makeTable(2, 2);
    const stranger = document.createElement("div");
    stranger.className = "bloom-cell";
    expect(describeTarget(table, "row", [stranger])).toBe("1 cell");
  });

  it("reports the whole table even when the cell list is empty", () => {
    expect(describeTarget(makeTable(2, 2), "table", [])).toBe(`${kWholeTableTarget} (0 cells)`);
  });
});

describe("describeCellPosition", () => {
  it("numbers the cell's row and column from one", () => {
    const table = makeTable(3, 2);
    expect(describeCellPosition(table, cellAt(table, 5))).toBe("cell at row 2, column 3");
  });

  it("answers nothing for a cell of another table", () => {
    const table = makeTable(2, 2);
    const other = makeTable(2, 2);
    expect(describeCellPosition(table, cellAt(other, 0))).toBeNull();
  });

  it("answers nothing for a cell of a nested table, which the outer grid does not hold", () => {
    const outer = makeTable(2, 1);
    const inner = makeTable(2, 1);
    cellAt(outer, 0).appendChild(inner);
    expect(describeCellPosition(outer, cellAt(inner, 1))).toBeNull();
  });
});
