import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { removeTable, resetTableSizeButtons } from "./table-size-buttons";

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
    let written = "";
    // navigator.clipboard is a getter-only property in happy-dom.
    const previous = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          written = text;
          return Promise.resolve();
        },
      },
    });
    try {
      click(pill("table"));
      click(menuItem("Copy Table")!);
    } finally {
      delete (navigator as any).clipboard;
      if (previous) Object.defineProperty(Navigator.prototype, "clipboard", previous);
    }
    void table;
    return written;
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
