import { describe, it, expect } from "vite-plus/test";
import {
  getCellOwnPerimeter,
  getCellPerimeterColors,
  getCellPerimeterValueMap,
  getTableOuterBorderValueMap,
} from "./border-state";
import { applyCellPerimeter } from "./edge-utils";

function makeTable(cols = 2, rows = 2): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", Array(cols).fill("hug").join(","));
  table.setAttribute("data-row-heights", Array(rows).fill("hug").join(","));
  // Create cells (DOM order by rows x cols)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "bloom-cell";
      table.appendChild(cell);
    }
  }
  document.body.appendChild(table);
  return table;
}

describe("border-state:getTableOuterBorderValueMap", () => {
  it("derives 1px solid from CSS default vars when no edges are specified", () => {
    const g = makeTable(2, 2);
    // Provide defaults via CSS custom properties inline (jsdom-friendly)
    g.style.setProperty("--edge-default-weight", "1");
    g.style.setProperty("--edge-default-style", "solid");
    g.style.setProperty("--edge-default-color", "#000");

    const map = getTableOuterBorderValueMap(g);
    expect(map.top.weight).toBe(1);
    expect(map.top.style).toBe("solid");
    expect(map.right.weight).toBe(1);
    expect(map.right.style).toBe("solid");
    expect(map.bottom.weight).toBe(1);
    expect(map.bottom.style).toBe("solid");
    expect(map.left.weight).toBe(1);
    expect(map.left.style).toBe("solid");
  });

  it("prefers data-border-default over CSS vars for unspecified perimeters", () => {
    const g = makeTable(2, 2);
    // Global-ish vars that would be ignored when data-border-default is present
    g.style.setProperty("--edge-default-weight", "1");
    g.style.setProperty("--edge-default-style", "solid");
    g.style.setProperty("--edge-default-color", "#000");
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 2, style: "dashed", color: "red" }),
    );

    const map = getTableOuterBorderValueMap(g);
    expect(map.top.weight).toBe(2);
    expect(map.top.style).toBe("dashed");
    expect(map.left.weight).toBe(2);
    expect(map.left.style).toBe("dashed");
  });

  it("still reports the inner lines a cell's neighbor paints after that cell declines its sides", () => {
    // Turning off the top-left cell's borders on a zero-gap table leaves an
    // explicit 'none' on that cell's bottom/right while the neighbors keep
    // painting the shared lines. Reading one cell's side reported innerH/innerV
    // as 'none', and the table map round-trips into applyUniformInner, so an
    // outer-only edit then erased every interior line.
    const g = makeTable(2, 2);
    g.setAttribute("data-border-default", JSON.stringify({ weight: 1, style: "solid", color: "#000" }));
    const cells = Array.from(g.children) as HTMLElement[];
    applyCellPerimeter(g, cells[0], {
      top: { weight: 0, style: "none" },
      right: { weight: 0, style: "none" },
      bottom: { weight: 0, style: "none" },
      left: { weight: 0, style: "none" },
    });

    const map = getTableOuterBorderValueMap(g);
    expect(map.innerH.weight).toBe(1);
    expect(map.innerH.style).toBe("solid");
    expect(map.innerV.weight).toBe(1);
    expect(map.innerV.style).toBe("solid");
  });
});

describe("border-state: merged cells read the boundaries the writer wrote", () => {
  it("reads a horizontally merged cell's right border from past its span", () => {
    const g = makeTable(3, 1);
    const cells = Array.from(g.children) as HTMLElement[];
    cells[0].setAttribute("data-span-x", "2");
    cells[1].classList.add("bloom-skip");

    applyCellPerimeter(g, cells[0], { right: { weight: 2, style: "solid", color: "red" } });

    const map = getCellPerimeterValueMap(cells[0]);
    expect(map.right.weight).toBe(2);
    expect(map.right.style).toBe("solid");
    expect(getCellPerimeterColors(cells[0]).right).toBe("red");
    // Copy-properties reads the same boundary.
    expect(getCellOwnPerimeter(cells[0]).right.weight).toBe(2);
    expect(getCellOwnPerimeter(cells[0]).right.color).toBe("red");
  });

  it("reads a vertically merged cell's bottom border from past its span", () => {
    const g = makeTable(1, 3);
    const cells = Array.from(g.children) as HTMLElement[];
    cells[0].setAttribute("data-span-y", "2");
    cells[1].classList.add("bloom-skip");

    applyCellPerimeter(g, cells[0], { bottom: { weight: 4, style: "dashed", color: "blue" } });

    const map = getCellPerimeterValueMap(cells[0]);
    expect(map.bottom.weight).toBe(4);
    expect(map.bottom.style).toBe("dashed");
    expect(getCellPerimeterColors(cells[0]).bottom).toBe("blue");
    expect(getCellOwnPerimeter(cells[0]).bottom.weight).toBe(4);
  });
});