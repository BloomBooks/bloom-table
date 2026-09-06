import { describe, it, expect, afterEach } from "vite-plus/test";
import {
  cellMenuItemIds,
  setCellMenuItemFilter,
  cellMenuOffersItem,
  setCellMenuOpenHandler,
  cellMenuOpenedByHost,
} from "./cell-menu-host";

const makeCell = (): HTMLElement => {
  const cell = document.createElement("div");
  cell.className = "bloom-cell";
  return cell;
};

const makeTable = (): HTMLElement => {
  const table = document.createElement("div");
  table.className = "bloom-table";
  return table;
};

describe("the ids a menu asks about", () => {
  it("names every row a host can refuse", () => {
    expect([...cellMenuItemIds]).toEqual([
      "contentType",
      "alignment",
      "padding",
      "fill",
      "borderStyle",
      "borderWeight",
      "corners",
      "paintFormat",
      "copyProperties",
      "pasteProperties",
      "merge",
      "split",
    ]);
  });
});

describe("the cell menu item filter", () => {
  // The filter is module state shared by every test in the process.
  afterEach(() => setCellMenuItemFilter(undefined));

  it("offers every item when no host installed a filter", () => {
    for (const id of cellMenuItemIds) {
      expect(cellMenuOffersItem(id, makeCell(), makeTable())).toBe(true);
    }
  });

  it("reports the host's answer for each item", () => {
    setCellMenuItemFilter((itemId) => itemId !== "merge");

    expect(cellMenuOffersItem("merge", makeCell(), makeTable())).toBe(false);
    expect(cellMenuOffersItem("split", makeCell(), makeTable())).toBe(true);
  });

  it("asks about one content type by its own id", () => {
    setCellMenuItemFilter((itemId) => itemId !== "contentType:video");

    expect(cellMenuOffersItem("contentType", null, null)).toBe(true);
    expect(cellMenuOffersItem("contentType:image", null, null)).toBe(true);
    expect(cellMenuOffersItem("contentType:video", null, null)).toBe(false);
  });

  it("gives the filter the cell and its table, so an answer can depend on them", () => {
    const cell = makeCell();
    const table = makeTable();
    const calls: Array<[string, HTMLElement | null, HTMLElement | null]> = [];
    setCellMenuItemFilter((itemId, c, t) => {
      calls.push([itemId, c, t]);
      return true;
    });

    cellMenuOffersItem("padding", cell, table);
    expect(calls).toEqual([["padding", cell, table]]);
  });

  it("accepts a null cell and table, which is how a menu with no cell asks", () => {
    setCellMenuItemFilter((_id, cell) => cell !== null);
    expect(cellMenuOffersItem("padding", null, null)).toBe(false);
  });

  it("offers everything again once the filter is removed", () => {
    setCellMenuItemFilter(() => false);
    expect(cellMenuOffersItem("merge", null, null)).toBe(false);

    setCellMenuItemFilter(undefined);
    expect(cellMenuOffersItem("merge", null, null)).toBe(true);
  });
});

describe("the cell menu open handler", () => {
  // The handler is module state shared by every test in the process.
  afterEach(() => setCellMenuOpenHandler(undefined));

  it("says the library opens the menu when no host installed a handler", () => {
    expect(cellMenuOpenedByHost(makeCell(), makeTable(), { x: 1, y: 2 })).toBe(false);
  });

  it("says the host opened the menu when its handler answers true", () => {
    setCellMenuOpenHandler(() => true);
    expect(cellMenuOpenedByHost(makeCell(), makeTable(), { x: 1, y: 2 })).toBe(true);
  });

  it("leaves the menu to the library when the handler answers false", () => {
    setCellMenuOpenHandler(() => false);
    expect(cellMenuOpenedByHost(makeCell(), makeTable(), { x: 1, y: 2 })).toBe(false);
  });

  it("gives the handler the cell, its table and the point that was clicked", () => {
    const cell = makeCell();
    const table = makeTable();
    let seen: unknown[] = [];
    setCellMenuOpenHandler((c, t, position) => {
      seen = [c, t, position];
      return true;
    });

    cellMenuOpenedByHost(cell, table, { x: 40, y: 90 });
    expect(seen).toEqual([cell, table, { x: 40, y: 90 }]);
  });

  it("returns to the library's own menu once the handler is removed", () => {
    setCellMenuOpenHandler(() => true);
    setCellMenuOpenHandler(undefined);
    expect(cellMenuOpenedByHost(makeCell(), makeTable(), { x: 0, y: 0 })).toBe(false);
  });
});
