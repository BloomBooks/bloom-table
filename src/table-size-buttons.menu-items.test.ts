import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { exitPaintFormatMode, isPaintFormatModeActive, resetTableSizeButtons } from "./table-size-buttons";
import {
  applyBorderStyle,
  applyBorderWeight,
  applyContentType,
  copyProperties,
  getCellsInScope,
  hasCopiedProperties,
} from "./formatting-commands";
import { setCellCorners, setRowHeights, setColumnWidths, setCellBackground } from "./table-model";
import { installClipboardStub } from "./test-support/clipboard-stub";

// happy-dom gives every element a zero rect, and drag-to-resize reads a press in
// a zero-sized cell as a grab of its bottom edge. Give each cell a real box.
function stubRects(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".bloom-cell").forEach((cell, i) => {
    const left = 100 + (i % 2) * 50;
    const top = 100 + Math.floor(i / 2) * 50;
    cell.getBoundingClientRect = () =>
      ({
        left,
        top,
        right: left + 50,
        bottom: top + 50,
        width: 50,
        height: 50,
        x: left,
        y: top,
      }) as DOMRect;
  });
}

const byId = (): HTMLElement => document.getElementById("t") as HTMLElement;

const kTwoByTwo = `
  <div class="bloom-table" id="t" data-column-widths="hug,hug" data-row-heights="hug,hug">
    <div class="bloom-cell"><div contenteditable="true">r0c0</div></div>
    <div class="bloom-cell"><div contenteditable="true">r0c1</div></div>
    <div class="bloom-cell"><div contenteditable="true">r1c0</div></div>
    <div class="bloom-cell"><div contenteditable="true">r1c1</div></div>
  </div>`;

interface Fixture {
  target: HTMLElement;
  outer: HTMLElement | null;
  // Undo restores a top-level table by replacing its children, so a nested
  // table is a NEW element afterwards and the reference the test started with
  // is stale. Ask for the table again after every undo.
  resolve: () => HTMLElement;
}

function plainTable(): Fixture {
  document.body.innerHTML = kTwoByTwo;
  const target = document.getElementById("t") as HTMLElement;
  attachTable(target);
  stubRects(document);
  return { target, outer: null, resolve: byId };
}

// A 2x2 outer table whose first cell holds a 2x2 nested table. Every command in
// this file is aimed at the nested table; the outer one must come through it
// untouched.
function nestedTable(): Fixture {
  document.body.innerHTML = `
    <div class="bloom-table" id="outer" data-column-widths="hug,hug" data-row-heights="hug,hug">
      <div class="bloom-cell" data-content-type="table">${kTwoByTwo}</div>
      <div class="bloom-cell"><div contenteditable="true">o0c1</div></div>
      <div class="bloom-cell"><div contenteditable="true">o1c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">o1c1</div></div>
    </div>`;
  const outer = document.getElementById("outer") as HTMLElement;
  const target = document.getElementById("t") as HTMLElement;
  attachTable(outer);
  attachTable(target);
  stubRects(document);
  return { target, outer, resolve: byId };
}

function oneRow(): Fixture {
  document.body.innerHTML = `
    <div class="bloom-table" id="t" data-column-widths="hug,hug" data-row-heights="hug">
      <div class="bloom-cell"><div contenteditable="true">r0c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r0c1</div></div>
    </div>`;
  const target = document.getElementById("t") as HTMLElement;
  attachTable(target);
  stubRects(document);
  return { target, outer: null, resolve: byId };
}

function oneColumn(): Fixture {
  document.body.innerHTML = `
    <div class="bloom-table" id="t" data-column-widths="hug" data-row-heights="hug,hug">
      <div class="bloom-cell"><div contenteditable="true">r0c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c0</div></div>
    </div>`;
  const target = document.getElementById("t") as HTMLElement;
  attachTable(target);
  stubRects(document);
  return { target, outer: null, resolve: byId };
}

// ----- reading the model -----

const ownCells = (t: HTMLElement): HTMLElement[] =>
  Array.from(t.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );

const heights = (t: HTMLElement) => t.getAttribute("data-row-heights") ?? "";
const widths = (t: HTMLElement) => t.getAttribute("data-column-widths") ?? "";
const shape = (t: HTMLElement) => `${heights(t)}|${widths(t)}|${ownCells(t).length}`;
const texts = (t: HTMLElement) =>
  ownCells(t)
    .map((c) => (c.textContent ?? "").trim() || "-")
    .join(",");

// The attribute of the cells a scope covers, so a command's reach shows in the
// value: a row command must not touch the second row, nor a column command the
// second column.
const attrOf =
  (name: string, indexes: number[]) =>
  (t: HTMLElement): string =>
    indexes.map((i) => ownCells(t)[i]?.getAttribute(name) ?? "unset").join(",");

// One field of the first horizontal edge, which is cell (0,0)'s top border and
// so belongs to every scope in this file.
const edgeField =
  (field: "weight" | "style" | "color") =>
  (t: HTMLElement): string => {
    const raw = t.getAttribute("data-edges-h");
    if (!raw) return "unset";
    const spec = JSON.parse(raw)?.[0]?.[0];
    return spec && spec[field] !== undefined ? String(spec[field]) : "unset";
  };

// The table menu writes one default spec for the whole table instead of
// per-edge entries, so its border controls are read from there.
const defaultField =
  (field: "weight" | "style" | "color") =>
  (t: HTMLElement): string => {
    const raw = t.getAttribute("data-border-default");
    if (!raw) return "unset";
    const spec = JSON.parse(raw);
    return spec && spec[field] !== undefined ? String(spec[field]) : "unset";
  };

const borderField = (menu: Menu, field: "weight" | "style" | "color") =>
  menu === "table" ? defaultField(field) : edgeField(field);

const inDocument = (t: HTMLElement) => (document.body.contains(t) ? "in" : "out");

// ----- driving the popup -----

const menuPopup = () => document.querySelector<HTMLElement>("[data-btable-menu]");
const pill = (kind: string) => document.querySelector<HTMLElement>(`[data-btable-menu-pill="${kind}"]`)!;
const control = (label: string) => menuPopup()?.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? null;
const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const focusCell = (cell: HTMLElement) =>
  (cell.querySelector("[contenteditable]") ?? cell).dispatchEvent(
    new FocusEvent("focusin", { bubbles: true }),
  );

const setSlider = (el: HTMLElement, value: number) => {
  (el as HTMLInputElement).value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const setColor = (el: HTMLElement, value: string) => {
  (el as HTMLInputElement).value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

// ----- the data table -----

type Menu = "row" | "column" | "table";

interface MenuItemCase {
  menu: Menu;
  // The aria-label the popup renders for this item.
  label: string;
  // The cell to select before opening the pill, by index among the table's own
  // cells. The selection decides what a row or column command acts on.
  select?: number;
  // Model preparation. It runs before the test takes its history baseline, so
  // it may use the library's own commands as well as the plain writers.
  setup?: (t: HTMLElement) => void;
  // How the user works the control. A menu item is clicked; a slider and a
  // color input are driven instead.
  act?: (el: HTMLElement) => void;
  read: (t: HTMLElement, written: string[]) => string;
  // The model before the item runs. Omitted only where the state cannot be
  // restored between tests.
  before?: string;
  after: string;
  // What the model reads after one undo, when that differs from `before`.
  afterUndo?: string;
  // Undo entries the item must add.
  history: number;
  // What the same case expects of a nested table, where it differs. A nested
  // table converts a whole track to "fill" whenever its shape changes.
  nested?: { before?: string; after?: string };
  // When the item must render disabled, and how to put the fixture in that
  // state. null says the item is never disabled.
  disabledWhen: { reason: string; fixture?: () => Fixture; select?: number } | null;
}

// The cells one menu's commands reach, given the cell the case selects.
const scopeOf = (t: HTMLElement, menu: Menu, select: number): HTMLElement[] =>
  getCellsInScope(t, menu, ownCells(t)[select]);

// The Format rows are the same six controls in all three menus, applied to the
// cells of that menu's scope. `covers` names the cells the scope reaches in the
// 2x2 fixture, given the selection the case asks for.
function formatCases(menu: Menu, covers: number[], select: number): MenuItemCase[] {
  const cell = (name: string) => attrOf(name, covers);
  const base = { menu, select, history: 1, disabledWhen: null } as const;
  return [
    {
      ...base,
      label: "Left",
      read: cell("data-align"),
      before: covers.map(() => "unset").join(","),
      after: covers.map(() => "start").join(","),
    },
    {
      ...base,
      label: "Center",
      read: cell("data-align"),
      before: covers.map(() => "unset").join(","),
      after: covers.map(() => "center").join(","),
    },
    {
      ...base,
      label: "Right",
      read: cell("data-align"),
      before: covers.map(() => "unset").join(","),
      after: covers.map(() => "end").join(","),
    },
    {
      ...base,
      label: "Padding between border and text",
      act: (el) => setSlider(el, 12),
      read: cell("data-pad"),
      before: covers.map(() => "unset").join(","),
      after: covers.map(() => "12px").join(","),
    },
    {
      ...base,
      label: "Fill",
      act: (el) => setColor(el, "#ff0000"),
      read: cell("data-bg"),
      before: covers.map(() => "unset").join(","),
      after: covers.map(() => "#ff0000").join(","),
    },
    {
      ...base,
      label: "Border color",
      act: (el) => setColor(el, "#00ff00"),
      read: borderField(menu, "color"),
      before: "unset",
      after: "#00ff00",
    },
    ...(["None", "Solid", "Dashed", "Dotted", "Double"] as const).map((style) => {
      // The model already resolves to a solid 1px border, so a command that
      // asks for the value the table already has writes nothing. Start each
      // case from a different value.
      const from = style === "Dashed" ? "dotted" : "dashed";
      return {
        ...base,
        label: style,
        setup: (t: HTMLElement) => applyBorderStyle(t, menu, scopeOf(t, menu, select), from),
        read: borderField(menu, "style"),
        before: from,
        after: style.toLowerCase(),
      };
    }),
    ...([0, 1, 2, 4] as const).map((weight) => {
      // See the border styles above: a weight the table already carries is not
      // a change.
      const from = weight === 2 ? 4 : 2;
      return {
        ...base,
        label: weight === 0 ? "0 (None)" : String(weight),
        setup: (t: HTMLElement) => applyBorderWeight(t, menu, scopeOf(t, menu, select), from),
        read: borderField(menu, "weight"),
        before: String(from),
        after: String(weight),
      };
    }),
    ...([0, 4, 8, 16] as const).map((radius) => ({
      ...base,
      label: `Corner radius ${radius}`,
      // Radius 0 clears the attribute, so the fixture must carry a radius for
      // the command to have anything to clear.
      setup:
        radius === 0
          ? (t: HTMLElement) => covers.forEach((i) => setCellCorners(ownCells(t)[i], { radius: 8 }))
          : undefined,
      read: cell("data-corners"),
      before: covers.map(() => (radius === 0 ? '{"radius":8}' : "unset")).join(","),
      after: covers.map(() => (radius === 0 ? "unset" : `{"radius":${radius}}`)).join(","),
    })),
  ];
}

// The Content Type row, whose options are the registered types.
function contentTypeCases(menu: Menu, covers: number[], select: number): MenuItemCase[] {
  return (["Text", "Table", "Image", "Video"] as const).map((label) => ({
    menu,
    label,
    select,
    history: 1,
    disabledWhen: null,
    // Text is what an untyped cell already holds, so the fixture must carry
    // another type for the command to have anything to change.
    setup:
      label === "Text"
        ? (t: HTMLElement) => applyContentType(t, menu, scopeOf(t, menu, select), "image")
        : undefined,
    read: attrOf("data-content-type", covers),
    before: covers.map(() => (label === "Text" ? "image" : "unset")).join(","),
    after: covers.map(() => label.toLowerCase()).join(","),
  }));
}

const rowCases: MenuItemCase[] = [
  {
    menu: "row",
    label: "Add Row Above",
    read: shape,
    before: "hug,hug|hug,hug|4",
    after: "hug,hug,hug|hug,hug|6",
    nested: { after: "fill,fill,fill|hug,hug|6" },
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "row",
    label: "Add Row Below",
    read: shape,
    before: "hug,hug|hug,hug|4",
    after: "hug,hug,hug|hug,hug|6",
    nested: { after: "fill,fill,fill|hug,hug|6" },
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "row",
    label: "Move Row Up",
    select: 3,
    read: texts,
    before: "r0c0,r0c1,r1c0,r1c1",
    after: "r1c0,r1c1,r0c0,r0c1",
    history: 1,
    disabledWhen: { reason: "the selected cell is in the top row", select: 0 },
  },
  {
    menu: "row",
    label: "Move Row Down",
    read: texts,
    before: "r0c0,r0c1,r1c0,r1c1",
    after: "r1c0,r1c1,r0c0,r0c1",
    history: 1,
    disabledWhen: { reason: "the selected cell is in the bottom row", select: 3 },
  },
  {
    menu: "row",
    label: "Grow",
    read: heights,
    before: "hug,hug",
    after: "fill,hug",
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "row",
    label: "Hug",
    setup: (t) => setRowHeights(t, ["fill", "hug"]),
    read: heights,
    before: "fill,hug",
    after: "hug,hug",
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "row",
    label: "Fixed size",
    read: heights,
    before: "hug,hug",
    after: "10mm,hug",
    history: 1,
    disabledWhen: null,
  },
  ...contentTypeCases("row", [0, 1], 0),
  ...formatCases("row", [0, 1], 0),
  {
    menu: "row",
    label: "Paint format",
    // Paint format arms a mode; the table changes only when the user clicks a
    // cell afterwards, so there is nothing to undo yet.
    read: () => String(isPaintFormatModeActive()),
    before: "false",
    after: "true",
    history: 0,
    disabledWhen: null,
  },
  {
    menu: "row",
    label: "Duplicate Row",
    read: (t) => `${texts(t)}|${heights(t)}`,
    before: "r0c0,r0c1,r1c0,r1c1|hug,hug",
    after: "r0c0,r0c1,r0c0,r0c1,r1c0,r1c1|hug,hug,hug",
    nested: { after: "r0c0,r0c1,r0c0,r0c1,r1c0,r1c1|fill,fill,fill" },
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "row",
    label: "Delete Row",
    read: (t) => `${texts(t)}|${heights(t)}`,
    before: "r0c0,r0c1,r1c0,r1c1|hug,hug",
    after: "r1c0,r1c1|hug",
    history: 1,
    disabledWhen: { reason: "the table has one row left", fixture: oneRow },
  },
];

const columnCases: MenuItemCase[] = [
  {
    menu: "column",
    label: "Add Column Left",
    read: shape,
    before: "hug,hug|hug,hug|4",
    after: "hug,hug|hug,hug,hug|6",
    nested: { after: "hug,hug|fill,fill,fill|6" },
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "column",
    label: "Add Column Right",
    read: shape,
    before: "hug,hug|hug,hug|4",
    after: "hug,hug|hug,hug,hug|6",
    nested: { after: "hug,hug|fill,fill,fill|6" },
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "column",
    label: "Move Left",
    select: 3,
    read: texts,
    before: "r0c0,r0c1,r1c0,r1c1",
    after: "r0c1,r0c0,r1c1,r1c0",
    history: 1,
    disabledWhen: { reason: "the selected cell is in the first column", select: 0 },
  },
  {
    menu: "column",
    label: "Move Right",
    read: texts,
    before: "r0c0,r0c1,r1c0,r1c1",
    after: "r0c1,r0c0,r1c1,r1c0",
    history: 1,
    disabledWhen: { reason: "the selected cell is in the last column", select: 3 },
  },
  {
    menu: "column",
    label: "Grow",
    read: widths,
    before: "hug,hug",
    after: "fill,hug",
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "column",
    label: "Hug",
    setup: (t) => setColumnWidths(t, ["fill", "hug"]),
    read: widths,
    before: "fill,hug",
    after: "hug,hug",
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "column",
    label: "Fixed size",
    read: widths,
    before: "hug,hug",
    after: "10mm,hug",
    history: 1,
    disabledWhen: null,
  },
  ...contentTypeCases("column", [0, 2], 0),
  ...formatCases("column", [0, 2], 0),
  {
    menu: "column",
    label: "Paint format",
    read: () => String(isPaintFormatModeActive()),
    before: "false",
    after: "true",
    history: 0,
    disabledWhen: null,
  },
  {
    menu: "column",
    label: "Duplicate Column",
    read: (t) => `${texts(t)}|${widths(t)}`,
    before: "r0c0,r0c1,r1c0,r1c1|hug,hug",
    after: "r0c0,r0c0,r0c1,r1c0,r1c0,r1c1|hug,hug,hug",
    nested: { after: "r0c0,r0c0,r0c1,r1c0,r1c0,r1c1|fill,fill,fill" },
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "column",
    label: "Delete Column",
    read: (t) => `${texts(t)}|${widths(t)}`,
    before: "r0c0,r0c1,r1c0,r1c1|hug,hug",
    after: "r0c1,r1c1|hug",
    history: 1,
    disabledWhen: { reason: "the table has one column left", fixture: oneColumn },
  },
];

const tableCases: MenuItemCase[] = [
  ...contentTypeCases("table", [0, 1, 2, 3], 0),
  ...formatCases("table", [0, 1, 2, 3], 0),
  {
    menu: "table",
    label: "Horizontal space between cells",
    act: (el) => setSlider(el, 12),
    read: (t) => t.getAttribute("data-gap-x") ?? "unset",
    before: "unset",
    after: "12px",
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "table",
    label: "Vertical space between cells",
    act: (el) => setSlider(el, 12),
    read: (t) => t.getAttribute("data-gap-y") ?? "unset",
    before: "unset",
    after: "12px",
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "table",
    label: "Copy properties",
    // Nothing can un-copy the properties, so no test can see the empty
    // clipboard again once another test has filled it. Hence no `before`.
    read: () => String(hasCopiedProperties()),
    after: "true",
    history: 0,
    disabledWhen: null,
  },
  {
    menu: "table",
    label: "Paste properties",
    setup: () => {
      const donor = document.createElement("div");
      donor.className = "bloom-cell";
      setCellBackground(donor, "#0a0b0c");
      copyProperties([donor]);
    },
    read: attrOf("data-bg", [0, 1, 2, 3]),
    before: "unset,unset,unset,unset",
    after: "#0a0b0c,#0a0b0c,#0a0b0c,#0a0b0c",
    history: 1,
    disabledWhen: { reason: "nothing has been copied yet" },
  },
  {
    menu: "table",
    label: "Copy Table",
    read: (_t, written) => String(written.length),
    before: "0",
    after: "1",
    history: 0,
    disabledWhen: null,
  },
  {
    menu: "table",
    label: "Cut Table",
    read: (t, written) => `${written.length}/${inDocument(t)}`,
    before: "0/in",
    after: "1/out",
    afterUndo: "1/in",
    history: 1,
    disabledWhen: null,
  },
  {
    menu: "table",
    label: "Delete Table",
    read: (t) => inDocument(t),
    before: "in",
    after: "out",
    history: 1,
    disabledWhen: null,
  },
];

const cases: MenuItemCase[] = [...rowCases, ...columnCases, ...tableCases];

// The two gap sliders write the model without opening a history entry, so they
// cannot be undone. See the it.fails tests below.
const kNotUndoable = new Set(["Horizontal space between cells", "Vertical space between cells"]);

// ----- the runner -----

function runCase(c: MenuItemCase, fixture: Fixture): void {
  const { target, outer } = fixture;
  const expected = { ...c, ...(outer ? c.nested : undefined) };
  const stub = installClipboardStub();
  try {
    c.setup?.(target);
    const cell = ownCells(target)[c.select ?? 0];
    focusCell(cell);

    const outerBefore = outer ? snapshotOuter(outer) : null;
    if (expected.before !== undefined)
      expect(c.read(target, stub.written), "the fixture").toBe(expected.before);
    const entriesBefore = tableHistoryManager.getEntriesForDebug().length;

    click(pill(c.menu));
    const el = control(c.label);
    expect(el, `the ${c.menu} menu offers "${c.label}"`).not.toBe(null);
    expect((el as HTMLButtonElement).disabled ?? false).toBe(false);
    (c.act ?? click)(el!);

    expect(c.read(target, stub.written)).toBe(expected.after);
    expect(tableHistoryManager.getEntriesForDebug().length - entriesBefore).toBe(c.history);

    if (c.history > 0) {
      // Every entry belongs to the top-level table, and a removed nested table
      // can no longer name its own, so undo goes through the outer one.
      expect(tableHistoryManager.undo(outer ?? target)).toBe(true);
      expect(c.read(fixture.resolve(), stub.written)).toBe(c.afterUndo ?? expected.before);
    }
    if (outerBefore) expect(snapshotOuter(outer!)).toBe(outerBefore);
  } finally {
    stub.restore();
  }
}

// The outer table's own model: its data attributes and how many cells it holds.
// A command aimed at the nested table must leave all of it alone.
const snapshotOuter = (outer: HTMLElement): string =>
  [
    ...Array.from(outer.attributes)
      .filter((a) => a.name.startsWith("data-"))
      .map((a) => `${a.name}=${a.value}`)
      .sort(),
    `cells=${ownCells(outer).length}`,
  ].join(" ");

beforeEach(() => {
  tableHistoryManager.reset();
  document.body.innerHTML = "";
  resetTableSizeButtons();
});

afterEach(() => {
  exitPaintFormatMode();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
});

// This must run before any test copies properties: nothing puts the property
// clipboard back to empty, so the disabled state exists only once per file.
describe("Paste properties before anything has been copied", () => {
  it("renders disabled, because there is nothing to paste", () => {
    const { target } = plainTable();
    focusCell(ownCells(target)[0]);

    click(pill("table"));

    expect((control("Paste properties") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("every item of the Row, Column and Table menus, on a top-level table", () => {
  it.each(cases.filter((c) => !kNotUndoable.has(c.label)))(
    "$menu menu: $label changes the model, in one undoable step",
    (c) => runCase(c, plainTable()),
  );

  it.fails("the Horizontal space slider adds an undo entry, like every other item", () => {
    runCase(
      cases.find((c) => c.label === "Horizontal space between cells")!,
      plainTable(),
    );
  });

  it.fails("the Vertical space slider adds an undo entry, like every other item", () => {
    runCase(
      cases.find((c) => c.label === "Vertical space between cells")!,
      plainTable(),
    );
  });
});

describe("every item of the Row, Column and Table menus, on a nested table", () => {
  it.each(cases.filter((c) => !kNotUndoable.has(c.label)))(
    "$menu menu: $label changes the nested table and leaves the outer one alone",
    (c) => runCase(c, nestedTable()),
  );
});

describe("the items that render disabled", () => {
  // Paste properties has its own test at the top of this file, which is the
  // only place that can still see the empty property clipboard.
  it.each(cases.filter((c) => c.disabledWhen && c.label !== "Paste properties"))(
    "$menu menu: $label is disabled when $disabledWhen.reason",
    (c) => {
      const { target } = (c.disabledWhen!.fixture ?? plainTable)();
      focusCell(ownCells(target)[c.disabledWhen!.select ?? 0]);

      click(pill(c.menu));

      expect((control(c.label) as HTMLButtonElement).disabled).toBe(true);
    },
  );
});

describe("the menus offer exactly the items this file describes", () => {
  it.each(["row", "column", "table"] as Menu[])(
    "the %s menu renders no item that has no case here",
    (menu) => {
      const { target } = plainTable();
      focusCell(ownCells(target)[0]);

      click(pill(menu));

      const rendered = Array.from(menuPopup()!.querySelectorAll("[aria-label]"))
        .map((el) => el.getAttribute("aria-label")!)
        .sort();
      const described = cases
        .filter((c) => c.menu === menu)
        .map((c) => c.label)
        .sort();
      expect(rendered).toEqual(described);
    },
  );
});
