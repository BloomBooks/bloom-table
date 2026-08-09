import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable, detachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";

// Give the table's cells a known on-screen rect so the proximity gate has real
// geometry to test against (happy-dom returns zero rects otherwise). Cells span
// the viewport box [100,100]..[200,200]; affordances would live in the gutter
// just outside that.
function stubCellRects(table: HTMLElement, left = 100, top = 100, right = 200, bottom = 200) {
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  cells.forEach((cell) => {
    cell.getBoundingClientRect = () =>
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

  it("toggles bloom-pointer-near on the table, gating the edit-time chrome (CSS)", () => {
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

    // Focusing a cell reveals the affordances and marks the table pointer-near.
    const editable = table.querySelector(".bloom-cell [contenteditable]") as HTMLElement;
    editable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(table.classList.contains("bloom-pointer-near")).toBe(true);

    // Cursor far away → class removed (selection outline / tint / hints hide).
    moveMouse(500, 500);
    expect(table.classList.contains("bloom-pointer-near")).toBe(false);

    // Back into the active zone → class returns.
    moveMouse(150, 150);
    expect(table.classList.contains("bloom-pointer-near")).toBe(true);

    detachTable(table);
  });
});

// A row/column cluster counts as visible only if neither the pill nor any of
// its ancestors is display:none (showEdgeOverlays hides the whole cluster).
function clusterVisible(kind: "row" | "column"): boolean {
  const pill = document.querySelector<HTMLElement>(`[data-btable-menu-pill="${kind}"]`);
  if (!pill) return false;
  for (let el: HTMLElement | null = pill; el && el !== document.body; el = el.parentElement) {
    if (el.style.display === "none") return false;
  }
  return true;
}

describe("nested tables: overlays follow the table that owns the selection", () => {
  let realRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    tableHistoryManager.reset?.();
    document.body.innerHTML = "";
    resetTableSizeButtons();
    realRaf = globalThis.requestAnimationFrame;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    (globalThis as any).requestAnimationFrame = realRaf;
  });

  // Outer 1x2 table; its first cell hosts a nested 1x2 table. Outer cells span
  // [100,100]..[400,300]; nested cells [110,110]..[190,190], so (350,150) is in
  // the outer zone only and (150,150) is inside both.
  function buildNested(): { outer: HTMLElement; nested: HTMLElement } {
    document.body.innerHTML = `
      <div class="bloom-table" id="outer" data-column-widths="hug,hug" data-row-heights="hug">
        <div class="bloom-cell">
          <div class="bloom-table" id="nested" data-column-widths="hug,hug" data-row-heights="hug">
            <div class="bloom-cell"><div contenteditable>a</div></div>
            <div class="bloom-cell"><div contenteditable>b</div></div>
          </div>
        </div>
        <div class="bloom-cell"><div contenteditable>outer</div></div>
      </div>`;
    const outer = document.getElementById("outer") as HTMLElement;
    const nested = document.getElementById("nested") as HTMLElement;
    attachTable(outer);
    attachTable(nested);
    stubCellRects(outer, 100, 100, 400, 300);
    stubCellRects(nested, 110, 110, 190, 190);
    return { outer, nested };
  }

  it("hides row/column clusters on the outer table while the selection is in a nested table", () => {
    const { outer, nested } = buildNested();

    // Focus a nested cell: the nested table gets the overlays and, since the
    // selected cell is its own, the row/column clusters.
    const editable = nested.querySelector("[contenteditable]") as HTMLElement;
    editable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(nested.classList.contains("bloom-pointer-near")).toBe(true);
    expect(clusterVisible("column")).toBe(true);
    expect(clusterVisible("row")).toBe(true);

    // Move the pointer away from the nested table but still over the outer
    // one: the gate hands the overlays to the outer table. Its row/column
    // clusters must hide — the selected cell is not one of its own cells, so
    // anchoring them would point at the wrong row/column (they used to land on
    // cell (0,0)).
    moveMouse(350, 150);
    expect(outer.classList.contains("bloom-pointer-near")).toBe(true);
    expect(nested.classList.contains("bloom-pointer-near")).toBe(false);
    expect(clusterVisible("column")).toBe(false);
    expect(clusterVisible("row")).toBe(false);

    detachTable(nested);
    detachTable(outer);
  });

  it("prefers the innermost table when the pointer is over a nested table", () => {
    const { outer, nested } = buildNested();

    // With no table active yet, a pointer inside both zones picks the nested
    // (innermost) table, even though the outer one comes first in the document.
    moveMouse(150, 150);
    expect(nested.classList.contains("bloom-pointer-near")).toBe(true);
    expect(outer.classList.contains("bloom-pointer-near")).toBe(false);

    // Pointer over the outer table only → handoff to the outer table.
    moveMouse(350, 150);
    expect(outer.classList.contains("bloom-pointer-near")).toBe(true);
    expect(nested.classList.contains("bloom-pointer-near")).toBe(false);

    // Back over the nested table → the nested table wins again.
    moveMouse(150, 150);
    expect(nested.classList.contains("bloom-pointer-near")).toBe(true);
    expect(outer.classList.contains("bloom-pointer-near")).toBe(false);

    detachTable(nested);
    detachTable(outer);
  });
});

describe("stale edit-time artifacts in loaded content are scrubbed on attach", () => {
  let realRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    tableHistoryManager.reset?.();
    document.body.innerHTML = "";
    resetTableSizeButtons();
    realRaf = globalThis.requestAnimationFrame;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    (globalThis as any).requestAnimationFrame = realRaf;
  });

  it("drops anchor names and selection classes baked in by a previous session", () => {
    // Saved content from an earlier session: cell 1 kept its anchor name and
    // selection. This session's counter restarts, so --btable-cell-1 would be
    // minted again for a DIFFERENT cell — the pills would anchor to this one.
    document.body.innerHTML = `
      <div class="bloom-table table--selected bloom-pointer-near"
           data-column-widths="hug,hug" data-row-heights="hug">
        <div class="bloom-cell"><div contenteditable>1</div></div>
        <div class="bloom-cell cell--selected"
             style="anchor-name: --btable-cell-1"
             data-btable-anchor-name="--btable-cell-1"><div contenteditable>2</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);

    const cells = table.querySelectorAll<HTMLElement>(".bloom-cell");
    expect(cells[1].style.getPropertyValue("anchor-name")).toBe("");
    expect(cells[1].getAttribute("data-btable-anchor-name")).toBe(null);
    expect(cells[1].classList.contains("cell--selected")).toBe(false);
    expect(table.classList.contains("table--selected")).toBe(false);
    expect(table.classList.contains("bloom-pointer-near")).toBe(false);

    detachTable(table);
  });

  it("anchors the pills to the freshly selected cell despite a baked stale anchor name", () => {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug">
        <div class="bloom-cell"
             style="anchor-name: --btable-cell-1"
             data-btable-anchor-name="--btable-cell-1"><div contenteditable>stale</div></div>
        <div class="bloom-cell"><div contenteditable>target</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);
    stubCellRects(table);

    // Select the SECOND cell; the pill must anchor to it, not to whichever
    // cell held the colliding saved name.
    const cells = table.querySelectorAll<HTMLElement>(".bloom-cell");
    const editable = cells[1].querySelector("[contenteditable]") as HTMLElement;
    editable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const cellAnchor = cells[1].getAttribute("data-btable-anchor-name");
    expect(cellAnchor).not.toBe(null);
    const colPill = document.querySelector<HTMLElement>('[data-btable-menu-pill="column"]');
    let anchorUsed: string | null = null;
    for (let el: HTMLElement | null = colPill; el && el !== document.body; el = el.parentElement) {
      const pa = el.style.getPropertyValue("position-anchor");
      if (pa) {
        anchorUsed = pa;
        break;
      }
    }
    expect(anchorUsed).toBe(cellAnchor);
    // No other element carries the same anchor name.
    expect(document.querySelectorAll(`[data-btable-anchor-name="${cellAnchor}"]`).length).toBe(1);

    detachTable(table);
  });
});
