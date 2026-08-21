import { describe, it, expect } from "vite-plus/test";
import { nextSplitSpan } from "./spanCommands";
import { paddingSliderValue } from "./cellPadding";
import { elementKey } from "./elementKey";

describe("nextSplitSpan", () => {
  it("reduces the horizontal span first", () => {
    expect(nextSplitSpan(3, 1)).toEqual({ x: 2, y: 1 });
    expect(nextSplitSpan(2, 2)).toEqual({ x: 1, y: 2 });
  });

  it("reduces the vertical span once x is 1", () => {
    // The Split button used to be a silent no-op on a vertically merged cell.
    expect(nextSplitSpan(1, 2)).toEqual({ x: 1, y: 1 });
    expect(nextSplitSpan(1, 3)).toEqual({ x: 1, y: 2 });
  });

  it("reports nothing to split for a 1x1 cell", () => {
    expect(nextSplitSpan(1, 1)).toBeNull();
    expect(nextSplitSpan(0, 0)).toBeNull();
  });
});

describe("paddingSliderValue", () => {
  const makeCell = (): HTMLElement => {
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    document.body.appendChild(cell);
    return cell;
  };

  it("uses the data-pad override when there is one", () => {
    const cell = makeCell();
    expect(paddingSliderValue(cell, "3px")).toBe(3);
    expect(paddingSliderValue(cell, "6px 16px")).toBe(6);
  });

  it("falls back to the padding the cell actually renders with", () => {
    // Without this, a fresh cell (no data-pad, padded 8px 10px by the
    // stylesheet) showed 0, so the first nudge shrank the padding.
    const cell = makeCell();
    cell.style.padding = "8px 10px";
    expect(paddingSliderValue(cell, null)).toBe(8);
  });

  it("reports 0 when the cell really has no padding", () => {
    const cell = makeCell();
    cell.style.padding = "0px";
    expect(paddingSliderValue(cell, null)).toBe(0);
  });
});

describe("elementKey", () => {
  it("is stable per element and different across elements", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    expect(elementKey(a)).toBe(elementKey(a));
    expect(elementKey(a)).not.toBe(elementKey(b));
  });

  it("has no key for a missing element", () => {
    expect(elementKey(null)).toBeUndefined();
    expect(elementKey(undefined)).toBeUndefined();
  });

  it("gives a fresh key to a replacement element in the same position", () => {
    // Undo replaces a table's cells with new nodes; the panel must remount
    // rather than reuse the old cell's mirrored selection.
    const table = document.createElement("div");
    table.innerHTML = '<div class="bloom-cell"></div>';
    const before = elementKey(table.firstElementChild);
    table.innerHTML = '<div class="bloom-cell"></div>';
    expect(elementKey(table.firstElementChild)).not.toBe(before);
  });
});
