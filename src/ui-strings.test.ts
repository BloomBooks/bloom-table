import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { openCellMenu, removeTable, resetTableSizeButtons } from "./table-size-buttons";
import { registerCellContentType, unregisterCellContentType } from "./cell-contents";
import { resetTranslationsForTests, tableUiStrings, uiString } from "./ui-strings";
import { translateForTests } from "./test-support/translate-for-tests";
import { setGetLocalizations } from "./host-localization";

// The host translates the library's UI by handing over getLocalizations. These
// tests hand over translations that wrap every string in ⟦…⟧, walk every menu and
// every mode the library draws, and look for English that escaped them.

function stubGrid(table: HTMLElement, size = 50) {
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  cells.forEach((cell, i) => {
    const left = 100 + (i % 2) * size;
    const top = 100 + Math.floor(i / 2) * size;
    cell.getBoundingClientRect = () =>
      ({ left, top, right: left + size, bottom: top + size, width: size, height: size, x: left, y: top }) as DOMRect;
  });
  return cells;
}

// Column 0 has a fixed width in px, so the Column menu's Size control shows a px
// readout; the Row menu is switched to a fixed size in mm by the walk.
function makeTable(): { table: HTMLElement; cells: HTMLElement[] } {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="bloom-table" data-column-widths="90.4px,hug" data-row-heights="hug,hug">
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

// A picture or video cell has no editable child; the focus event is then the
// cell's own.
const focusCell = (cell: HTMLElement) =>
  (cell.querySelector<HTMLElement>("[contenteditable]") ?? cell).dispatchEvent(
    new FocusEvent("focusin", { bubbles: true }),
  );
const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const rightClick = (el: HTMLElement) =>
  el.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }),
  );
const pill = (kind: string) =>
  document.querySelector<HTMLElement>(`[data-btable-menu-pill="${kind}"]`)!;
const menuPopup = () => document.querySelector<HTMLElement>("[data-btable-menu]");
const closeAnyMenu = () =>
  document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
const byLabel = (label: string) => {
  const found = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!found) throw new Error(`Nothing on the page is labelled "${label}"`);
  return found;
};

const wrap = (english: string) => `⟦${english}⟧`;
const wrapped = (id: keyof typeof tableUiStrings) => wrap(tableUiStrings[id]);

// Every visible string, tooltip and accessible name on the page outside the
// tables' own content, that has Latin letters outside ⟦…⟧, with where it was.
// Icons are SVG markup, not text, so SVG subtrees and style sheets are skipped.
function englishThatEscaped(where: string): string[] {
  const found: string[] = [];
  const escaped = (text: string) => /[A-Za-z]/.test(text.replace(/⟦[^⟧]*⟧/g, ""));
  const describe = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    return role ? `${tag}[role=${role}]` : tag;
  };
  const visit = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "svg" || tag === "style" || tag === "script") return;
    if (el.classList.contains("bloom-table")) return;
    for (const attribute of ["title", "aria-label", "alt", "placeholder"]) {
      const value = el.getAttribute(attribute);
      if (value && escaped(value))
        found.push(`${where}: ${describe(el)} ${attribute}="${value}"`);
    }
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && escaped(node.textContent ?? ""))
        found.push(`${where}: ${describe(el)} text "${node.textContent?.trim()}"`);
    }
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(document.body);
  return found;
}

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
  resetTranslationsForTests();
  closeAnyMenu();
  resetTableSizeButtons();
  document.querySelectorAll<HTMLElement>(".bloom-table").forEach((t) => removeTable(t));
  (globalThis as any).requestAnimationFrame = (globalThis as any).__realRaf;
});

describe("the host's translations", () => {
  it("reach every string the pills, buttons, menus and badge show", async () => {
    const { cells } = makeTable();
    // The chrome exists before the translations arrive, as it does in a host whose
    // translations load after the tables are attached.
    focusCell(cells[0]);
    const idsSeen = new Set<string>();
    await translateForTests((english) => wrap(english), idsSeen);
    // Sanity check: the translations are in force, so a clean audit means something.
    expect(pill("row").getAttribute("aria-label")).toBe(wrapped("Pill.RowMenu"));

    const problems: string[] = [];
    const audit = (where: string) => problems.push(...englishThatEscaped(where));
    audit("pills and + buttons");

    // Each border tab shows its own caption, so the walk visits every tab.
    const visitEveryBorderTab = (where: string) => {
      for (const scope of ["all", "outer", "inner", "brush"]) {
        const tab = menuPopup()!.querySelector<HTMLButtonElement>(
          `[role="tab"][data-scope="${scope}"]`,
        )!;
        if (!tab.disabled) click(tab);
        audit(`${where}, ${scope} tab`);
      }
    };
    const openPillMenu = (kind: string, cell = cells[0]) => {
      closeAnyMenu();
      focusCell(cell);
      click(pill(kind));
      expect(menuPopup()).not.toBe(null);
    };
    const openCellMenu = (cell: HTMLElement) => {
      closeAnyMenu();
      focusCell(cell);
      rightClick(cell);
      expect(menuPopup()).not.toBe(null);
    };

    openPillMenu("row");
    audit("Row menu, Size hug");
    click(byLabel(wrapped("Size.Fixed")));
    audit("Row menu, Size fixed in mm");
    click(byLabel(wrapped("Size.Grow")));
    audit("Row menu, Size grow");
    visitEveryBorderTab("Row menu");

    openPillMenu("column");
    audit("Column menu, Size fixed in px");
    visitEveryBorderTab("Column menu");

    openPillMenu("table");
    visitEveryBorderTab("Table menu");

    openCellMenu(cells[0]);
    visitEveryBorderTab("Cell menu");

    // Each content type names the padding after what it surrounds.
    for (const type of ["Image", "Video", "Table"] as const) {
      click(byLabel(wrapped(`ContentType.${type}`)));
      openCellMenu(cells[0]);
      audit(`Cell menu on a ${type} cell`);
    }
    // A row whose cells hold different types names neither.
    openPillMenu("row", cells[1]);
    audit("Row menu over mixed content");

    openCellMenu(cells[1]);
    click(byLabel(wrapped("PaintFormat.Command")));
    expect(document.querySelector(".bloom-paint-format-badge")).not.toBe(null);
    audit("Paint format badge");

    expect(problems).toEqual([]);
    const idsNeverAsked = Object.keys(tableUiStrings).filter((id) => !idsSeen.has(id));
    expect(idsNeverAsked).toEqual([]);
    // Everything the library looks up is a catalog id.
    const notInCatalog = [...idsSeen].filter((id) => !(id in tableUiStrings));
    expect(notInCatalog).toEqual([]);
  });

  it("relabel the Paint format badge that is already showing", async () => {
    const { cells } = makeTable();
    focusCell(cells[0]);
    rightClick(cells[0]);
    click(byLabel(tableUiStrings["PaintFormat.Command"]));
    const badge = document.querySelector<HTMLElement>(".bloom-paint-format-badge")!;
    // Sanity check: English until the translations arrive.
    expect(badge.textContent).toBe("End format painting");

    await translateForTests((english) => wrap(english));

    expect(badge.textContent).toBe(wrapped("PaintFormat.End"));
    expect(badge.title).toBe(wrapped("PaintFormat.EndWithShortcut"));
    expect(badge.getAttribute("aria-label")).toBe(wrapped("PaintFormat.End"));
  });

  it("hold back the chrome and the Cell menu until they arrive", async () => {
    const { cells } = makeTable();
    let answer!: () => void;
    const arrived = setGetLocalizations(
      (strings) =>
        new Promise((resolve) => {
          answer = () =>
            resolve(Object.fromEntries(Object.entries(strings).map(([id, en]) => [id, wrap(en)])));
        }),
    );
    focusCell(cells[0]);
    // Sanity check: the chrome exists, so "hidden" below is the library holding it back.
    expect(pill("table")).not.toBe(null);
    expect(pill("table").style.display).toBe("none");
    expect(byLabel(tableUiStrings["AddButton.ColumnAtRightEdge"]).style.display).toBe("none");
    rightClick(cells[0]);
    expect(menuPopup()).toBe(null);

    answer();
    await arrived;

    // The pointer is still on the table, so the chrome shows, already translated.
    expect(pill("table").style.display).toBe("flex");
    expect(pill("table").title).toBe(wrapped("Pill.TableMenu"));
    expect(byLabel(wrapped("AddButton.ColumnAtRightEdge")).style.display).toBe("flex");
    rightClick(cells[0]);
    expect(menuPopup()).not.toBe(null);
    expect(englishThatEscaped("Cell menu")).toEqual([]);
  });

  it("hold back a Cell menu that the host opens itself", async () => {
    const { cells } = makeTable();
    let answer!: () => void;
    const arrived = setGetLocalizations(
      () => new Promise((resolve) => (answer = () => resolve({}))),
    );
    focusCell(cells[0]);
    openCellMenu(cells[0], { x: 120, y: 120 });
    expect(menuPopup()).toBe(null);

    answer();
    await arrived;
    openCellMenu(cells[0], { x: 120, y: 120 });
    expect(menuPopup()).not.toBe(null);
  });

  it("give way to the English when the host fails to answer, and the host hears of it", async () => {
    const { cells } = makeTable();
    const failure = new Error("no server");
    const arrived = setGetLocalizations(() => Promise.reject(failure));
    await expect(arrived).rejects.toBe(failure);

    focusCell(cells[0]);
    expect(pill("table").style.display).toBe("flex");
    expect(pill("table").title).toBe("Table menu");
  });

  it("have their placeholders filled afterwards, so a translation can move them", async () => {
    await translateForTests((english, id) => (id === "Format.CornerRadius" ? "Rayon {0} (coin)" : english));

    expect(uiString("Format.CornerRadius", 8)).toBe("Rayon 8 (coin)");
    expect(uiString("Units.Pixels", 12)).toBe("12px");
  });

  it("name a content type the host registered under ContentType.<its id>", async () => {
    registerCellContentType({
      id: "calendarPicture",
      englishName: "Calendar picture",
      icon: "",
      templateHtml: `<div class="calendar-picture"></div>`,
      regexToIdentify: /calendar-picture/,
    });
    try {
      const { cells } = makeTable();
      const asked: Array<[string, string]> = [];
      await translateForTests((english, id) => {
        asked.push([english, id]);
        return wrap(english);
      });
      focusCell(cells[0]);
      rightClick(cells[0]);

      expect(asked).toContainEqual(["Calendar picture", "ContentType.calendarPicture"]);
      // An option with no icon shows its name, and that is the translated name.
      expect(byLabel(wrap("Calendar picture")).textContent).toBe(wrap("Calendar picture"));
    } finally {
      unregisterCellContentType("calendarPicture");
    }
  });
});
