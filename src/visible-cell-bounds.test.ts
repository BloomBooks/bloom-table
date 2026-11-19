import { describe, it, expect, beforeEach } from "vite-plus/test";
import { visibleCellBounds } from "./resize-boundary-highlight";

// jsdom lays nothing out, so every rect here is stubbed.
function stubRect(el: HTMLElement, left: number, top: number, right: number, bottom: number) {
  el.getBoundingClientRect = () =>
    ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top }) as DOMRect;
}

// A page of 0..500 x 0..800 holding a table whose one cell's content runs on
// to y=950, past the bottom of the page (as an overflowing cell does in Bloom).
// The longhands, because jsdom does not expand the overflow shorthand.
function makePageWithOverflowingTable(pageOverflow: string) {
  document.body.innerHTML = `
    <div class="page" style="overflow-x: ${pageOverflow}; overflow-y: ${pageOverflow}">
      <div class="bloom-table"><div class="bloom-cell"></div></div>
    </div>`;
  const page = document.querySelector<HTMLElement>(".page")!;
  const table = document.querySelector<HTMLElement>(".bloom-table")!;
  const cell = document.querySelector<HTMLElement>(".bloom-cell")!;
  stubRect(page, 0, 0, 500, 800);
  stubRect(table, 0, 0, 500, 800);
  stubRect(cell, 0, 0, 500, 950);
  return table;
}

describe("visibleCellBounds", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("is cut off where an ancestor with overflow hidden ends", () => {
    const table = makePageWithOverflowingTable("hidden");
    expect(table.querySelector(".bloom-cell")!.getBoundingClientRect().bottom).toBe(950);

    expect(visibleCellBounds(table)).toEqual({ minL: 0, minT: 0, maxR: 500, maxB: 800 });
  });

  it("reaches the cell's own edge when nothing clips it", () => {
    const table = makePageWithOverflowingTable("visible");

    expect(visibleCellBounds(table)).toEqual({ minL: 0, minT: 0, maxR: 500, maxB: 950 });
  });

  it("is null when the clipping ancestor shows none of the table", () => {
    const table = makePageWithOverflowingTable("hidden");
    stubRect(table.querySelector<HTMLElement>(".bloom-cell")!, 0, 850, 500, 950);

    expect(visibleCellBounds(table)).toBe(null);
  });
});
