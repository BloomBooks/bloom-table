import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable, detachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";

// Give the table's cells a known on-screen rect so the proximity gate has real
// geometry to test against (happy-dom returns zero rects otherwise). Cells span
// the viewport box [100,100]..[200,200]; affordances would live in the gutter
// just outside that.
function stubCellRects(table: HTMLElement) {
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  cells.forEach((cell) => {
    cell.getBoundingClientRect = () =>
      ({ left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100 }) as DOMRect;
  });
}

function moveMouse(clientX: number, clientY: number) {
  document.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY, bubbles: true }));
}

function tablePillsVisible(): boolean {
  const pills = Array.from(
    document.querySelectorAll<HTMLElement>('[data-btable-menu-pill="table"]'),
  );
  return pills.length > 0 && pills.some((p) => p.style.display !== "none");
}

describe("proximity gate hides affordances when the cursor leaves the active zone", () => {
  let realRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    tableHistoryManager.reset?.();
    document.body.innerHTML = "";
    resetTableSizeButtons();
    // Make the gate's requestAnimationFrame coalescing run synchronously.
    realRaf = globalThis.requestAnimationFrame;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    (globalThis as any).requestAnimationFrame = realRaf;
  });

  it("keeps affordances visible in the reach gutter but hides them far away", () => {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
        <div class="bloom-cell"><div contenteditable>1</div></div>
        <div class="bloom-cell"><div contenteditable>2</div></div>
        <div class="bloom-cell"><div contenteditable>3</div></div>
        <div class="bloom-cell"><div contenteditable>4</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);
    stubCellRects(table);

    // Focusing a cell shows the affordances (existing behavior).
    const editable = table.querySelector(".bloom-cell [contenteditable]") as HTMLElement;
    editable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(tablePillsVisible()).toBe(true);

    // Cursor well outside the table + gutter → affordances hide.
    moveMouse(500, 500);
    expect(tablePillsVisible()).toBe(false);

    // Cursor in the gutter just outside the cells (where an edge affordance sits):
    // right edge is 200, padding is 70, so x=230 is "reaching for it" — stay visible.
    moveMouse(230, 150);
    expect(tablePillsVisible()).toBe(true);

    // Back inside the cells → still visible.
    moveMouse(150, 150);
    expect(tablePillsVisible()).toBe(true);

    detachTable(table);
  });
});
