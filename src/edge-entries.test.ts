import { describe, it, expect } from "vite-plus/test";
import { isBorderSpec, splitV, splitH, hasPositiveGap, entryAtV, entryAtH } from "./edge-entries";
import type { BorderSpec, HEdgeEntry, VEdgeEntry } from "./table-model";

const solid: BorderSpec = { weight: 1, style: "solid", color: "#000000" };
const spec = (weight: number): BorderSpec => ({ weight, style: "solid", color: "#000000" });

describe("isBorderSpec", () => {
  it("accepts an object carrying a weight, a style or a color", () => {
    expect(isBorderSpec({ weight: 2 })).toBe(true);
    expect(isBorderSpec({ style: "dashed" })).toBe(true);
    expect(isBorderSpec({ color: "#ff0000" })).toBe(true);
  });

  it("accepts a spec whose style or color is explicitly absent", () => {
    // A writer clears a property by setting it to null, and that entry is
    // still one spec for both sides, not a sided object.
    expect(isBorderSpec({ style: null })).toBe(true);
    expect(isBorderSpec({ color: undefined })).toBe(true);
  });

  it("rejects a sided object, null and a non-object", () => {
    expect(isBorderSpec({ west: solid, east: null })).toBe(false);
    expect(isBorderSpec(null)).toBe(false);
    expect(isBorderSpec(undefined)).toBe(false);
    expect(isBorderSpec("solid")).toBe(false);
    expect(isBorderSpec(1)).toBe(false);
  });
});

describe("splitV", () => {
  it("gives one spec to both the west and the east side", () => {
    expect(splitV(solid)).toEqual({ west: solid, east: solid });
  });

  it("keeps each side of a sided entry and turns a missing side into null", () => {
    expect(splitV({ west: solid } as VEdgeEntry)).toEqual({ west: solid, east: null });
    expect(splitV({ east: solid } as VEdgeEntry)).toEqual({ west: null, east: solid });
  });

  it("gives both sides null for a missing entry", () => {
    expect(splitV(undefined)).toEqual({ west: null, east: null });
    expect(splitV(null as unknown as VEdgeEntry)).toEqual({ west: null, east: null });
  });

  it("returns the sides raw, so a caller sees the same object the model holds", () => {
    const sides = splitV(solid);
    expect(sides.west).toBe(solid);
    expect(sides.east).toBe(solid);
  });
});

describe("splitH", () => {
  it("gives one spec to both the north and the south side", () => {
    expect(splitH(solid)).toEqual({ north: solid, south: solid });
  });

  it("keeps each side of a sided entry and turns a missing side into null", () => {
    expect(splitH({ north: solid } as HEdgeEntry)).toEqual({ north: solid, south: null });
    expect(splitH({ south: solid } as HEdgeEntry)).toEqual({ north: null, south: solid });
  });

  it("gives both sides null for a missing entry", () => {
    expect(splitH(undefined)).toEqual({ north: null, south: null });
  });
});

describe("hasPositiveGap", () => {
  it("reads the token at the asked-for boundary", () => {
    expect(hasPositiveGap(["0", "4px", "0"], 1)).toBe(true);
    expect(hasPositiveGap(["0", "4px", "0"], 2)).toBe(false);
  });

  it("applies a single token to every boundary", () => {
    expect(hasPositiveGap(["3px"], 0)).toBe(true);
    expect(hasPositiveGap(["3px"], 7)).toBe(true);
  });

  it("clamps an index past either end into the token list", () => {
    expect(hasPositiveGap(["0", "5px"], 9)).toBe(true);
    expect(hasPositiveGap(["5px", "0"], -3)).toBe(true);
  });

  it("counts an empty token and an empty list as no gap", () => {
    expect(hasPositiveGap(["  "], 0)).toBe(false);
    expect(hasPositiveGap([], 0)).toBe(false);
  });

  it("counts zero written any way as no gap", () => {
    expect(hasPositiveGap(["0"], 0)).toBe(false);
    expect(hasPositiveGap(["0px"], 0)).toBe(false);
    expect(hasPositiveGap(["0mm"], 0)).toBe(false);
  });

  it("counts a non-numeric token as a gap, since it names some length", () => {
    expect(hasPositiveGap(["thin"], 0)).toBe(true);
  });

  it("counts a negative length as no gap", () => {
    expect(hasPositiveGap(["-2px"], 0)).toBe(false);
  });
});

describe("entryAtV", () => {
  const a = spec(1);
  const b = spec(2);
  const c = spec(3);
  const d = spec(4);

  it("reads a full row by boundary index, perimeters included", () => {
    // 3 columns: boundaries 0..3, where 0 is the left perimeter.
    const edges = [[a, b, c, d]];
    expect(entryAtV(edges, 3, 0, 0)).toBe(a);
    expect(entryAtV(edges, 3, 0, 3)).toBe(d);
  });

  it("maps an interior-only row so boundary 1 is its first entry", () => {
    // 3 columns written concisely: only the 2 interior boundaries.
    const edges = [[a, b]];
    expect(entryAtV(edges, 3, 0, 1)).toBe(a);
    expect(entryAtV(edges, 3, 0, 2)).toBe(b);
  });

  it("gives nothing for a perimeter of an interior-only row", () => {
    const edges = [[a, b]];
    expect(entryAtV(edges, 3, 0, 0)).toBeUndefined();
    expect(entryAtV(edges, 3, 0, 3)).toBeUndefined();
  });

  it("answers a single-entry row for the one interior boundary of a 2-column table", () => {
    const edges = [[a]];
    expect(entryAtV(edges, 2, 0, 1)).toBe(a);
    expect(entryAtV(edges, 2, 0, 0)).toBeUndefined();
    expect(entryAtV(edges, 2, 0, 2)).toBeUndefined();
  });

  it("reads the row asked for, not the first one", () => {
    const edges = [[a, b], [c, d]];
    expect(entryAtV(edges, 3, 1, 1)).toBe(c);
  });

  it("gives nothing when there are no edges or the row is missing", () => {
    expect(entryAtV(null, 3, 0, 1)).toBeUndefined();
    expect(entryAtV([[a, b]], 3, 5, 1)).toBeUndefined();
  });

  it("gives nothing for a row length that matches none of the three shapes", () => {
    // 5 columns wants 6, 4 or 1 entries. Three is not a shape it can read.
    expect(entryAtV([[a, b, c]], 5, 0, 1)).toBeUndefined();
  });
});

describe("entryAtH", () => {
  const a = spec(1);
  const b = spec(2);
  const c = spec(3);

  it("reads a full array by boundary line, perimeters included", () => {
    // 2 rows: boundary lines 0..2, where 0 is the top perimeter.
    const edges = [[a], [b], [c]];
    expect(entryAtH(edges, 2, 0, 0)).toBe(a);
    expect(entryAtH(edges, 2, 2, 0)).toBe(c);
  });

  it("maps an interior-only array so line 1 is its first row", () => {
    // 3 rows written concisely: only the 2 interior lines.
    const edges = [[a], [b]];
    expect(entryAtH(edges, 3, 1, 0)).toBe(a);
    expect(entryAtH(edges, 3, 2, 0)).toBe(b);
    expect(entryAtH(edges, 3, 0, 0)).toBeUndefined();
  });

  it("answers a single-line array for the one interior line of a 2-row table", () => {
    const edges = [[a, b]];
    expect(entryAtH(edges, 2, 1, 1)).toBe(b);
    expect(entryAtH(edges, 2, 0, 0)).toBeUndefined();
  });

  it("reads the column asked for within a line", () => {
    const edges = [[a, b, c], [a, b, c], [a, b, c]];
    expect(entryAtH(edges, 2, 1, 2)).toBe(c);
  });

  it("gives nothing when there are no edges, or the column is past the line", () => {
    expect(entryAtH(null, 2, 0, 0)).toBeUndefined();
    expect(entryAtH([[a], [b], [c]], 2, 0, 9)).toBeUndefined();
  });
});
