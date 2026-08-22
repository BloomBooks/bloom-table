import { describe, it, expect, beforeEach } from "vite-plus/test";
import { buildBorderMapFromTable, applyBorderMapToTable } from "./TableSection";
import { defaultTableApi } from "./TableApiContext";
import { applyCellPerimeter } from "../edge-utils";
import { render } from "../table-renderer";

function makeTable(cols = 2, rows = 2): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", Array(cols).fill("hug").join(","));
  table.setAttribute("data-row-heights", Array(rows).fill("hug").join(","));
  for (let i = 0; i < rows * cols; i++) {
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    table.appendChild(cell);
  }
  document.body.appendChild(table);
  return table;
}

describe("buildBorderMapFromTable (the read side of the Borders panel)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("passes the resolved outer and inner values through from the border state", () => {
    const g = makeTable(2, 2);
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 2, style: "dashed", color: "red" }),
    );

    const map = buildBorderMapFromTable(defaultTableApi, g);
    expect(map.top.weight).toBe(2);
    expect(map.top.style).toBe("dashed");
    expect(map.innerH.weight).toBe(2);
    expect(map.innerH.style).toBe("dashed");
    expect(map.innerV.weight).toBe(2);
  });

  it("round-trips a table with mixed edges: an asymmetric cell edit shows on inner, not outer", () => {
    const g = makeTable(2, 2);
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 0, style: "none", color: "#000" }),
    );
    const cells = Array.from(g.children) as HTMLElement[];
    // Paint only the interior vertical boundary via a per-cell edit.
    applyCellPerimeter(g, cells[0], { right: { weight: 4, style: "solid", color: "blue" } });

    const map = buildBorderMapFromTable(defaultTableApi, g);
    expect(map.innerV.weight).toBe(4);
    expect(map.innerV.style).toBe("solid");
    expect(map.top.weight).toBe(0);
    expect(map.top.style).toBe("none");
    expect(map.left.weight).toBe(0);
  });

  it("an inner-only weight change leaves an untouched inheriting perimeter as it was", () => {
    const g = makeTable(2, 2);
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 1, style: "solid", color: "#000" }),
    );
    render(g);
    const cells = Array.from(g.children) as HTMLElement[];

    // The panel round-trips the whole map, so the perimeter values it writes
    // back are the ones it read: 1px solid, still never-set in the edge arrays.
    const map = buildBorderMapFromTable(defaultTableApi, g);
    map.innerH = { ...map.innerH, weight: 4 };
    map.innerV = { ...map.innerV, weight: 4 };
    applyBorderMapToTable(defaultTableApi, g, map);

    // The interior boundary takes the new weight...
    expect(cells[0].style.borderRightWidth).toBe("4px");
    // ...and the perimeter, which the user never touched, keeps its 1px. (It
    // inherits the default, so it only stays 1px if the writers stamped it.)
    expect(cells[0].style.borderTopWidth).toBe("1px");
    expect(cells[0].style.borderLeftWidth).toBe("1px");
    expect(cells[3].style.borderBottomWidth).toBe("1px");
  });

  it("snaps the corner radius to the radii the model accepts", () => {
    const g = makeTable(2, 2);
    g.style.borderTopLeftRadius = "4px";
    expect(buildBorderMapFromTable(defaultTableApi, g).top.radius).toBe(4);
    // Every outer edge carries the same radius reading.
    expect(buildBorderMapFromTable(defaultTableApi, g).left.radius).toBe(4);

    g.style.borderTopLeftRadius = "5px"; // not a value the model accepts -> 0
    expect(buildBorderMapFromTable(defaultTableApi, g).top.radius).toBe(0);

    g.style.borderTopLeftRadius = "8px";
    expect(buildBorderMapFromTable(defaultTableApi, g).bottom.radius).toBe(8);

    // 16 is on the Corners menu, so reading it back must not fall through to 0.
    g.style.borderTopLeftRadius = "16px";
    expect(buildBorderMapFromTable(defaultTableApi, g).top.radius).toBe(16);
  });
});
