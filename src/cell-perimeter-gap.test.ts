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

  it("with no gap, turning off the center keeps the neighbors' facing lines", () => {
    const table = make3x3(false);
    const cells = getTableCells(table);
    cells.forEach((c) => applyCellPerimeter(table, c, allRed));

    const off = { weight: 0, style: "none" as const };
    applyCellPerimeter(table, cells[4], { top: off, right: off, bottom: off, left: off });

    const cb = buildRenderModel(table).cellBorders;
    // Turning off the center withdraws only its side of each shared edge; the
    // neighbors explicitly wanted red lines there, so the lines stay, now
    // painted by the neighbors.
    expect(isRed(cb[1].bottom)).toBe(true);
    expect(isRed(cb[7].top)).toBe(true);
    expect(isRed(cb[3].right)).toBe(true);
    expect(isRed(cb[5].left)).toBe(true);
    // The center's sides carry its explicit 'none' (rendering as nothing), so
    // the border UI reads the cell's own claim instead of the neighbors'.
    expect(cb[4].top?.style).toBe("none");
    expect(cb[4].right?.style).toBe("none");
    expect(cb[4].bottom?.style).toBe("none");
    expect(cb[4].left?.style).toBe("none");
  });

  it("zero gap: removing the right column's borders leaves the left column a complete box", () => {
    // The user scenario: a default-bordered 2x2 (no explicit edges at all),
    // then "column 2: no border". The shared boundary must stay, painted by
    // the left column, because the neighbor's side is materialized from the
    // rendered default before this column's 'none' lands.
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", "50px,50px");
    table.setAttribute("data-row-heights", "50px,50px");
    for (let i = 0; i < 4; i++) {
      const cell = document.createElement("div");
      cell.className = "bloom-cell";
      table.appendChild(cell);
    }
    document.body.appendChild(table);
    const cells = getTableCells(table);

    const off = { weight: 0, style: "none" as const };
    const allOff = { top: off, right: off, bottom: off, left: off };
    applyCellPerimeter(table, cells[1], allOff);
    applyCellPerimeter(table, cells[3], allOff);

    const cb = buildRenderModel(table).cellBorders;
    const visible = (b: { weight: number; style: string } | null | undefined) =>
      !!b && b.weight > 0 && b.style !== "none";

    // The shared boundary still draws, owned by the left column; the right
    // column's sides read as its explicit 'none'.
    expect(visible(cb[0].right)).toBe(true);
    expect(visible(cb[2].right)).toBe(true);
    expect(cb[1].left?.style).toBe("none");
    expect(cb[3].left?.style).toBe("none");

    // The right column's perimeter and its interior line are gone.
    expect(visible(cb[1].top)).toBe(false);
    expect(visible(cb[1].right)).toBe(false);
    expect(visible(cb[1].bottom)).toBe(false);
    expect(visible(cb[3].top)).toBe(false);
    expect(visible(cb[3].right)).toBe(false);
    expect(visible(cb[3].bottom)).toBe(false);

    // The left column keeps its default-drawn perimeter and interior line.
    expect(visible(cb[0].left)).toBe(true);
    expect(visible(cb[0].top)).toBe(true);
    expect(visible(cb[2].left)).toBe(true);
    expect(visible(cb[2].bottom)).toBe(true);
    expect(visible(cb[0].bottom) || visible(cb[2].top)).toBe(true);
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
