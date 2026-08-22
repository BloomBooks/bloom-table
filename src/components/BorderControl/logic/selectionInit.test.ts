import { describe, it, expect } from "vite-plus/test";
import { BorderValueMap, EdgeValue } from "./types";
import { computeInitialSelection } from "./selectionInit";

const ev = (w: number, s: string, r: number): EdgeValue => ({
  weight: w as any,
  style: s as any,
  radius: r as any,
});

describe("computeInitialSelection", () => {
  it("picks largest equivalence class", () => {
    const map: BorderValueMap = {
      top: ev(1, "solid", 2),
      right: ev(1, "solid", 2),
      bottom: ev(2, "dashed", 4),
      left: ev(1, "solid", 2),
      innerH: ev(2, "dashed", 4),
      innerV: ev(2, "dashed", 4),
    } as any;
    const sel = computeInitialSelection(map, true);
    // should prefer the 3 outer edges with same tuple
    expect(Array.from(sel).sort()).toEqual(["left", "right", "top"].sort());
  });

  it("ignores inner when showInner=false", () => {
    const map: BorderValueMap = {
      top: ev(1, "solid", 2),
      right: ev(2, "dashed", 2),
      bottom: ev(2, "dashed", 2),
      left: ev(2, "dashed", 2),
      innerH: ev(2, "dashed", 2),
      innerV: ev(2, "dashed", 2),
    } as any;
    const sel = computeInitialSelection(map, false);
    expect(Array.from(sel).sort()).toEqual(["bottom", "left", "right"].sort());
  });
});

describe("computeInitialSelection tie-breaks", () => {
  it("rule 2: on a size tie, a group containing an outer edge beats an inner-only group", () => {
    const map: BorderValueMap = {
      top: ev(1, "solid", 0),
      right: ev(1, "solid", 0),
      bottom: ev(2, "dashed", 0),
      left: ev(4, "dotted", 0),
      innerH: ev(1, "double", 0),
      innerV: ev(1, "double", 0),
    } as any;
    // {top,right} and {innerH,innerV} both have size 2.
    const sel = computeInitialSelection(map, true);
    expect(Array.from(sel).sort()).toEqual(["right", "top"].sort());
  });

  it("rule 3: on a further tie, more contiguous outer edges win", () => {
    const map: BorderValueMap = {
      top: ev(1, "solid", 0),
      right: ev(1, "solid", 0),
      bottom: ev(2, "dashed", 0),
      left: ev(4, "dotted", 0),
      innerH: ev(2, "dashed", 0),
      innerV: ev(1, "double", 0),
    } as any;
    // {top,right}: two ADJACENT outer edges (contiguity 1).
    // {bottom,innerH}: same size, has an outer edge, but contiguity 0.
    const sel = computeInitialSelection(map, true);
    expect(Array.from(sel).sort()).toEqual(["right", "top"].sort());
  });

  it("rule 4: a full tie falls back to a deterministic alphabetical pick", () => {
    const map: BorderValueMap = {
      top: ev(1, "solid", 0),
      right: ev(4, "dotted", 0),
      bottom: ev(1, "solid", 0),
      left: ev(2, "dashed", 0),
      innerH: ev(2, "dashed", 0),
      innerV: ev(8 as any, "double", 0),
    } as any;
    // {top,bottom} vs {left,innerH}: size 2 each, both contain an outer edge,
    // and neither pair of outer edges is adjacent (contiguity 0 for both).
    // The final rule compares the joined edge names: "left,innerH" sorts
    // before "top,bottom".
    const sel = computeInitialSelection(map, true);
    expect(Array.from(sel).sort()).toEqual(["innerH", "left"].sort());
  });
});
