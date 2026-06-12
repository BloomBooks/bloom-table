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
