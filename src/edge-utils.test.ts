import { describe, it, expect } from "vite-plus/test";
import {
  applyUniformOuter,
  applyUniformInner,
  applyOuterBorders,
  applyCellPerimeter,
  ensureEdgesArrays,
  setDefaultBorder,
} from "./edge-utils";
import { getEdgesH, getEdgesV, setEdgesH, setEdgesV } from "./table-model";
import { getTableOuterBorderValueMap } from "./border-state";
import type { BorderSpec } from "./table-model";

function makeTable(cols = 3, rows = 3): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", Array(cols).fill("hug").join(","));
  table.setAttribute("data-row-heights", Array(rows).fill("hug").join(","));
  table.setAttribute(
    "data-border-default",
    JSON.stringify({ weight: 1, style: "solid", color: "#000" }),
  );
  for (let i = 0; i < rows * cols; i++) {
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    table.appendChild(cell);
  }
  document.body.appendChild(table);
  return table;
}

// An entry nobody ever set: null/absent or an empty {} placeholder.
const isUnset = (e: unknown): boolean =>
  e == null || (typeof e === "object" && Object.keys(e as object).length === 0);

const asSpec = (e: unknown): BorderSpec => e as BorderSpec;

describe("edge-utils: applyUniformOuter", () => {
  it("writes all four perimeters and leaves interior edges untouched", () => {
    const g = makeTable(3, 3);
    applyUniformOuter(g, { weight: 2, style: "solid", color: "red" });

    const h = getEdgesH(g)!; // (rows+1) x cols = 4 x 3
    const v = getEdgesV(g)!; // rows x (cols+1) = 3 x 4
    expect(h.length).toBe(4);
    expect(v.length).toBe(3);

    // Top (h[0]) and bottom (h[3]) perimeters: every entry stamped.
    for (let c = 0; c < 3; c++) {
      expect(asSpec(h[0][c]).weight).toBe(2);
      expect(asSpec(h[3][c]).weight).toBe(2);
      expect(asSpec(h[0][c]).color).toBe("red");
    }
    // Interior H boundaries (rows 1 and 2): untouched.
    for (let r = 1; r <= 2; r++) {
      for (let c = 0; c < 3; c++) expect(isUnset(h[r][c])).toBe(true);
    }
    // Left (v[r][0]) and right (v[r][3]) perimeters stamped; interiors untouched.
    for (let r = 0; r < 3; r++) {
      expect(asSpec(v[r][0]).weight).toBe(2);
      expect(asSpec(v[r][3]).weight).toBe(2);
      expect(isUnset(v[r][1])).toBe(true);
      expect(isUnset(v[r][2])).toBe(true);
    }
  });

  it("a default-equal write leaves never-set perimeter entries unset", () => {
    const g = makeTable(2, 2);
    // Same value the table default already renders (different hex spelling).
    applyUniformOuter(g, { weight: 1, style: "solid", color: "#000000" });
    const h = getEdgesH(g)!;
    const v = getEdgesV(g)!;
    for (const row of [...h, ...v]) {
      for (const e of row) expect(isUnset(e)).toBe(true);
    }
  });
});

describe("edge-utils: applyOuterBorders", () => {
  it("a side left undefined is not touched", () => {
    const g = makeTable(2, 2);
    applyOuterBorders(g, { top: { weight: 2, style: "dashed", color: "blue" } });

    const h = getEdgesH(g)!;
    const v = getEdgesV(g)!;
    // Top stamped...
    expect(asSpec(h[0][0]).weight).toBe(2);
    expect(asSpec(h[0][1]).style).toBe("dashed");
    // ...bottom perimeter and both V perimeters untouched.
    expect(isUnset(h[2][0])).toBe(true);
    expect(isUnset(h[2][1])).toBe(true);
    for (let r = 0; r < 2; r++) {
      expect(isUnset(v[r][0])).toBe(true);
      expect(isUnset(v[r][2])).toBe(true);
    }
  });

  it("null clears a previously stamped side back to inheriting the default", () => {
    const g = makeTable(2, 2);
    applyOuterBorders(g, { top: { weight: 2, style: "dashed", color: "blue" } });
    expect(asSpec(getEdgesH(g)![0][0]).weight).toBe(2);

    applyOuterBorders(g, { top: null });
    const h = getEdgesH(g)!;
    expect(h[0][0]).toBe(null);
    expect(h[0][1]).toBe(null);
    // A cleared entry inherits: the resolved map reports the table default again.
    const map = getTableOuterBorderValueMap(g);
    expect(map.top.weight).toBe(1);
    expect(map.top.style).toBe("solid");
  });

  it("a nested table gets explicit perimeter entries even when the spec matches the default", () => {
    // Host table whose first cell holds the nested table under test.
    const host = makeTable(2, 2);
    const nested = makeTable(2, 2);
    (host.children[0] as HTMLElement).appendChild(nested);

    applyOuterBorders(nested, {
      top: { weight: 1, style: "solid", color: "#000000" },
      right: { weight: 1, style: "solid", color: "#000000" },
      bottom: { weight: 1, style: "solid", color: "#000000" },
      left: { weight: 1, style: "solid", color: "#000000" },
    });

    const h = getEdgesH(nested)!;
    const v = getEdgesV(nested)!;
    for (let c = 0; c < 2; c++) {
      expect(asSpec(h[0][c]).weight).toBe(1);
      expect(asSpec(h[2][c]).weight).toBe(1);
    }
    for (let r = 0; r < 2; r++) {
      expect(asSpec(v[r][0]).weight).toBe(1);
      expect(asSpec(v[r][2]).weight).toBe(1);
    }
  });

  it("a top-level table still leaves default-equal perimeter entries unset", () => {
    const g = makeTable(2, 2);
    applyOuterBorders(g, {
      top: { weight: 1, style: "solid", color: "#000000" },
      right: { weight: 1, style: "solid", color: "#000000" },
      bottom: { weight: 1, style: "solid", color: "#000000" },
      left: { weight: 1, style: "solid", color: "#000000" },
    });
    const h = getEdgesH(g)!;
    const v = getEdgesV(g)!;
    for (const row of [...h, ...v]) for (const e of row) expect(isUnset(e)).toBe(true);
  });

  it("style 'none' is a stamped force-off, distinct from clearing", () => {
    const g = makeTable(2, 2);
    applyOuterBorders(g, { top: { weight: 0, style: "none" } });
    const h = getEdgesH(g)!;
    expect(asSpec(h[0][0]).weight).toBe(0);
    expect(asSpec(h[0][0]).style).toBe("none");
    // Stamped 'none' does not follow later default edits.
    const map = getTableOuterBorderValueMap(g);
    expect(map.top.weight).toBe(0);
    expect(map.top.style).toBe("none");
  });
});

describe("edge-utils: applyUniformInner", () => {
  it("innerV writes only interior vertical boundaries", () => {
    const g = makeTable(3, 2);
    applyUniformInner(g, "innerV", { weight: 4, style: "dotted", color: "green" });
    const v = getEdgesV(g)!; // 2 x 4
    for (let r = 0; r < 2; r++) {
      expect(isUnset(v[r][0])).toBe(true); // left perimeter untouched
      expect(asSpec(v[r][1]).weight).toBe(4);
      expect(asSpec(v[r][2]).style).toBe("dotted");
      expect(isUnset(v[r][3])).toBe(true); // right perimeter untouched
    }
    // H edges untouched entirely.
    for (const row of getEdgesH(g)!) for (const e of row) expect(isUnset(e)).toBe(true);
  });

  it("innerH writes only interior horizontal boundaries", () => {
    const g = makeTable(2, 3);
    applyUniformInner(g, "innerH", { weight: 2, style: "solid", color: "green" });
    const h = getEdgesH(g)!; // 4 x 2
    for (let c = 0; c < 2; c++) {
      expect(isUnset(h[0][c])).toBe(true); // top perimeter untouched
      expect(asSpec(h[1][c]).weight).toBe(2);
      expect(asSpec(h[2][c]).weight).toBe(2);
      expect(isUnset(h[3][c])).toBe(true); // bottom perimeter untouched
    }
  });

  it("overwrites an entry somebody set, including a sided one", () => {
    const g = makeTable(2, 1);
    const v = getEdgesV(g) ?? [[]];
    // Materialize a sided interior entry the way per-cell edits do.
    ensureEdgesArrays(g);
    const v2 = getEdgesV(g)!;
    v2[0][1] = {
      west: { weight: 4, style: "solid", color: "red" },
      east: { weight: 0, style: "none", color: "red" },
    } as never;
    setEdgesV(g, v2);
    void v;

    applyUniformInner(g, "innerV", { weight: 2, style: "dashed", color: "blue" });
    const after = getEdgesV(g)!;
    expect(asSpec(after[0][1]).weight).toBe(2);
    expect(asSpec(after[0][1]).style).toBe("dashed");
  });
});

describe("edge-utils: ensureEdgesArrays", () => {
  it("pads undersized arrays with empty entries to R x (C+1) and (R+1) x C", () => {
    const g = makeTable(3, 2);
    setEdgesV(g, [[{ weight: 2, style: "solid", color: "red" }]] as never);
    setEdgesH(g, [] as never);

    ensureEdgesArrays(g);
    const v = getEdgesV(g)!;
    const h = getEdgesH(g)!;
    expect(v.length).toBe(2);
    for (const row of v) expect(row.length).toBe(4);
    expect(h.length).toBe(3);
    for (const row of h) expect(row.length).toBe(3);
    // Existing entry preserved in place; padding is empty.
    expect(asSpec(v[0][0]).weight).toBe(2);
    expect(isUnset(v[0][1])).toBe(true);
  });

  it("truncates oversized arrays after a structural shrink, keeping leading entries", () => {
    const g = makeTable(2, 2);
    // Arrays sized for a 3x3 table, each entry tagged with its position.
    const tag = (p: string) => ({ weight: 1, style: "solid", color: p });
    setEdgesV(
      g,
      Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 4 }, (_, c) => tag(`v${r},${c}`)),
      ) as never,
    );
    setEdgesH(
      g,
      Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => tag(`h${r},${c}`)),
      ) as never,
    );

    ensureEdgesArrays(g);
    const v = getEdgesV(g)!;
    const h = getEdgesH(g)!;
    // V: 2 rows x 3 entries; H: 3 rows x 2 entries.
    expect(v.length).toBe(2);
    for (const row of v) expect(row.length).toBe(3);
    expect(h.length).toBe(3);
    for (const row of h) expect(row.length).toBe(2);
    // slice keeps the leading entries: nothing shifted.
    expect(asSpec(v[0][0]).color).toBe("v0,0");
    expect(asSpec(v[1][2]).color).toBe("v1,2");
    expect(asSpec(h[2][1]).color).toBe("h2,1");
  });
});

describe("edge-utils: applyCellPerimeter picks the gap token for each boundary", () => {
  it("data-gap-x='0,8px': the zero-gap boundary gets a shared write, the gapped one a sided write", () => {
    const g = makeTable(3, 1);
    g.setAttribute("data-gap-x", "0,8px");
    const cells = Array.from(g.children) as HTMLElement[];
    const center = cells[1];

    applyCellPerimeter(g, center, {
      left: { weight: 2, style: "solid", color: "red" },
      right: { weight: 2, style: "solid", color: "blue" },
    });

    const v = getEdgesV(g)!;
    // Boundary 0 (between col 0 and 1) has gap token "0": one shared line, so
    // the visible write claims the whole edge as a plain spec.
    expect(asSpec(v[0][1]).weight).toBe(2);
    expect(asSpec(v[0][1]).color).toBe("red");
    // Boundary 1 has token "8px": the cells own independent lines, so only this
    // cell's (west) side is written and the neighbor's side is left alone.
    const sided = v[0][2] as { west?: BorderSpec | null; east?: BorderSpec | null };
    expect(sided.west?.weight).toBe(2);
    expect(sided.west?.color).toBe("blue");
    expect(sided.east ?? null).toBe(null);
  });
});

describe("edge-utils: setDefaultBorder", () => {
  it("round-trips through data-border-default and drives unset edges", () => {
    const g = makeTable(2, 2);
    setDefaultBorder(g, { weight: 2, style: "dashed", color: "purple" });
    const stored = JSON.parse(g.getAttribute("data-border-default")!);
    expect(stored).toEqual({ weight: 2, style: "dashed", color: "purple" });
    const map = getTableOuterBorderValueMap(g);
    expect(map.top.weight).toBe(2);
    expect(map.top.style).toBe("dashed");
    expect(map.innerH.weight).toBe(2);
  });

  it("weight 0 collapses to an explicit 'none' default", () => {
    const g = makeTable(2, 2);
    setDefaultBorder(g, { weight: 0, style: "solid", color: "purple" });
    const stored = JSON.parse(g.getAttribute("data-border-default")!);
    expect(stored.weight).toBe(0);
    expect(stored.style).toBe("none");
  });
});
