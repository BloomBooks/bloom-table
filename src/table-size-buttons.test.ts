import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";

// happy-dom gives every element a zero rect, so the overlay code needs the
// geometry stubbed. Lay a 2x2 table out as four 50px cells filling the box
// [100,100]..[200,200]: row 0 ends at y=150, the TABLE ends at y=200, which is
// what distinguishes "preview at the selected row" from "preview at the table's
// far edge".
function stubGrid(table: HTMLElement, ox = 100, oy = 100, size = 50) {
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  cells.forEach((cell, i) => {
    const left = ox + (i % 2) * size;
    const top = oy + Math.floor(i / 2) * size;
    cell.getBoundingClientRect = () =>
      ({
        left,
        top,
        right: left + size,
        bottom: top + size,
        width: size,
        height: size,
        x: left,
        y: top,
      }) as DOMRect;
  });
  return cells;
}

function makeTable(id = "t"): { table: HTMLElement; cells: HTMLElement[] } {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="bloom-table" id="${id}" data-column-widths="hug,hug" data-row-heights="hug,hug">
      <div class="bloom-cell"><div contenteditable="true">r0c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r0c1</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c1</div></div>
    </div>`;
  const table = wrapper.firstElementChild as HTMLElement;
  document.body.appendChild(table);
  attachTable(table);
  return { table, cells: stubGrid(table) };
}

const focusCell = (cell: HTMLElement) =>
  (cell.querySelector("[contenteditable]") as HTMLElement).dispatchEvent(
    new FocusEvent("focusin", { bubbles: true }),
  );

const tablePills = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-btable-menu-pill="table"]'));

const tablePillsVisible = () => tablePills().some((p) => p.style.display !== "none");

const rowAddButton = () =>
  document.querySelector<HTMLElement>('button[aria-label="Insert Row Below"]');

const addPreview = () =>
  document.querySelector<HTMLElement>('[data-table-overlay="add-preview"]');

beforeEach(() => {
  tableHistoryManager.reset();
  document.body.innerHTML = "";
  resetTableSizeButtons();
  (globalThis as any).__realRaf = globalThis.requestAnimationFrame;
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});

afterEach(() => {
  (globalThis as any).requestAnimationFrame = (globalThis as any).__realRaf;
});

describe("resetTableSizeButtons tears down what ensureTableSizeButtons built", () => {
  it("leaves no orphaned overlay elements behind after reset + re-attach", () => {
    const { table, cells } = makeTable("a");
    focusCell(cells[0]);
    expect(tablePills().length).toBe(1);

    // Reset WITHOUT wiping the body (a host re-attach), then attach again.
    table.remove();
    resetTableSizeButtons();
    const second = makeTable("b");
    focusCell(second.cells[0]);

    // Exactly one of each affordance: the first set's ProximityDiv wrappers
    // were destroyed rather than abandoned in the document.
    expect(tablePills().length).toBe(1);
    expect(
      document.querySelectorAll('[data-btable-menu-pill="row"]').length,
    ).toBe(1);
    expect(
      document.querySelectorAll('button[aria-label="Insert Row Below"]').length,
    ).toBe(1);
  });

  it("removes the document listeners, so a focusin after reset raises nothing", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);
    expect(tablePillsVisible()).toBe(true);

    resetTableSizeButtons();
    focusCell(cells[1]);
    expect(tablePillsVisible()).toBe(false);
  });

  it("drops the cached preview divs, so the previews still render after a body swap", () => {
    const first = makeTable("a");
    focusCell(first.cells[0]);
    rowAddButton()!.dispatchEvent(new MouseEvent("mouseenter"));
    expect(addPreview()).not.toBe(null);

    // The host replaces the page content wholesale, detaching the cached div.
    document.body.innerHTML = "";
    resetTableSizeButtons();
    const second = makeTable("b");
    focusCell(second.cells[0]);
    rowAddButton()!.dispatchEvent(new MouseEvent("mouseenter"));

    const preview = addPreview();
    expect(preview).not.toBe(null);
    expect(document.body.contains(preview!)).toBe(true);
    expect(preview!.style.display).toBe("block");
  });
});

describe("overlay repositioning", () => {
  it("does not adopt an arbitrary table when a scroll happens with none active", () => {
    makeTable();
    // No focus, no mouse near the table: a scroll must not reveal anything.
    window.dispatchEvent(new Event("scroll"));
    expect(tablePillsVisible()).toBe(false);
  });

  it("repositions on a scroll of an inner scroll container", () => {
    const scroller = document.createElement("div");
    document.body.appendChild(scroller);
    const { table, cells } = makeTable();
    scroller.appendChild(table);
    focusCell(cells[0]);

    const pill = tablePills()[0].parentElement as HTMLElement;
    const before = pill.style.top;

    // The container scrolls: the cells move up 40px. `scroll` does not bubble,
    // so only a capture-phase listener hears this.
    stubGrid(table, 100, 60);
    scroller.dispatchEvent(new Event("scroll"));

    expect(pill.style.top).not.toBe(before);
  });
});

const menuPopup = () => document.querySelector<HTMLElement>("[data-btable-menu]");

const menuItem = (label: string) =>
  menuPopup()?.querySelector<HTMLElement>(`button[aria-label="${label}"]`) ?? null;

const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const pill = (kind: string) =>
  document.querySelector<HTMLElement>(`[data-btable-menu-pill="${kind}"]`)!;

const cellTexts = (table: HTMLElement) =>
  Array.from(table.querySelectorAll(".bloom-cell")).map((c) => c.textContent?.trim());

describe("the perimeter '+' buttons", () => {
  it("appends a row at the table's bottom edge, undoably", () => {
    const { table, cells } = makeTable();
    focusCell(cells[0]); // selection in row 0; the append still lands at the end

    rowAddButton()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(table.querySelectorAll(".bloom-cell").length).toBe(6);
    expect((table.getAttribute("data-row-heights") || "").split(",").length).toBe(3);
    // The new row went below the existing rows, not below the selected one.
    expect(cellTexts(table).slice(0, 4)).toEqual(["r0c0", "r0c1", "r1c0", "r1c1"]);

    expect(tableHistoryManager.undoLast()).toBe(true);
    expect(table.querySelectorAll(".bloom-cell").length).toBe(4);
  });

  it("appends a column at the table's right edge, undoably", () => {
    const { table, cells } = makeTable();
    focusCell(cells[0]);

    document
      .querySelector<HTMLElement>('button[aria-label="Insert Column Right"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(table.querySelectorAll(".bloom-cell").length).toBe(6);
    expect((table.getAttribute("data-column-widths") || "").split(",").length).toBe(3);

    expect(tableHistoryManager.undoLast()).toBe(true);
    expect((table.getAttribute("data-column-widths") || "").split(",").length).toBe(2);
  });
});

describe("pill menus", () => {
  it("opens on a pill click, toggles closed on a second click", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);

    click(pill("row"));
    expect(menuPopup()).not.toBe(null);

    click(pill("row"));
    expect(menuPopup()).toBe(null);
  });

  it("closes on Escape and on a mousedown outside the popup", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);

    click(pill("row"));
    expect(menuPopup()).not.toBe(null);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menuPopup()).toBe(null);

    click(pill("row"));
    expect(menuPopup()).not.toBe(null);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(menuPopup()).toBe(null);
  });

  it("Delete Row removes the selected cell's row and closes the menu", () => {
    const { table, cells } = makeTable();
    focusCell(cells[2]); // row 1

    click(pill("row"));
    click(menuItem("Delete Row")!);

    expect(menuPopup()).toBe(null);
    expect(cellTexts(table)).toEqual(["r0c0", "r0c1"]);
    expect((table.getAttribute("data-row-heights") || "").split(",").length).toBe(1);

    expect(tableHistoryManager.undoLast()).toBe(true);
    expect(table.querySelectorAll(".bloom-cell").length).toBe(4);
  });

  it("hovering Delete Row previews the doomed row's exact box", () => {
    const { cells } = makeTable();
    focusCell(cells[2]); // row 1 occupies [100,150]..[200,200]

    click(pill("row"));
    menuItem("Delete Row")!.dispatchEvent(new MouseEvent("mouseenter"));

    const preview = document.querySelector<HTMLElement>(
      '[data-table-overlay="delete-preview"]',
    )!;
    expect(preview.style.display).toBe("block");
    expect(preview.style.left).toBe("100px");
    expect(preview.style.top).toBe("150px");
    expect(preview.style.width).toBe("100px");
    expect(preview.style.height).toBe("50px");

    menuItem("Delete Row")!.dispatchEvent(new MouseEvent("mouseleave"));
    expect(preview.style.display).toBe("none");
  });

  it("Delete Column removes the selected cell's column", () => {
    const { table, cells } = makeTable();
    focusCell(cells[1]); // column 1

    click(pill("column"));
    click(menuItem("Delete Column")!);

    expect(cellTexts(table)).toEqual(["r0c0", "r1c0"]);
    expect((table.getAttribute("data-column-widths") || "").split(",").length).toBe(1);
  });

  it("Add Row Below inserts relative to the selected cell, not at the table edge", () => {
    const { table, cells } = makeTable();
    focusCell(cells[0]); // row 0

    click(pill("row"));
    click(menuItem("Add Row Below")!);

    // Three rows now, with the blank row between the two original ones.
    expect((table.getAttribute("data-row-heights") || "").split(",").length).toBe(3);
    const texts = cellTexts(table);
    expect(texts.slice(0, 2)).toEqual(["r0c0", "r0c1"]);
    expect(texts.slice(4)).toEqual(["r1c0", "r1c1"]);
  });

  it("Delete Table removes the whole table from the document", () => {
    const { table, cells } = makeTable();
    focusCell(cells[0]);

    click(pill("table"));
    click(menuItem("Delete Table")!);

    expect(document.body.contains(table)).toBe(false);
    expect(menuPopup()).toBe(null);
  });
});

describe("the cell context menu", () => {
  const rightClick = (el: HTMLElement) =>
    el.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }),
    );

  it("merges the cell rightward, then Split restores it", () => {
    const { table, cells } = makeTable();
    focusCell(cells[0]);

    rightClick(cells[0].querySelector("[contenteditable]") as HTMLElement);
    expect(menuPopup()).not.toBe(null);
    click(menuItem("Merge with cell to the right")!);

    expect(cells[0].getAttribute("data-span-x")).toBe("2");
    expect(cells[1].classList.contains("bloom-skip")).toBe(true);

    rightClick(cells[0].querySelector("[contenteditable]") as HTMLElement);
    click(menuItem("Split")!);

    expect(cells[0].getAttribute("data-span-x") ?? "1").toBe("1");
    expect(cells[1].classList.contains("bloom-skip")).toBe(false);
    expect(document.body.contains(table)).toBe(true);
  });

  it("merges the cell that was right-clicked, not the one that is selected", () => {
    const { cells } = makeTable();
    focusCell(cells[0]); // cell r0c0 is the selected cell
    expect(cells[0].classList.contains("cell--selected")).toBe(true);

    // Right-click a DIFFERENT cell. A right-click does not move the selection
    // (only the primary button does), so the two differ while the menu is open.
    rightClick(cells[2]);
    click(menuItem("Merge with cell to the right")!);

    expect(cells[2].getAttribute("data-span-x")).toBe("2");
    expect(cells[3].classList.contains("bloom-skip")).toBe(true);
    // The selected cell is untouched.
    expect(cells[0].getAttribute("data-span-x") ?? "1").toBe("1");
  });
});

describe("the '+' hover preview matches where the button actually inserts", () => {
  it("draws the row bar at the table's bottom edge, not the selected row's", () => {
    const { cells } = makeTable();
    focusCell(cells[0]); // row 0 selected; its bottom is y=150
    rowAddButton()!.dispatchEvent(new MouseEvent("mouseenter"));

    const preview = addPreview()!;
    // Table bottom is y=200; the 10px bar straddles it.
    expect(preview.style.top).toBe("195px");
    // ...and it spans the full table width, not one row's cells.
    expect(preview.style.width).toBe("100px");
  });

  it("does not throw when the selected cell belongs to a different table", () => {
    const first = makeTable("a");
    focusCell(first.cells[0]);
    // A second table becomes the active one while table "a" keeps the selection.
    const second = makeTable("b");
    stubGrid(second.table, 400, 100);
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 425, clientY: 125, bubbles: true }),
    );

    expect(() => rowAddButton()!.dispatchEvent(new MouseEvent("mouseenter"))).not.toThrow();
    // The bar is measured against the active table, not the selected cell's.
    expect(addPreview()!.style.left).toBe("400px");
  });
});
