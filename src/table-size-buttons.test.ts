import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import {
  getCellMenuItems,
  openCellMenu,
  removeTable,
  resetTableSizeButtons,
} from "./table-size-buttons";
import { setStructuralChromeGate } from "./structural-chrome";
import { setCellMenuItemFilter, setCellMenuOpenHandler } from "./cell-menu-host";
import { getCurrentContentTypeId } from "./cell-contents";
import { withClipboardStub } from "./test-support/clipboard-stub";
import type { CellMenuChoice, CellMenuCommand } from "./cell-menu-model";

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
  document.querySelector<HTMLElement>('button[aria-label="Add row at the bottom edge"]');

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
      document.querySelectorAll('button[aria-label="Add row at the bottom edge"]').length,
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

// A row of any of the menus. The row, column and table sections build DOM buttons;
// the Cell section's rows come from the CellMenuItems React component, which renders
// MUI menu items, so this matches on the label rather than on the element.
const menuItem = (label: string) =>
  menuPopup()?.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? null;

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
      .querySelector<HTMLElement>('button[aria-label="Add column at the right edge"]')!
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

describe("Delete Table is one undoable operation", () => {
  // A 1x2 outer table whose first cell hosts a 1x2 table.
  function makeNested(): { outer: HTMLElement; nested: HTMLElement } {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="bloom-table" id="outer" data-column-widths="hug,hug" data-row-heights="hug">
        <div class="bloom-cell" data-content-type="table">
          <div class="bloom-table" id="nested" data-column-widths="hug,hug" data-row-heights="hug">
            <div class="bloom-cell" data-content-type="text"><div contenteditable="true">n1</div></div>
            <div class="bloom-cell" data-content-type="text"><div contenteditable="true">n2</div></div>
          </div>
        </div>
        <div class="bloom-cell" data-content-type="text"><div contenteditable="true">outer</div></div>
      </div>`;
    const outer = wrapper.firstElementChild as HTMLElement;
    document.body.appendChild(outer);
    attachTable(outer);
    const nested = outer.querySelector<HTMLElement>("#nested")!;
    attachTable(nested);
    stubGrid(outer);
    stubGrid(nested);
    return { outer, nested };
  }

  it("turns a deleted nested table's host cell into a text cell, and undo brings both back", () => {
    const { outer, nested } = makeNested();
    const host = outer.children[0] as HTMLElement;

    removeTable(nested);

    // The nested table is gone and its host cell holds ordinary text again.
    expect(outer.querySelector("#nested")).toBe(null);
    expect(host.dataset.contentType).toBe("text");
    expect(host.querySelector("[contenteditable]")).not.toBe(null);
    expect(host.hasAttribute("tabindex")).toBe(false);

    // ONE undo restores the table AND the host cell's content type.
    expect(tableHistoryManager.undoLast()).toBe(true);
    const restored = outer.querySelector<HTMLElement>("#nested");
    expect(restored).not.toBe(null);
    expect((outer.children[0] as HTMLElement).dataset.contentType).toBe("table");
    expect(Array.from(restored!.querySelectorAll(".bloom-cell")).map((c) => c.textContent?.trim())).toEqual(
      ["n1", "n2"],
    );
  });

  it("takes a top-level table out of the document, and undo puts it back where it was", () => {
    const { outer } = makeNested();
    const previousSibling = outer.previousSibling;
    const nextSibling = outer.nextSibling;

    removeTable(outer);
    expect(document.body.contains(outer)).toBe(false);

    expect(tableHistoryManager.undoLast()).toBe(true);
    expect(document.body.contains(outer)).toBe(true);
    // Back in its old position, between the very nodes it sat between.
    expect(outer.previousSibling).toBe(previousSibling);
    expect(outer.nextSibling).toBe(nextSibling);
    expect(outer.querySelector("#nested")).not.toBe(null);

    // And redo takes it out again.
    expect(tableHistoryManager.redoLast()).toBe(true);
    expect(document.body.contains(outer)).toBe(false);
  });
});

describe("Copy Table and Cut Table put the SAVE form on the clipboard", () => {
  // The clipboard text of the table menu's Copy Table command.
  function copyTableText(table: HTMLElement): string {
    const written = withClipboardStub(() => {
      click(pill("table"));
      click(menuItem("Copy Table")!);
    });
    void table;
    return written[written.length - 1] ?? "";
  }

  it("carries none of the edit-time classes of a selected, current, pointer-near table", () => {
    const { table, cells } = makeTable();
    focusCell(cells[0]);
    // The three classes the editing chrome writes on the live element, plus the
    // per-cell selection class focus already put on cells[0].
    table.classList.add("table--selected", "bloom-pointer-near", "bloom-current-table");
    cells[0].classList.add("cell--selected");

    const text = copyTableText(table);

    expect(text).toContain("bloom-table");
    expect(text).not.toContain("table--selected");
    expect(text).not.toContain("bloom-pointer-near");
    expect(text).not.toContain("bloom-current-table");
    expect(text).not.toContain("cell--selected");
    expect(text).not.toContain("data-table-overlay");
    expect(text).not.toContain("anchor-name");

    // The live table keeps every one of them: the stripping ran on a copy.
    expect(table.classList.contains("table--selected")).toBe(true);
    expect(table.classList.contains("bloom-pointer-near")).toBe(true);
    expect(table.classList.contains("bloom-current-table")).toBe(true);
    expect(cells[0].classList.contains("cell--selected")).toBe(true);
  });
});

describe("Delete Row and Delete Column on a table with one line", () => {
  // A table of one row and one column, so both commands would remove the last
  // line. structure.ts asserts against that, and the assert is swallowed, so
  // the menu item has to say so instead.
  function makeOneCellTable(): { table: HTMLElement; cell: HTMLElement } {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="bloom-table" id="one" data-column-widths="hug" data-row-heights="hug">
        <div class="bloom-cell"><div contenteditable="true">only</div></div>
      </div>`;
    const table = wrapper.firstElementChild as HTMLElement;
    document.body.appendChild(table);
    attachTable(table);
    const cell = table.querySelector<HTMLElement>(".bloom-cell")!;
    cell.getBoundingClientRect = () =>
      ({ left: 100, top: 100, right: 150, bottom: 150, width: 50, height: 50, x: 100, y: 100 }) as DOMRect;
    return { table, cell };
  }

  it("renders Delete Row disabled on a one-row table", () => {
    const { cell } = makeOneCellTable();
    focusCell(cell);

    click(pill("row"));
    const item = menuItem("Delete Row")!;

    expect((item as HTMLButtonElement).disabled).toBe(true);
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });

  it("renders Delete Column disabled on a one-column table", () => {
    const { cell } = makeOneCellTable();
    focusCell(cell);

    click(pill("column"));
    const item = menuItem("Delete Column")!;

    expect((item as HTMLButtonElement).disabled).toBe(true);
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });

  it("leaves both enabled on a 2x2 table", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);

    click(pill("row"));
    expect((menuItem("Delete Row") as HTMLButtonElement).disabled).toBe(false);
    click(pill("column"));
    expect((menuItem("Delete Column") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("the host's structural chrome gate", () => {
  const cluster = (kind: string) =>
    document.querySelector<HTMLElement>(`[data-overlay-cluster="${kind}"]`)!;

  const columnAddButton = () =>
    document.querySelector<HTMLElement>('button[aria-label="Add column at the right edge"]');

  // Everything the gate is allowed to withhold, in one list, so a test can say
  // "all of it" and "none of it" without naming the pieces twice.
  const structuralChrome = () => [
    cluster("row"),
    cluster("column"),
    tablePills()[0],
    rowAddButton()!,
    columnAddButton()!,
  ];

  const visible = () => structuralChrome().filter((el) => el.style.display !== "none").length;

  afterEach(() => setStructuralChromeGate(undefined));

  it("shows all of it when no gate is installed", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);

    expect(visible()).toBe(structuralChrome().length);
  });

  it("withholds all of it from a table the gate refuses", () => {
    const { table, cells } = makeTable();
    setStructuralChromeGate((t) => !t.hasAttribute("data-fixed-shape"));
    table.setAttribute("data-fixed-shape", "");
    focusCell(cells[0]);

    expect(visible()).toBe(0);
  });

  it("still marks the refused table as the one the pointer is near, so its cell selection shows", () => {
    const { table, cells } = makeTable();
    setStructuralChromeGate(() => false);
    focusCell(cells[0]);

    // Sanity check that the chrome really is gone, so the class below is not
    // just the "nothing happened at all" case.
    expect(visible()).toBe(0);
    expect(table.classList.contains("bloom-pointer-near")).toBe(true);
  });

  it("keeps the chrome away across a reposition, which re-decides visibility", () => {
    const { table, cells } = makeTable();
    setStructuralChromeGate(() => false);
    focusCell(cells[0]);
    expect(visible()).toBe(0);

    stubGrid(table, 100, 60);
    window.dispatchEvent(new Event("scroll"));

    expect(visible()).toBe(0);
  });

  it("asks per table, so a plain table beside a refused one keeps its chrome", () => {
    const calendarish = makeTable("fixed");
    calendarish.table.setAttribute("data-fixed-shape", "");
    const plain = makeTable("plain");
    setStructuralChromeGate((t) => !t.hasAttribute("data-fixed-shape"));

    focusCell(calendarish.cells[0]);
    expect(visible()).toBe(0);

    focusCell(plain.cells[0]);
    expect(visible()).toBe(structuralChrome().length);
  });

  it("leaves the Cell menu alone: a right-click on a refused table still opens it", () => {
    const { table, cells } = makeTable();
    setStructuralChromeGate(() => false);
    table.setAttribute("data-fixed-shape", "");
    focusCell(cells[0]);

    cells[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 120, clientY: 120 }));

    expect(menuPopup()).not.toBe(null);
    expect(menuPopup()!.getAttribute("data-btable-menu")).toBe("cell");
  });
});

describe("the host's Cell menu item filter", () => {
  const rightClick = (el: HTMLElement) =>
    el.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }),
    );

  // The Content Type row's buttons carry the type id; the other parts are named
  // by their header or their command.
  const contentTypeIds = () =>
    Array.from(menuPopup()?.querySelectorAll<HTMLElement>("[data-ct-id]") ?? []).map(
      (b) => b.dataset.ctId,
    );
  const menuText = () => (menuPopup()?.textContent || "").replace(/\s+/g, " ").trim();

  const openCellMenuOn = (cell: HTMLElement) => {
    focusCell(cell);
    rightClick(cell);
    // Sanity check: every assertion below reads this popup.
    expect(menuPopup()).not.toBe(null);
  };

  // What Bloom's calendar grid keeps: the Content Type row, with two types.
  const kCalendarItems = ["contentType", "contentType:text", "contentType:image"];

  afterEach(() => setCellMenuItemFilter(undefined));

  it("offers the whole menu when no filter is installed", () => {
    const { cells } = makeTable();
    openCellMenuOn(cells[0]);

    expect(contentTypeIds().length).toBeGreaterThan(2);
    expect(menuText()).toContain("Format");
    expect(menuItem("Paint format")).not.toBe(null);
    expect(menuItem("Merge with cell to the right")).not.toBe(null);
    expect(menuItem("Split")).not.toBe(null);
  });

  it("reduces the menu to the Content Type row for a table the filter names", () => {
    const { table, cells } = makeTable();
    table.setAttribute("data-fixed-shape", "");
    setCellMenuItemFilter((itemId, _cell, t) =>
      t?.hasAttribute("data-fixed-shape") ? kCalendarItems.includes(itemId) : true,
    );

    openCellMenuOn(cells[0]);

    expect(contentTypeIds()).toEqual(["text", "image"]);
    // A refused section takes its header and its divider with it.
    expect(menuText()).not.toContain("Format");
    expect(menuItem("Paint format")).toBe(null);
    expect(menuItem("Merge with cell to the right")).toBe(null);
    expect(menuItem("Split")).toBe(null);
  });

  it("asks per table, so a plain table beside a reduced one keeps the whole menu", () => {
    const reduced = makeTable("fixed");
    reduced.table.setAttribute("data-fixed-shape", "");
    const plain = makeTable("plain");
    setCellMenuItemFilter((itemId, _cell, t) =>
      t?.hasAttribute("data-fixed-shape") ? kCalendarItems.includes(itemId) : true,
    );

    openCellMenuOn(reduced.cells[0]);
    expect(menuItem("Merge with cell to the right")).toBe(null);

    openCellMenuOn(plain.cells[0]);
    expect(menuItem("Merge with cell to the right")).not.toBe(null);
    expect(menuText()).toContain("Format");
  });

  it("refuses one item at a time, leaving its neighbours in place", () => {
    const { cells } = makeTable();
    setCellMenuItemFilter((itemId) => itemId !== "split" && itemId !== "contentType:image");

    openCellMenuOn(cells[0]);

    expect(contentTypeIds()).not.toContain("image");
    expect(contentTypeIds()).toContain("text");
    expect(menuItem("Split")).toBe(null);
    expect(menuItem("Merge with cell to the right")).not.toBe(null);
    expect(menuText()).toContain("Format");
  });

  it("asks about the cell the menu acts on, so one cell can offer less than its neighbour", () => {
    const { cells } = makeTable();
    cells[1].setAttribute("data-locked", "");
    setCellMenuItemFilter((itemId, cell) =>
      cell?.hasAttribute("data-locked") ? kCalendarItems.includes(itemId) : true,
    );

    openCellMenuOn(cells[0]);
    expect(menuItem("Split")).not.toBe(null);

    openCellMenuOn(cells[1]);
    expect(menuItem("Split")).toBe(null);
  });

  it("gives the same reduced menu to openCellMenu, which is the host's toolbar route", () => {
    const { table, cells } = makeTable();
    table.setAttribute("data-fixed-shape", "");
    setCellMenuItemFilter((itemId) => kCalendarItems.includes(itemId));

    expect(openCellMenu(cells[0], { x: 400, y: 30 })).toBe(true);

    expect(menuPopup()).not.toBe(null);
    expect(menuPopup()!.getAttribute("data-btable-menu")).toBe("cell");
    expect(contentTypeIds()).toEqual(["text", "image"]);
    expect(menuItem("Split")).toBe(null);
  });
});

describe("the Cell menu as data", () => {
  const rightClick = (el: HTMLElement) =>
    el.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }),
    );
  // What the popup shows, in its own terms: the Content Type buttons by type id,
  // and the command rows by their label.
  const popupContentTypeIds = () =>
    Array.from(menuPopup()?.querySelectorAll<HTMLElement>("[data-ct-id]") ?? []).map(
      (b) => b.dataset.ctId,
    );
  const popupCommandLabels = () =>
    Array.from(menuPopup()?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []).map((b) =>
      b.getAttribute("aria-label"),
    );

  // Pick one item out of the model, failing the test where it is missing rather
  // than several lines later.
  const choiceOf = (cell: HTMLElement): CellMenuChoice => {
    const item = getCellMenuItems(cell).find((i) => i.kind === "choice");
    if (item?.kind !== "choice") throw new Error("the model offers no choice row");
    return item;
  };
  const commandOf = (cell: HTMLElement, id: string): CellMenuCommand => {
    const item = getCellMenuItems(cell).find((i) => i.kind === "command" && i.id === id);
    if (item?.kind !== "command") throw new Error(`the model offers no ${id} command`);
    return item;
  };

  afterEach(() => {
    setCellMenuItemFilter(undefined);
    setCellMenuOpenHandler(undefined);
  });

  it("offers the same things the popup shows", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);
    rightClick(cells[0]);
    // Sanity check: there is a popup to compare against.
    expect(menuPopup()).not.toBe(null);

    const items = getCellMenuItems(cells[0]);

    expect(choiceOf(cells[0]).options.map((o) => o.id)).toEqual(popupContentTypeIds());
    expect(items.filter((i) => i.kind === "command").map((i) => i.label)).toEqual(
      popupCommandLabels(),
    );
    // The Format rows stay the popup's own, so the model says only that the
    // section belongs here.
    expect(items.some((i) => i.kind === "formatControls")).toBe(true);
  });

  it("says which content type the cell is on, and its options change it", () => {
    const { cells } = makeTable();
    const cell = cells[0];
    // Sanity check: a fresh cell holds text, so a later "image" is a real change.
    expect(getCurrentContentTypeId(cell)).toBe("text");
    const options = choiceOf(cell).options;
    expect(options.find((o) => o.chosen)?.id).toBe("text");

    options.find((o) => o.id === "image")!.choose();

    expect(getCurrentContentTypeId(cell)).toBe("image");
    expect(choiceOf(cell).options.find((o) => o.chosen)?.id).toBe("image");
  });

  it("carries the icon and the toggle-row presentation the popup draws", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);
    rightClick(cells[0]);
    const choice = choiceOf(cells[0]);

    expect(choice.presentation).toBe("iconToggleRow");
    // A host that draws its own row needs an icon for every option, or its row
    // falls back to words and stops looking like this one.
    expect(choice.options.every((o) => !!o.icon)).toBe(true);
    // Sanity check: the popup's own buttons are drawn from those same icons, so
    // an option with an icon shows one rather than an empty button.
    const buttons = Array.from(menuPopup()!.querySelectorAll<HTMLElement>("[data-ct-id]"));
    expect(buttons.length).toBe(choice.options.length);
    expect(buttons.every((b) => b.childElementCount > 0 || !!b.innerHTML)).toBe(true);
  });

  it("is filtered by the same host filter the popup obeys", () => {
    const { table, cells } = makeTable();
    table.setAttribute("data-fixed-shape", "");
    setCellMenuItemFilter((itemId, _cell, t) =>
      t?.hasAttribute("data-fixed-shape")
        ? ["contentType", "contentType:text", "contentType:image"].includes(itemId)
        : true,
    );

    const items = getCellMenuItems(cells[0]);

    expect(items.map((i) => i.kind)).toEqual(["choice"]);
    expect(choiceOf(cells[0]).options.map((o) => o.id)).toEqual(["text", "image"]);
  });

  it("acts on the cell it was asked about, not on the selected one", () => {
    const { cells } = makeTable();
    // Selecting one cell and asking about another is the host's case: it renders
    // the menu itself, so nothing has put the popup's target cell in place.
    focusCell(cells[0]);
    const merge = commandOf(cells[2], "merge");
    // Sanity check: neither cell spans anything yet.
    expect(cells[0].getAttribute("data-span-x")).toBe(null);
    expect(cells[2].getAttribute("data-span-x")).toBe(null);

    merge.invoke();

    expect(cells[2].getAttribute("data-span-x")).toBe("2");
    expect(cells[0].getAttribute("data-span-x")).toBe(null);
  });

  it("disables a command that cannot act here", () => {
    const { cells } = makeTable();

    // Nothing is spanned, so Split has nothing to reduce, but Merge can still
    // take the cell to the right.
    expect(commandOf(cells[0], "split").enabled).toBe(false);
    expect(commandOf(cells[0], "merge").enabled).toBe(true);
  });
});

describe("the host's chance to open a cell's menu itself", () => {
  const rightClick = (el: HTMLElement) =>
    el.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }),
    );

  afterEach(() => setCellMenuOpenHandler(undefined));

  it("opens the library's menu when no handler is installed", () => {
    const { cells } = makeTable();
    focusCell(cells[0]);
    rightClick(cells[0]);

    expect(menuPopup()).not.toBe(null);
  });

  it("opens nothing when the handler says it took the cell", () => {
    const { table, cells } = makeTable();
    const asked: { cell: HTMLElement; table: HTMLElement; x: number; y: number }[] = [];
    setCellMenuOpenHandler((cell, t, position) => {
      asked.push({ cell, table: t, x: position.x, y: position.y });
      return true;
    });
    focusCell(cells[0]);
    rightClick(cells[0]);

    expect(menuPopup()).toBe(null);
    // The handler is told everything it needs to put a menu of its own here.
    expect(asked).toEqual([{ cell: cells[0], table, x: 120, y: 120 }]);
  });

  it("leaves the menu to the library when the handler declines", () => {
    const { cells } = makeTable();
    setCellMenuOpenHandler(() => false);
    focusCell(cells[0]);
    rightClick(cells[0]);

    expect(menuPopup()).not.toBe(null);
    expect(menuPopup()!.getAttribute("data-btable-menu")).toBe("cell");
  });

  it("is not asked about a right-click that is not on a cell", () => {
    makeTable();
    let asked = 0;
    setCellMenuOpenHandler(() => {
      asked++;
      return true;
    });
    document.body.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
    );

    expect(asked).toBe(0);
  });
});
