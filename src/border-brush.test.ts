import { describe, it, expect, beforeEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";
import {
  edgeAtPoint,
  enterBorderBrushMode,
  exitBorderBrushMode,
  isBorderBrushModeActive,
  updateBorderBrush,
  kBrushBandPx,
} from "./border-brush";
import { removeTableEditingArtifacts } from "./prepare-for-save";

function makeTable(): { table: HTMLElement; cells: HTMLElement[] } {
  document.body.innerHTML = `
    <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
      <div class="bloom-cell"><div contenteditable="true">r0c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r0c1</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c1</div></div>
    </div>`;
  const table = document.querySelector(".bloom-table") as HTMLElement;
  attachTable(table);
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  return { table, cells };
}

// happy-dom gives every element a zero rect, and the hit test measures the
// cell's own rect, so the cells need one. A 2x2 grid of 50px cells filling
// [100,100]..[200,200].
function stubCellRects(cells: HTMLElement[]): void {
  cells.forEach((cell, i) => {
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

// A cell whose rect is [0,0]..[100,60], for the pure hit-test cases.
function stubbedCell(): HTMLElement {
  const cell = document.createElement("div");
  cell.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 60,
      width: 100,
      height: 60,
      x: 0,
      y: 0,
    }) as DOMRect;
  return cell;
}

const pointerAt = (el: HTMLElement, type: string, x: number, y: number, button = 0) =>
  el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button,
      clientX: x,
      clientY: y,
    }),
  );

const previews = () =>
  document.querySelectorAll('[data-table-overlay="border-brush-preview"]');

const kBrush = { style: "dotted", weight: 2, color: "#ff0000" } as const;

beforeEach(() => {
  exitBorderBrushMode();
  tableHistoryManager.reset();
  document.body.innerHTML = "";
  resetTableSizeButtons();
});

describe("edgeAtPoint", () => {
  it("names the side whose band holds the point", () => {
    const cell = stubbedCell();
    expect(edgeAtPoint(cell, 50, 2)).toBe("top");
    expect(edgeAtPoint(cell, 50, 58)).toBe("bottom");
    expect(edgeAtPoint(cell, 2, 30)).toBe("left");
    expect(edgeAtPoint(cell, 98, 30)).toBe("right");
  });

  it("gives ties to top over bottom and left over right", () => {
    // A cell 2 bands tall: the midline is the same distance from top and
    // bottom, and both are inside the band.
    const flat = document.createElement("div");
    const h = kBrushBandPx * 2;
    flat.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 400, bottom: h, width: 400, height: h, x: 0, y: 0 }) as DOMRect;
    expect(edgeAtPoint(flat, 200, h / 2)).toBe("top");

    const narrow = document.createElement("div");
    const w = kBrushBandPx * 2;
    narrow.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: w, bottom: 400, width: w, height: 400, x: 0, y: 0 }) as DOMRect;
    expect(edgeAtPoint(narrow, w / 2, 200)).toBe("left");
  });

  it("is null in the middle of a cell and outside it", () => {
    const cell = stubbedCell();
    expect(edgeAtPoint(cell, 50, 30)).toBe(null);
    expect(edgeAtPoint(cell, -5, 30)).toBe(null);
    expect(edgeAtPoint(cell, 50, 200)).toBe(null);
  });

  it("takes the band width from its argument", () => {
    const cell = stubbedCell();
    expect(edgeAtPoint(cell, 50, 20)).toBe(null);
    expect(edgeAtPoint(cell, 50, 20, 25)).toBe("top");
  });
});

describe("Border Brush mode", () => {
  it("marks the body while it runs", () => {
    const { table } = makeTable();
    expect(isBorderBrushModeActive()).toBe(false);

    enterBorderBrushMode(table, kBrush);
    expect(isBorderBrushModeActive()).toBe(true);
    expect(document.body.classList.contains("bloom-border-brush")).toBe(true);

    exitBorderBrushMode();
    expect(isBorderBrushModeActive()).toBe(false);
    expect(document.body.classList.contains("bloom-border-brush")).toBe(false);
  });

  it("paints the edge under a press on a cell's top band", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterBorderBrushMode(table, kBrush);

    // Cell 2 (row 1, column 0) spans [100,150]..[150,200]; its top band is at
    // y = 150, the boundary between the two rows.
    pointerAt(cells[2], "pointerdown", 125, 152);

    expect(table.getAttribute("data-edges-h")).toContain("dotted");
    // With no gap the boundary is one stroke, and the renderer resolves it onto
    // the upper cell (ties favour top), so that is where it shows.
    expect(cells[0].style.borderBottomStyle).toBe("dotted");
    expect(cells[0].style.borderBottomColor).toBe("#ff0000");
    // One stroke, one undo entry.
    const entries = tableHistoryManager.getEntriesForDebug();
    expect(entries[entries.length - 1].detail).toContain("top edge of");
  });

  it("swallows a press in the middle of a cell and paints nothing", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterBorderBrushMode(table, kBrush);
    const before = tableHistoryManager.getEntriesForDebug().length;

    const swallowed = !pointerAt(cells[0], "pointerdown", 125, 125);

    expect(swallowed).toBe(true);
    expect(tableHistoryManager.getEntriesForDebug().length).toBe(before);
    expect(isBorderBrushModeActive()).toBe(true);
  });

  it("keeps the mode for a press on the table between its cells", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterBorderBrushMode(table, kBrush);

    // The table element itself is the target when the press lands in a gap
    // between cells or on the table's own padding.
    pointerAt(table, "pointerdown", 99, 99);

    expect(isBorderBrushModeActive()).toBe(true);
  });

  it("keeps the mode for a press inside its owner, and leaves for one outside", () => {
    const { table } = makeTable();
    const owner = document.createElement("div");
    const chooser = document.createElement("button");
    owner.appendChild(chooser);
    document.body.appendChild(owner);
    enterBorderBrushMode(owner, kBrush);

    pointerAt(chooser, "pointerdown", 5, 5);
    expect(isBorderBrushModeActive()).toBe(true);

    pointerAt(document.body, "pointerdown", 5, 5);
    expect(isBorderBrushModeActive()).toBe(false);
    expect(table.isConnected).toBe(true);
  });

  it("shows a preview on the hovered edge and takes it away off the edge", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterBorderBrushMode(table, kBrush);

    pointerAt(cells[0], "pointermove", 125, 102);
    // A wash strip and, for a brush that paints, the line above it.
    expect(previews().length).toBe(2);

    pointerAt(cells[0], "pointermove", 125, 125);
    expect(previews().length).toBe(0);
  });

  it("shows the wash alone for a brush that erases", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterBorderBrushMode(table, { style: "solid", weight: 0, color: "#000000" });

    pointerAt(cells[0], "pointermove", 125, 102);
    expect(previews().length).toBe(1);
  });

  it("redraws the preview when the brush is reloaded", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterBorderBrushMode(table, { style: "solid", weight: 0, color: "#000000" });
    pointerAt(cells[0], "pointermove", 125, 102);
    expect(previews().length).toBe(1);

    updateBorderBrush(kBrush);
    expect(previews().length).toBe(2);
  });

  it("leaves on Escape, taking the preview and the body class with it", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterBorderBrushMode(table, kBrush);
    pointerAt(cells[0], "pointermove", 125, 102);
    expect(previews().length).toBe(2);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(isBorderBrushModeActive()).toBe(false);
    expect(previews().length).toBe(0);
    expect(document.body.classList.contains("bloom-border-brush")).toBe(false);
  });

  it("is left behind by removeTableEditingArtifacts", () => {
    const { table } = makeTable();
    enterBorderBrushMode(table, kBrush);

    removeTableEditingArtifacts();

    expect(isBorderBrushModeActive()).toBe(false);
    expect(document.body.classList.contains("bloom-border-brush")).toBe(false);
    expect(previews().length).toBe(0);
  });
});
