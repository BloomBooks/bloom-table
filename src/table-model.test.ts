import { describe, it, expect } from "vite-plus/test";
import {
  getColumnWidths,
  setColumnWidths,
  getRowHeights,
  setRowHeights,
  getSpan,
  setSpan,
  getTableCorners,
  setTableCorners,
  getCellCorners,
  setCellCorners,
  getEdgesV,
  setEdgesV,
  getEdgesH,
  setEdgesH,
  getEdgeDefault,
  setEdgeDefault,
  type BorderSpec,
} from "./table-model";

function makeTable(): HTMLElement {
  const table = document.createElement("div");
  table.className = "table";
  return table as HTMLElement;
}

function makeCell(): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "cell";
  return cell as HTMLElement;
}

describe("table-model", () => {
  it("reads/writes column widths and row heights", () => {
    const g = makeTable();
    setColumnWidths(g, ["hug", "100px", "fill"]);
    expect(getColumnWidths(g)).toEqual(["hug", "100px", "fill"]);

    setRowHeights(g, ["20px", "hug"]);
    expect(getRowHeights(g)).toEqual(["20px", "hug"]);
  });

  it("reads/writes span via data-span-x/y", () => {
    const c = makeCell();
    expect(getSpan(c)).toEqual({ x: 1, y: 1 });
    setSpan(c, { x: 2, y: 3 });
    expect(getSpan(c)).toEqual({ x: 2, y: 3 });
  });

  it("reads/writes edgesH, edgesV, and edge default", () => {
    const g = makeTable();
    // Vertical edges: 1 row x 3 vertical boundaries (including perimeters)
    setEdgesV(g, [
      [null, { west: { weight: 2, style: "solid", color: "#000" }, east: null }, null],
    ]);
    expect(getEdgesV(g)).toEqual([
      [null, { west: { weight: 2, style: "solid", color: "#000" }, east: null }, null],
    ]);

    // Horizontal edges: 2 boundaries x 2 columns (including perimeters)
    setEdgesH(g, [
      [null, null],
      [
        { north: null, south: { weight: 1, style: "dashed", color: "red" } },
        { north: null, south: null },
      ],
    ]);
    expect(getEdgesH(g)).toEqual([
      [null, null],
      [
        { north: null, south: { weight: 1, style: "dashed", color: "red" } },
        { north: null, south: null },
      ],
    ]);

    // Edge default
    const def: BorderSpec = { weight: 1, style: "solid", color: "#888" };
    setEdgeDefault(g, def);
    expect(getEdgeDefault(g)).toEqual(def);
  });

  it("reads/writes corners JSON", () => {
    const g = makeTable();
    setTableCorners(g, { radius: 8 });
    expect(getTableCorners(g)).toEqual({ radius: 8 });

    const c = makeCell();
    setCellCorners(c, { radius: 0 });
    expect(getCellCorners(c)).toEqual({ radius: 0 });
  });

  it("removes attributes when setting null", () => {
    const g = makeTable();
    setTableCorners(g, { radius: 4 });
    setTableCorners(g, null);
    expect(getTableCorners(g)).toBeNull();

    // No outer anymore; only test edge default removal

    setEdgeDefault(g, { weight: 1, style: "solid", color: "blue" });
    setEdgeDefault(g, null);
    expect(getEdgeDefault(g)).toBeNull();
  });
});