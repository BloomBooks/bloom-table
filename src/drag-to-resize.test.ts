import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { attachTable, detachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";

// happy-dom gives every element a zero rect, so the edge detection has nothing
// to aim at until we hand each cell a rect of its own.
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

// Two columns x two rows, each cell 100x50, starting at (100,100).
function layOutGrid(table: HTMLElement) {
  const cells = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
  cells.forEach((cell, i) => {
    const column = i % 2;
    const row = Math.floor(i / 2);
    const left = 100 + column * 100;
    const top = 100 + row * 50;
    stubRect(cell, left, top, left + 100, top + 50);
    const child = cell.firstElementChild as HTMLElement | null;
    if (child) stubRect(child, left, top, left + 100, top + 50);
  });
  return cells;
}

function makeTable(columnWidths: string, rowHeights: string, firstCellAttrs = ""): HTMLElement {
  document.body.innerHTML = `
    <div class="bloom-table" data-column-widths="${columnWidths}" data-row-heights="${rowHeights}">
      <div class="bloom-cell" ${firstCellAttrs}><div contenteditable>1</div></div>
      <div class="bloom-cell"><div contenteditable>2</div></div>
      <div class="bloom-cell"><div contenteditable>3</div></div>
      <div class="bloom-cell"><div contenteditable>4</div></div>
    </div>`;
  const table = document.querySelector(".bloom-table") as HTMLElement;
  attachTable(table);
  return table;
}

function mouseDownAt(el: HTMLElement, clientX: number, clientY: number) {
  el.dispatchEvent(new MouseEvent("mousedown", { clientX, clientY, bubbles: true }));
}

function moveDocument(clientX: number, clientY: number) {
  document.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY, bubbles: true }));
}

function columnWidths(table: HTMLElement): string[] {
  return (table.getAttribute("data-column-widths") || "").split(",");
}

describe("drag to resize", () => {
  beforeEach(() => {
    tableHistoryManager.reset?.();
    document.body.innerHTML = "";
    resetTableSizeButtons();
    document.body.style.cursor = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lets a hover over a cell edge reach document-level listeners", () => {
    const table = makeTable("hug,hug", "hug,hug");
    const cells = layOutGrid(table);
    const child = cells[0].firstElementChild as HTMLElement;

    let seenAtDocument = 0;
    const spy = () => {
      seenAtDocument++;
    };
    document.addEventListener("mousemove", spy);
    try {
      // x=198 is inside the 5px band at the cell's right edge (rect 100..200),
      // so the resize cursor appears - and the move must still bubble, or the
      // proximity gate and ProximityDiv would freeze while the cursor slides
      // along the edge toward the row/column buttons.
      child.dispatchEvent(new MouseEvent("mousemove", { clientX: 198, clientY: 120, bubbles: true }));
      expect(child.style.cursor).toBe("ew-resize");
      expect(seenAtDocument).toBe(1);
    } finally {
      document.removeEventListener("mousemove", spy);
      detachTable(table);
    }
  });

  it("clears the cursor it put on a cell's content when the hover moves on", () => {
    const table = makeTable("hug,hug", "hug,hug");
    const cells = layOutGrid(table);
    const edgeChild = cells[0].firstElementChild as HTMLElement;
    const otherChild = cells[2].firstElementChild as HTMLElement;

    edgeChild.dispatchEvent(new MouseEvent("mousemove", { clientX: 198, clientY: 120, bubbles: true }));
    expect(edgeChild.style.cursor).toBe("ew-resize");

    // Away from any edge: the old element loses its cursor and the new one never
    // gains an inline style (which would otherwise end up in saved content).
    otherChild.dispatchEvent(new MouseEvent("mousemove", { clientX: 140, clientY: 170, bubbles: true }));
    expect(edgeChild.style.cursor).toBe("");
    expect(otherChild.style.cursor).toBe("");

    detachTable(table);
  });

  it("starts a column drag from the column's real width when it is given in mm", () => {
    const table = makeTable("40mm,hug", "hug,hug");
    const cells = layOutGrid(table);
    const child = cells[0].firstElementChild as HTMLElement;

    mouseDownAt(child, 198, 120);
    moveDocument(208, 120);

    // 40mm is ~151.2px, so a 10px drag lands near 161px - not 60px, which is
    // what a px-only parse plus a 50px fallback used to produce.
    const width = parseFloat(columnWidths(table)[0]);
    expect(width).toBeGreaterThan(155);
    expect(width).toBeLessThan(167);

    detachTable(table);
  });

  it("resizes the last column a merged cell covers, not the one it starts in", () => {
    const table = makeTable("hug,50px", "hug,hug", 'data-span-x="2"');
    const cells = layOutGrid(table);
    (cells[1] as HTMLElement).classList.add("bloom-skip");
    // The merged cell's rect covers both columns: 100..300.
    stubRect(cells[0], 100, 100, 300, 150);
    stubRect(cells[0].firstElementChild as HTMLElement, 100, 100, 300, 150);
    const child = cells[0].firstElementChild as HTMLElement;

    mouseDownAt(child, 298, 120);
    moveDocument(308, 120);

    // Its visible right edge is column 1's boundary, so column 1 moves and
    // column 0 (whose boundary sits inside the merge) is left alone.
    expect(columnWidths(table)[0]).toBe("hug");
    expect(parseFloat(columnWidths(table)[1])).toBeCloseTo(60, 1);

    detachTable(table);
  });

  it("ends an in-flight drag when the table is detached", () => {
    const table = makeTable("100px,hug", "hug,hug");
    const cells = layOutGrid(table);
    const child = cells[0].firstElementChild as HTMLElement;

    mouseDownAt(child, 198, 120);
    expect(document.body.style.cursor).toBe("ew-resize");

    detachTable(table);
    expect(document.body.style.cursor).toBe("default");

    // Re-attaching must not resume the abandoned drag.
    const widthsAfterDetach = table.getAttribute("data-column-widths");
    attachTable(table);
    moveDocument(400, 300);
    expect(table.getAttribute("data-column-widths")).toBe(widthsAfterDetach);

    detachTable(table);
  });

  it("does not log to the console while previewing a row resize", () => {
    const table = makeTable("hug,hug", "hug,hug");
    const cells = layOutGrid(table);
    const child = cells[0].firstElementChild as HTMLElement;

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      mouseDownAt(child, 140, 148); // bottom edge of the first row (rect 100..150)
      moveDocument(140, 160);
      moveDocument(140, 170);
      expect(log).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      info.mockRestore();
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      detachTable(table);
    }
  });
});
