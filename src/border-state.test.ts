import { describe, it, expect } from "vite-plus/test";
import {
  getCellOwnPerimeter,
  getCellPerimeterColors,
  getCellPerimeterValueMap,
  getTableOuterBorderValueMap,
} from "./border-state";
import {
  applyCellPerimeter,
  applyOuterBorders,
  applyUniformInner,
  setDefaultBorder,
} from "./edge-utils";

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

  it("a single-row table reports its own default for innerH, not a phantom 1px line", () => {
    const g = makeTable(2, 1); // one row: there is no interior H boundary
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 0, style: "none", color: "#000" }),
    );

    const map = getTableOuterBorderValueMap(g);
    expect(map.innerH.weight).toBe(0);
    expect(map.innerH.style).toBe("none");
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

describe("border round-trip: resolved values written back keep inheriting edges unset", () => {
  // The Borders panel path: read the resolved table map, write the whole map
  // straight back (outer sides + uniform inner + default). Edges nobody ever
  // set were reporting the table default, and stamping that default back as
  // explicit specs would freeze them — later default edits would stop
  // reaching them.
  it("an unchanged write-back leaves every never-set entry unset", () => {
    const g = makeTable(2, 2);
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 1, style: "solid", color: "#000" }),
    );

    const map = getTableOuterBorderValueMap(g);
    const color = "#000000"; // same color, different hex spelling
    applyOuterBorders(g, {
      top: { weight: map.top.weight, style: map.top.style, color },
      right: { weight: map.right.weight, style: map.right.style, color },
      bottom: { weight: map.bottom.weight, style: map.bottom.style, color },
      left: { weight: map.left.weight, style: map.left.style, color },
    });
    applyUniformInner(g, "innerH", { weight: map.innerH.weight, style: map.innerH.style, color });
    applyUniformInner(g, "innerV", { weight: map.innerV.weight, style: map.innerV.style, color });
    setDefaultBorder(g, { weight: map.innerH.weight, style: map.innerH.style, color });

    // No explicit specs were stamped: every entry is still never-set.
    const lines = [
      ...(JSON.parse(g.getAttribute("data-edges-h")!) as unknown[][]),
      ...(JSON.parse(g.getAttribute("data-edges-v")!) as unknown[][]),
    ];
    for (const line of lines) {
      for (const e of line) {
        expect(e == null || Object.keys(e as object).length === 0).toBe(true);
      }
    }

    // So a later table-default edit still reaches every edge.
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 4, style: "dashed", color: "red" }),
    );
    const after = getTableOuterBorderValueMap(g);
    expect(after.top.weight).toBe(4);
    expect(after.top.style).toBe("dashed");
    expect(after.left.weight).toBe(4);
    expect(after.innerH.weight).toBe(4);
    expect(after.innerH.style).toBe("dashed");
    expect(after.innerV.weight).toBe(4);
  });

  it("a changed write-back still stamps explicit values", () => {
    const g = makeTable(2, 2);
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 1, style: "solid", color: "#000" }),
    );

    applyUniformInner(g, "innerH", { weight: 2, style: "solid", color: "#000" });
    // The interior entries now carry explicit specs...
    const h = JSON.parse(g.getAttribute("data-edges-h")!) as Array<Array<{ weight?: number }>>;
    expect(h[1][0]?.weight).toBe(2);
    // ...so a later default edit does not move them.
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 4, style: "dashed", color: "red" }),
    );
    expect(getTableOuterBorderValueMap(g).innerH.weight).toBe(2);
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
describe("border-state: cell value map borrows a neighbor's stroke on a shared edge", () => {
  const noneDefault = JSON.stringify({ weight: 0, style: "none", color: "#000" });

  it("zero gap: the right cell reports the line its left neighbor painted", () => {
    const g = makeTable(2, 1);
    g.setAttribute("data-border-default", noneDefault);
    const cells = Array.from(g.children) as HTMLElement[];
    applyCellPerimeter(g, cells[0], { right: { weight: 2, style: "solid", color: "red" } });

    const map = getCellPerimeterValueMap(cells[1]);
    expect(map.left.weight).toBe(2);
    expect(map.left.style).toBe("solid");
    expect(getCellPerimeterColors(cells[1]).left).toBe("red");
  });

  it("an explicit 'none' on the cell's own side suppresses the borrow", () => {
    const g = makeTable(2, 1);
    g.setAttribute("data-border-default", noneDefault);
    const cells = Array.from(g.children) as HTMLElement[];
    applyCellPerimeter(g, cells[0], { right: { weight: 2, style: "solid", color: "red" } });
    applyCellPerimeter(g, cells[1], { left: { weight: 0, style: "none" } });

    const map = getCellPerimeterValueMap(cells[1]);
    expect(map.left.weight).toBe(0);
    expect(map.left.style).toBe("none");
    // An invisible edge reports no color, even though the stored explicit-none
    // spec carries the writer's fallback color: that color was never a user
    // choice, so a caller turning the edge back on must pick its own fallback.
    expect(getCellPerimeterColors(cells[1]).left).toBe(null);
  });

  it("a cell not inside any table gets the all-none fallback map", () => {
    const stray = document.createElement("div");
    stray.className = "bloom-cell";
    document.body.appendChild(stray);

    const map = getCellPerimeterValueMap(stray);
    for (const key of ["top", "right", "bottom", "left", "innerH", "innerV"] as const) {
      expect(map[key].weight).toBe(0);
      expect(map[key].style).toBe("none");
    }
    const colors = getCellPerimeterColors(stray);
    expect(colors).toEqual({ top: null, right: null, bottom: null, left: null });
  });
});

describe("border-state: getCellOwnPerimeter never borrows", () => {
  it("a borderless cell next to a fully boxed neighbor snapshots as borderless", () => {
    const g = makeTable(2, 1);
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 0, style: "none", color: "#000" }),
    );
    const cells = Array.from(g.children) as HTMLElement[];
    // Box the LEFT cell completely; leave the right cell untouched.
    applyCellPerimeter(g, cells[0], {
      top: { weight: 2, style: "solid", color: "red" },
      right: { weight: 2, style: "solid", color: "red" },
      bottom: { weight: 2, style: "solid", color: "red" },
      left: { weight: 2, style: "solid", color: "red" },
    });

    // The borrowing map sees the neighbor's line on the shared edge...
    expect(getCellPerimeterValueMap(cells[1]).left.weight).toBe(2);
    // ...but the copy-properties snapshot must not smuggle it along.
    const own = getCellOwnPerimeter(cells[1]);
    expect(own.left.weight).toBe(0);
    expect(own.left.style).toBe("none");
    expect(own.top.weight).toBe(0);
    expect(own.right.weight).toBe(0);
    expect(own.bottom.weight).toBe(0);
  });
});

describe("border-state: weight snapping buckets", () => {
  // Every read passes through snapWeight: <1.5 -> 1, <3 -> 2, else 4.
  it.each([
    [1.4, 1],
    [1.5, 2],
    [2.9, 2],
    [3, 4],
    [7, 4],
  ])("a painted weight of %s reports as %s", (painted, snapped) => {
    const g = makeTable(2, 1);
    const cells = Array.from(g.children) as HTMLElement[];
    applyCellPerimeter(g, cells[0], {
      left: { weight: painted as number, style: "solid", color: "red" },
    });
    expect(getCellPerimeterValueMap(cells[0]).left.weight).toBe(snapped);
  });
});
