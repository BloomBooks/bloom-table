import { describe, it, expect, beforeEach } from "vite-plus/test";
import {
  clearPulse,
  pulseTableBorders,
  pulseRow,
  pulseColumn,
  pulseCell,
} from "./pulse-highlight";

// happy-dom gives every element a zero rect, so each cell needs a rect of its
// own for the union-bounding-box math to have anything to work with.
function stubRect(el: HTMLElement, left: number, top: number, right: number, bottom: number) {
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      x: left,
      y: top,
    }) as DOMRect;
}

// 2x2 grid of 50px cells filling [100,100]..[200,200].
function makeTable(firstCellAttrs = ""): { table: HTMLElement; cells: HTMLElement[] } {
  document.body.innerHTML = `
    <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
      <div class="bloom-cell" ${firstCellAttrs}><div contenteditable="true">r0c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r0c1</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c1</div></div>
    </div>`;
  const table = document.querySelector(".bloom-table") as HTMLElement;
  const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
  cells.forEach((cell, i) => {
    const left = 100 + (i % 2) * 50;
    const top = 100 + Math.floor(i / 2) * 50;
    stubRect(cell, left, top, left + 50, top + 50);
  });
  return { table, cells };
}

const overlays = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".bloom-sel-overlay"));

function rectOf(overlay: HTMLElement) {
  const s = overlay.style;
  return {
    left: parseFloat(s.left),
    top: parseFloat(s.top),
    width: parseFloat(s.width),
    height: parseFloat(s.height),
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

describe("pulse highlight overlays", () => {
  it("pulseCell draws one overlay matching the cell, tagged for prepare-for-save", () => {
    const { cells } = makeTable();
    pulseCell(cells[3]);

    const all = overlays();
    expect(all.length).toBe(1);
    expect(all[0].hasAttribute("data-table-overlay")).toBe(true);
    expect(rectOf(all[0])).toEqual({ left: 150, top: 150, width: 50, height: 50 });
  });

  it("pulseTableBorders covers the whole table's bounding box", () => {
    const { table } = makeTable();
    pulseTableBorders(table);

    expect(rectOf(overlays()[0])).toEqual({ left: 100, top: 100, width: 100, height: 100 });
  });

  it("repeated pulses never accumulate: one overlay total", () => {
    const { table, cells } = makeTable();
    pulseRow(table, cells[0]);
    pulseColumn(table, cells[0]);
    pulseCell(cells[1]);
    pulseTableBorders(table);

    expect(overlays().length).toBe(1);
  });

  it("clearPulse removes every overlay", () => {
    const { table } = makeTable();
    pulseTableBorders(table);
    expect(overlays().length).toBe(1);

    clearPulse(table);
    expect(overlays().length).toBe(0);
  });

  it("pulseRow covers exactly the target row", () => {
    const { table, cells } = makeTable();
    pulseRow(table, cells[2]); // row 1

    expect(rectOf(overlays()[0])).toEqual({ left: 100, top: 150, width: 100, height: 50 });
  });

  it("pulseRow includes a cell spanning down into the target row", () => {
    const { table, cells } = makeTable('data-span-y="2"');
    cells[2].classList.add("bloom-skip");
    stubRect(cells[2], 0, 0, 0, 0); // hidden skip cell has no size
    // The anchor's rect covers both rows in column 0.
    stubRect(cells[0], 100, 100, 150, 200);

    pulseRow(table, cells[3]); // row 1: the anchor reaches into it

    // Union of the tall anchor (100..150 x 100..200) and r1c1 (150..200 x 150..200).
    expect(rectOf(overlays()[0])).toEqual({ left: 100, top: 100, width: 100, height: 100 });
  });

  it("pulseColumn covers exactly the target column, spanning cells included", () => {
    const { table, cells } = makeTable('data-span-x="2"');
    cells[1].classList.add("bloom-skip");
    stubRect(cells[1], 0, 0, 0, 0);
    // The anchor's rect covers both columns in row 0.
    stubRect(cells[0], 100, 100, 200, 150);

    pulseColumn(table, cells[3]); // column 1: the anchor reaches into it

    // Union of the wide anchor (100..200 x 100..150) and r1c1 (150..200 x 150..200).
    expect(rectOf(overlays()[0])).toEqual({ left: 100, top: 100, width: 100, height: 100 });

    // Column 0 also owns the wide anchor, so its pulse takes in the anchor's
    // full width — the merged cell belongs to both columns it covers.
    pulseColumn(table, cells[2]);
    expect(rectOf(overlays()[0])).toEqual({ left: 100, top: 100, width: 100, height: 100 });
  });

  it("places the overlay in page coordinates so it tracks scrolling", () => {
    Object.defineProperty(window, "scrollX", { value: 30, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 70, configurable: true });
    const { cells } = makeTable();

    pulseCell(cells[0]);

    expect(rectOf(overlays()[0])).toEqual({ left: 130, top: 170, width: 50, height: 50 });
  });

  it("draws nothing when every cell in the region is zero-size", () => {
    const { table, cells } = makeTable();
    cells.forEach((c) => stubRect(c, 0, 0, 0, 0));

    pulseTableBorders(table);

    expect(overlays().length).toBe(0);
  });
});
