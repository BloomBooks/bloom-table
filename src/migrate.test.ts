import { describe, it, expect } from "vite-plus/test";
import { migrateTable } from "./migrate";

function makeTable(): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", "hug,hug");
  table.setAttribute("data-row-heights", "hug");
  for (let i = 0; i < 2; i++) {
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    table.appendChild(cell);
  }
  return table;
}

const cellAt = (table: HTMLElement, i: number): HTMLElement => table.children[i] as HTMLElement;

describe("migrateTable", () => {
  it("makes a cell holding a nested table selectable", () => {
    const table = makeTable();
    const inner = makeTable();
    cellAt(table, 0).appendChild(inner);

    migrateTable(table);

    expect(cellAt(table, 0).getAttribute("tabindex")).toBe("-1");
  });

  it("leaves a cell of ordinary content alone", () => {
    const table = makeTable();
    const text = document.createElement("div");
    text.setAttribute("contenteditable", "true");
    cellAt(table, 1).appendChild(text);

    migrateTable(table);

    expect(cellAt(table, 1).hasAttribute("tabindex")).toBe(false);
  });

  it("only treats a nested table as nested when it is the cell's first child", () => {
    const table = makeTable();
    const caption = document.createElement("div");
    cellAt(table, 0).appendChild(caption);
    cellAt(table, 0).appendChild(makeTable());

    migrateTable(table);

    expect(cellAt(table, 0).hasAttribute("tabindex")).toBe(false);
  });

  it("reaches a cell of a nested table, not only the outer table's own cells", () => {
    const outer = makeTable();
    const middle = makeTable();
    const inner = makeTable();
    cellAt(outer, 0).appendChild(middle);
    cellAt(middle, 0).appendChild(inner);

    migrateTable(outer);

    expect(cellAt(outer, 0).getAttribute("tabindex")).toBe("-1");
    expect(cellAt(middle, 0).getAttribute("tabindex")).toBe("-1");
  });

  it("can run twice without changing the result", () => {
    const table = makeTable();
    cellAt(table, 0).appendChild(makeTable());

    migrateTable(table);
    const afterFirst = table.outerHTML;
    migrateTable(table);

    expect(table.outerHTML).toBe(afterFirst);
  });

  it("refuses a missing table", () => {
    expect(() => migrateTable(null as unknown as HTMLElement)).toThrow(/Table element is required/);
  });
});
