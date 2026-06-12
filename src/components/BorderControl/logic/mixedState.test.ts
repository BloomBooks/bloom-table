import { describe, it, expect } from "vite-plus/test";
import { BorderValueMap, EdgeValue } from "./types";
import {
  computeMixedRadius,
  computeMixedStyle,
  computeMixedWeight,
  interdependencyDisabled,
} from "./mixedState";

const ev = (w: number, s: string, r: number): EdgeValue => ({
  weight: w as any,
  style: s as any,
  radius: r as any,
});

function mapAll(v: EdgeValue): BorderValueMap {
  return {
    top: v,
    right: v,
    bottom: v,
    left: v,
    innerH: v,
    innerV: v,
  } as any;
}

describe("mixed state", () => {
  it("homogeneous -> concrete", () => {
    const map = mapAll(ev(2, "solid", 4));
    const sel = new Set(["top", "right"]) as any;
    expect(computeMixedWeight(map, sel)).toBe(2);
    expect(computeMixedStyle(map, sel)).toBe("solid");
    expect(computeMixedRadius(map, sel)).toBe(4);
  });

  it("heterogeneous -> mixed", () => {
    const map: BorderValueMap = {
      top: ev(1, "solid", 2),
      right: ev(2, "solid", 2),
      bottom: ev(1, "solid", 2),
      left: ev(2, "solid", 2),
      innerH: ev(1, "solid", 2),
      innerV: ev(2, "solid", 2),
    } as any;
    const sel = new Set(["top", "right"]) as any;
    expect(computeMixedWeight(map, sel)).toBe("mixed");
  });

  it("interdependency rules", () => {
    expect(interdependencyDisabled(0 as any, "solid")).toEqual({
      weightDisabled: false,
      styleDisabled: true,
    });
    expect(interdependencyDisabled(2 as any, "none" as any)).toEqual({
      weightDisabled: true,
      styleDisabled: false,
    });
    expect(interdependencyDisabled(0 as any, "none" as any)).toEqual({
      weightDisabled: false,
      styleDisabled: false,
    });
    expect(interdependencyDisabled("mixed" as any, "solid")).toEqual({
      weightDisabled: false,
      styleDisabled: false,
    });
  });
});
