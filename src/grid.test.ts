import { describe, it, expect } from "vite-plus/test";
import { buildGrid, cellsOf } from "./grid";

function makeTable(columns: string, rows: string, cellCount: number): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", columns);
  table.setAttribute("data-row-heights", rows);
  for (let i = 0; i < cellCount; i++) {
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    cell.textContent = String(i);
    table.appendChild(cell);
  }
  return table;
}

const cellAtIndex = (table: HTMLElement, i: number): HTMLElement =>
  table.children[i] as HTMLElement;

describe("cellsOf", () => {
  it("returns the table's own cells in document order", () => {
    const table = makeTable("hug,hug", "hug,hug", 4);
    expect(cellsOf(table).map((c) => c.textContent)).toEqual(["0", "1", "2", "3"]);
  });

  it("includes a skip cell, because a skip still occupies its slot", () => {
    const table = makeTable("hug,hug", "hug", 2);
    cellAtIndex(table, 1).classList.add("bloom-skip");
    expect(cellsOf(table).length).toBe(2);
  });

  it("ignores a child that is not a cell", () => {
    const table = makeTable("hug,hug", "hug", 2);
    const overlay = document.createElement("div");
    overlay.className = "bloom-table-overlay";
    table.appendChild(overlay);
    expect(cellsOf(table).length).toBe(2);
  });

  it("returns only the outer table's cells, not a nested table's", () => {
    const outer = makeTable("hug,hug", "hug", 2);
    const inner = makeTable("hug,hug", "hug", 2);
    cellAtIndex(outer, 0).appendChild(inner);

    expect(cellsOf(outer).length).toBe(2);
    expect(cellsOf(inner).map((c) => c.textContent)).toEqual(["0", "1"]);
  });

  it("refuses an element that is not a table", () => {
    const notATable = document.createElement("div");
    expect(() => cellsOf(notATable)).toThrow(/must have/);
  });
});

describe("buildGrid dimensions and positions", () => {
  it("takes the row and column counts from the size attributes", () => {
    const grid = buildGrid(makeTable("hug,hug,hug", "hug,hug", 6));
    expect(grid.rows).toBe(2);
    expect(grid.cols).toBe(3);
  });

  it("places each cell at the position its document order gives it", () => {
    const table = makeTable("hug,hug,hug", "hug,hug", 6);
    const grid = buildGrid(table);
    expect(grid.posOf.get(cellAtIndex(table, 0))).toEqual({ row: 0, column: 0 });
    expect(grid.posOf.get(cellAtIndex(table, 2))).toEqual({ row: 0, column: 2 });
    expect(grid.posOf.get(cellAtIndex(table, 3))).toEqual({ row: 1, column: 0 });
    expect(grid.posOf.get(cellAtIndex(table, 5))).toEqual({ row: 1, column: 2 });
  });

  it("gives no position to a cell past the declared grid", () => {
    // Seven cells in a table that declares six slots: the last one is broken
    // data and has nowhere to sit.
    const table = makeTable("hug,hug,hug", "hug,hug", 7);
    const grid = buildGrid(table);
    expect(grid.posOf.has(cellAtIndex(table, 6))).toBe(false);
    expect(grid.posOf.size).toBe(6);
  });

  it("places nothing when the table declares no columns", () => {
    // An empty size attribute declares zero positions, so no cell has a place
    // to sit even though the cells are there.
    const table = makeTable("", "hug", 2);
    const grid = buildGrid(table);
    expect(grid.cols).toBe(0);
    expect(grid.posOf.size).toBe(0);
    expect(grid.cells.length).toBe(2);
  });

  it("gives an empty token the default size, so it still counts as a position", () => {
    const grid = buildGrid(makeTable("hug,,hug", "hug", 3));
    expect(grid.cols).toBe(3);
  });
});

describe("buildGrid cellAt", () => {
  it("returns the cell sitting at a position", () => {
    const table = makeTable("hug,hug", "hug,hug", 4);
    const grid = buildGrid(table);
    expect(grid.cellAt(1, 1)).toBe(cellAtIndex(table, 3));
  });

  it("returns nothing outside the grid", () => {
    const grid = buildGrid(makeTable("hug,hug", "hug,hug", 4));
    expect(grid.cellAt(-1, 0)).toBeUndefined();
    expect(grid.cellAt(0, -1)).toBeUndefined();
    expect(grid.cellAt(2, 0)).toBeUndefined();
    expect(grid.cellAt(0, 2)).toBeUndefined();
  });
});

describe("buildGrid coverAt", () => {
  it("reports a plain cell as covering only its own slot", () => {
    const table = makeTable("hug,hug", "hug,hug", 4);
    const grid = buildGrid(table);
    const cover = grid.coverAt(0, 0)!;
    expect(cover.anchor).toBe(cellAtIndex(table, 0));
    expect(cover).toMatchObject({ row: 0, column: 0, spanX: 1, spanY: 1 });
  });

  it("reports the anchor of a horizontal span for every slot it covers", () => {
    // Row 0 is one cell spanning both columns, with a skip beside it.
    const table = makeTable("hug,hug", "hug,hug", 4);
    const anchor = cellAtIndex(table, 0);
    anchor.setAttribute("data-span-x", "2");
    cellAtIndex(table, 1).classList.add("bloom-skip");

    const grid = buildGrid(table);
    expect(grid.coverAt(0, 0)!.anchor).toBe(anchor);
    expect(grid.coverAt(0, 1)!.anchor).toBe(anchor);
    expect(grid.coverAt(0, 1)!.column).toBe(0);
    expect(grid.coverAt(1, 0)!.anchor).toBe(cellAtIndex(table, 2));
  });

  it("reports the anchor of a vertical span for every slot it covers", () => {
    const table = makeTable("hug,hug", "hug,hug", 4);
    const anchor = cellAtIndex(table, 0);
    anchor.setAttribute("data-span-y", "2");
    cellAtIndex(table, 2).classList.add("bloom-skip");

    const grid = buildGrid(table);
    expect(grid.coverAt(1, 0)!.anchor).toBe(anchor);
    expect(grid.coverAt(1, 0)!.spanY).toBe(2);
  });

  it("leaves a slot uncovered when only a skip cell sits there", () => {
    const table = makeTable("hug,hug", "hug", 2);
    cellAtIndex(table, 1).classList.add("bloom-skip");
    const grid = buildGrid(table);
    expect(grid.coverAt(0, 1)).toBeNull();
  });

  it("clips a span that reaches past the table instead of failing", () => {
    const table = makeTable("hug,hug", "hug", 2);
    cellAtIndex(table, 0).setAttribute("data-span-x", "5");
    const grid = buildGrid(table);
    expect(grid.coverAt(0, 1)!.anchor).toBe(cellAtIndex(table, 0));
    expect(grid.coverAt(0, 2)).toBeNull();
  });

  it("gives the first cell in document order a contested slot", () => {
    // Broken data: two non-skip cells both claim (0,1).
    const table = makeTable("hug,hug", "hug", 2);
    cellAtIndex(table, 0).setAttribute("data-span-x", "2");
    const grid = buildGrid(table);
    expect(grid.coverAt(0, 1)!.anchor).toBe(cellAtIndex(table, 0));
  });

  it("returns nothing outside the grid", () => {
    const grid = buildGrid(makeTable("hug,hug", "hug", 2));
    expect(grid.coverAt(-1, 0)).toBeNull();
    expect(grid.coverAt(0, 5)).toBeNull();
  });
});

describe("buildGrid and nested tables", () => {
  it("builds the outer table from its own cells only", () => {
    const outer = makeTable("hug,hug", "hug,hug", 4);
    const inner = makeTable("hug,hug,hug", "hug", 3);
    cellAtIndex(outer, 0).appendChild(inner);

    const outerGrid = buildGrid(outer);
    expect(outerGrid.rows).toBe(2);
    expect(outerGrid.cols).toBe(2);
    expect(outerGrid.cells.length).toBe(4);
    expect(outerGrid.posOf.has(cellAtIndex(inner, 0))).toBe(false);
  });

  it("builds the nested table against its own dimensions", () => {
    const outer = makeTable("hug,hug", "hug,hug", 4);
    const inner = makeTable("hug,hug,hug", "hug", 3);
    cellAtIndex(outer, 0).appendChild(inner);

    const innerGrid = buildGrid(inner);
    expect(innerGrid.rows).toBe(1);
    expect(innerGrid.cols).toBe(3);
    expect(innerGrid.cellAt(0, 2)).toBe(cellAtIndex(inner, 2));
  });
});
