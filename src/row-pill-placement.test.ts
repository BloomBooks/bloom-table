import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable, detachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons, rowClusterOffsetPastColumnAdd } from "./table-size-buttons";

// The row menu pill sits to the right of the selected row, anchored to the row's
// last cell, so that it still shows when the table's left edge is the window's
// left edge. When the row is level with the column "+" (which sits right of the
// table, centered on the table's height), the pill moves past the "+".
//
// jsdom drops anchor() values from style.left, so the pill's horizontal offset is
// checked through rowClusterOffsetPastColumnAdd rather than read off the element.

function makeTable(columns: number, rows: number): HTMLElement {
  const widths = Array(columns).fill("hug").join(",");
  const heights = Array(rows).fill("hug").join(",");
  const cells = Array.from(
    { length: columns * rows },
    (_, i) => `<div class="bloom-cell"><div contenteditable>${i}</div></div>`,
  ).join("");
  document.body.innerHTML = `<div class="bloom-table" data-column-widths="${widths}" data-row-heights="${heights}">${cells}</div>`;
  return document.querySelector(".bloom-table") as HTMLElement;
}

// The element that carries the position is an ancestor of the pill (the
// proximity wrapper around the row cluster); find it by its anchor.
function rowPillPositionedAncestor(): HTMLElement {
  const pill = document.querySelector<HTMLElement>('[data-btable-menu-pill="row"]');
  if (!pill) throw new Error("The row menu pill was never created.");
  for (let el: HTMLElement | null = pill; el && el !== document.body; el = el.parentElement) {
    if (el.style.getPropertyValue("position-anchor")) return el;
  }
  throw new Error("No ancestor of the row menu pill is anchored to a cell.");
}

let realRaf: typeof requestAnimationFrame;

beforeEach(() => {
  tableHistoryManager.reset();
  document.body.innerHTML = "";
  resetTableSizeButtons();
  // Make the overlays' requestAnimationFrame coalescing run synchronously.
  realRaf = globalThis.requestAnimationFrame;
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});

afterEach(() => {
  (globalThis as any).requestAnimationFrame = realRaf;
});

describe("row menu pill placement", () => {

  it("anchors to the last cell of the selected row", () => {
    const table = makeTable(3, 2);
    attachTable(table);
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    expect(cells.length).toBe(6);

    // The first cell of the second row.
    const editable = cells[3].querySelector("[contenteditable]") as HTMLElement;
    editable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const lastCellOfRow = cells[5];
    const anchorName = lastCellOfRow.getAttribute("data-btable-anchor-name");
    expect(anchorName, "the second row's last cell should have been given an anchor name").not.toBe(null);
    const positioned = rowPillPositionedAncestor();
    expect(positioned.style.getPropertyValue("position-anchor")).toBe(anchorName);
    expect(positioned.style.transform).toBe("translate(0, -50%)");

    detachTable(table);
  });

  it("anchors to the spanning cell in a row whose last slot a span covers", () => {
    // A merged title row: the first cell spans all three columns, and the two
    // slots it covers hold hidden skip cells.
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="hug,hug,hug" data-row-heights="hug,hug">
        <div class="bloom-cell" data-span-x="3"><div contenteditable>title</div></div>
        <div class="bloom-cell bloom-skip"></div>
        <div class="bloom-cell bloom-skip"></div>
        <div class="bloom-cell"><div contenteditable>a</div></div>
        <div class="bloom-cell"><div contenteditable>b</div></div>
        <div class="bloom-cell"><div contenteditable>c</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    expect(cells[2].classList.contains("bloom-skip"), "the top row's last slot should hold a skip cell").toBe(true);

    (cells[0].querySelector("[contenteditable]") as HTMLElement).dispatchEvent(
      new FocusEvent("focusin", { bubbles: true }),
    );

    const titleAnchor = cells[0].getAttribute("data-btable-anchor-name");
    expect(titleAnchor, "the spanning title cell should have been given an anchor name").not.toBe(null);
    expect(rowPillPositionedAncestor().style.getPropertyValue("position-anchor")).toBe(titleAnchor);
    expect(cells[2].getAttribute("data-btable-anchor-name")).toBe(null);

    detachTable(table);
  });
});

describe("room to scroll to the pills", () => {
  const marker = () => document.querySelector<HTMLElement>('[data-table-overlay="scroll-room"]');

  it("puts a marker just past the furthest pill, and keeps it when the pills hide", () => {
    const table = makeTable(2, 2);
    attachTable(table);
    const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    const focus = (cell: HTMLElement) =>
      (cell.querySelector("[contenteditable]") as HTMLElement).dispatchEvent(
        new FocusEvent("focusin", { bubbles: true }),
      );

    // jsdom lays nothing out, so the pills measure 0 and no marker is placed yet.
    focus(cells[0]);
    expect(marker()).toBe(null);

    // Give the table pill a real place, past a page's bottom-right corner, then
    // have the pills placed again.
    const tablePill = document.querySelector<HTMLElement>('[data-btable-menu-pill="table"]')!;
    tablePill.getBoundingClientRect = () =>
      ({ left: 880, top: 1180, right: 900, bottom: 1200, width: 20, height: 20, x: 880, y: 1180 }) as DOMRect;
    focus(cells[1]);

    const m = marker();
    expect(m, "a marker should extend the document past the table pill").not.toBe(null);
    // 8px past the pill's far corner, less the marker's own 1px.
    expect(m!.style.left).toBe("907px");
    expect(m!.style.top).toBe("1207px");

    detachTable(table);
    expect(marker(), "the room must outlast the pills hiding").not.toBe(null);

    resetTableSizeButtons();
    expect(marker()).toBe(null);
  });
});

describe("rowClusterOffsetPastColumnAdd", () => {
  const columnAdd = { width: 30, height: 20 };

  it("is 0 when the row is well away from the table's midline", () => {
    // A cluster 28 high and a "+" 20 high, with an 8px gap, are too close within
    // (28 + 20 + 8) / 2 = 28px.
    expect(rowClusterOffsetPastColumnAdd(50, 150, 28, columnAdd, 8)).toBe(0);
    expect(rowClusterOffsetPastColumnAdd(150 + 28, 150, 28, columnAdd, 8)).toBe(0);
  });

  it("is the width of the + plus a gap when the row is level with it", () => {
    expect(rowClusterOffsetPastColumnAdd(150, 150, 28, columnAdd, 8)).toBe(38);
    expect(rowClusterOffsetPastColumnAdd(150 - 27, 150, 28, columnAdd, 8)).toBe(38);
  });
});
