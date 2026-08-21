import { describe, it, expect } from "vite-plus/test";
import { normalizeEdgeChange } from "./normalize";
import { toggleSelectedEdge } from "./selectionToggle";
import { computeInitialSelection } from "./selectionInit";
import type { BorderValueMap, EdgeKey, SelectedEdges } from "./types";

const edge = (weight: number, style: string, radius = 0) =>
  ({ weight, style, radius }) as BorderValueMap["top"];

const mapOf = (o: Partial<Record<EdgeKey, BorderValueMap["top"]>>): BorderValueMap =>
  ({
    top: edge(0, "none"),
    right: edge(0, "none"),
    bottom: edge(0, "none"),
    left: edge(0, "none"),
    innerH: edge(0, "none"),
    innerV: edge(0, "none"),
    ...o,
  }) as BorderValueMap;

describe("normalizeEdgeChange", () => {
  it("makes an invisible edge 1px when a real style is picked", () => {
    // The Borders panel used to store {weight 0, style dashed}: nothing was
    // drawn, and the Style menu it had just been used in became disabled.
    expect(normalizeEdgeChange({ weight: 0, style: "none" }, { style: "dashed" })).toEqual({
      weight: 1,
      style: "dashed",
    });
  });

  it("zeroes the weight when the style is set to none", () => {
    expect(normalizeEdgeChange({ weight: 4, style: "solid" }, { style: "none" })).toEqual({
      weight: 0,
      style: "none",
    });
  });

  it("turns the style off when the weight is set to 0", () => {
    expect(normalizeEdgeChange({ weight: 2, style: "dotted" }, { weight: 0 })).toEqual({
      weight: 0,
      style: "none",
    });
  });

  it("makes a style-less edge solid when a real weight is picked", () => {
    expect(normalizeEdgeChange({ weight: 0, style: "none" }, { weight: 2 })).toEqual({
      weight: 2,
      style: "solid",
    });
  });

  it("leaves an already-consistent edge alone", () => {
    expect(normalizeEdgeChange({ weight: 2, style: "solid" }, { style: "dashed" })).toEqual({
      weight: 2,
      style: "dashed",
    });
    expect(normalizeEdgeChange({ weight: 1, style: "dashed" }, { weight: 4 })).toEqual({
      weight: 4,
      style: "dashed",
    });
  });
});

describe("toggleSelectedEdge", () => {
  const sel = (...e: EdgeKey[]): SelectedEdges => new Set(e);

  it("treats the inner pair as a unit when only one axis is selected", () => {
    // Previously this swapped innerH for innerV, so a click meant to deselect
    // the inner borders quietly moved the edit to the other axis.
    const next = toggleSelectedEdge(sel("top", "bottom", "innerH"), "inner");
    expect(Array.from(next).sort()).toEqual(["bottom", "top"]);
  });

  it("clears both inner axes when both are selected", () => {
    expect(Array.from(toggleSelectedEdge(sel("innerH", "innerV"), "inner"))).toEqual([]);
  });

  it("selects both inner axes when neither is selected", () => {
    const next = toggleSelectedEdge(sel("top"), "inner");
    expect(Array.from(next).sort()).toEqual(["innerH", "innerV", "top"]);
  });

  it("still toggles a single outer edge", () => {
    expect(Array.from(toggleSelectedEdge(sel("top"), "top"))).toEqual([]);
    expect(Array.from(toggleSelectedEdge(sel(), "left"))).toEqual(["left"]);
  });
});

describe("computeInitialSelection", () => {
  it("can select innerH without innerV (the split state the inner plus must handle)", () => {
    const map = mapOf({
      top: edge(1, "solid"),
      bottom: edge(1, "solid"),
      innerH: edge(1, "solid"),
      left: edge(2, "solid"),
      right: edge(2, "solid"),
      innerV: edge(4, "solid"),
    });
    const selected = computeInitialSelection(map, true);
    expect(Array.from(selected).sort()).toEqual(["bottom", "innerH", "top"]);
    expect(selected.has("innerV")).toBe(false);
  });
});
