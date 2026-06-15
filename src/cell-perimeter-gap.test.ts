import { describe, it, expect } from "vite-plus/test";
import { buildRenderModel } from "./table-renderer";
import { applyCellPerimeter } from "./edge-utils";
import { getTableCells } from "./structure";

function make3x3(gap = false): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.setAttribute("data-column-widths", "50px,50px,50px");
  table.setAttribute("data-row-heights", "50px,50px,50px");
  if (gap) {
    table.setAttribute("data-gap-x", "8px");
    table.setAttribute("data-gap-y", "8px");
  }
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    table.appendChild(cell);
  }
  document.body.appendChild(table);
  return table;
}

const RED = { weight: 2, style: "solid" as const, color: "#ff0000" };
const allRed = { top: RED, right: RED, bottom: RED, left: RED };
const isRed = (b: { color: string } | null | undefined) => !!b && b.color === "#ff0000";

describe("applyCellPerimeter: gap isolates a cell's borders", () => {
  it("with a gap, reddening the center cell leaves the neighbors untouched", () => {
    const table = make3x3(true);
    const cells = getTableCells(table);
    const center = cells[4]; // r1c1

    applyCellPerimeter(table, center, allRed);

    const model = buildRenderModel(table);
    const cb = model.cellBorders;

    // Center is fully red on all four sides.
    expect(isRed(cb[4].top)).toBe(true);
    expect(isRed(cb[4].right)).toBe(true);
    expect(isRed(cb[4].bottom)).toBe(true);
    expect(isRed(cb[4].left)).toBe(true);

    // The four orthogonal neighbors keep their own (non-red) facing sides.
    expect(isRed(cb[1].bottom)).toBe(false); // above center
    expect(isRed(cb[7].top)).toBe(false); // below center
    expect(isRed(cb[3].right)).toBe(false); // left of center
    expect(isRed(cb[5].left)).toBe(false); // right of center
  });

  it("with no gap, the shared line is one stroke so both cells reflect the edit", () => {
    const table = make3x3(false);
    const cells = getTableCells(table);
    const center = cells[4];

    applyCellPerimeter(table, center, allRed);

    const model = buildRenderModel(table);
    const cb = model.cellBorders;

    // Center is red, and because the line is shared, exactly one of the two
    // adjacent cells carries the (single) stroke — never split into two lines.
    expect(isRed(cb[4].top) || isRed(cb[1].bottom)).toBe(true);
    expect(isRed(cb[4].top) && isRed(cb[1].bottom)).toBe(false);
  });

  it("with a gap, turning off only the center keeps neighbor borders", () => {
    const table = make3x3(true);
    const cells = getTableCells(table);
    // Establish red borders everywhere first via uniform default-ish setup:
    cells.forEach((c) => applyCellPerimeter(table, c, allRed));

    const off = { weight: 0, style: "none" as const };
    applyCellPerimeter(table, cells[4], {
      top: off,
      right: off,
      bottom: off,
      left: off,
    });

    const model = buildRenderModel(table);
    const cb = model.cellBorders;

    // Center has no borders...
    expect(isRed(cb[4].top)).toBe(false);
    expect(isRed(cb[4].left)).toBe(false);
    // ...but neighbors keep their facing borders.
    expect(isRed(cb[1].bottom)).toBe(true);
    expect(isRed(cb[3].right)).toBe(true);
    expect(isRed(cb[5].left)).toBe(true);
    expect(isRed(cb[7].top)).toBe(true);
  });
});
