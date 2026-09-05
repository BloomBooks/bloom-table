import { describe, it, expect, beforeEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import {
  resetTableSizeButtons,
  enterPaintFormatMode,
  exitPaintFormatMode,
  isPaintFormatModeActive,
} from "./table-size-buttons";
import { paintProperties, snapshotCellProperties } from "./formatting-commands";
import { removeTableEditingArtifacts } from "./prepare-for-save";
import {
  getCellBackground,
  getColumnWidths,
  getRowHeights,
  setCellBackground,
  setColumnWidths,
  setRowHeights,
} from "./table-model";
import { render } from "./table-renderer";

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
    (c): c is HTMLElement =>
      c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  return { table, cells };
}

const pointerDown = (el: HTMLElement, button = 0) =>
  el.dispatchEvent(
    new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button }),
  );

const pointerMove = (el: HTMLElement) =>
  el.dispatchEvent(
    new MouseEvent("pointermove", { bubbles: true, cancelable: true }),
  );

const overlayCount = () =>
  document.querySelectorAll(".bloom-sel-overlay").length;

// happy-dom gives every element a zero rect, and the highlight overlay is a
// union bounding box, so the cells need rects of their own before it has
// anything to draw. A 2x2 grid of 50px cells filling [100,100]..[200,200].
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

// The live cells of a table, re-read from the DOM. Undo rewrites the table's
// children, so a reference taken before it points at a detached node.
const liveCells = (table: HTMLElement) =>
  Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));

beforeEach(() => {
  exitPaintFormatMode();
  tableHistoryManager.reset();
  document.body.innerHTML = "";
  document.body.className = "";
  resetTableSizeButtons();
});

describe("paint format mode", () => {
  it("cell scope: every clicked cell gets the source cell's properties", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    render(table);

    enterPaintFormatMode(table, "cell", [cells[0]]);
    expect(isPaintFormatModeActive()).toBe(true);
    expect(document.body.classList.contains("bloom-paint-format")).toBe(true);
    expect(document.querySelector(".bloom-paint-format-badge")).not.toBe(null);

    pointerDown(cells[3]);
    expect(getCellBackground(cells[3])).toBe("red");
    expect(tableHistoryManager.getLastOperationLabel()).toBe("Paint Format");

    // The mode persists: a second click paints again.
    pointerDown(cells[1]);
    expect(getCellBackground(cells[1])).toBe("red");
  });

  it("row scope: clicking any cell paints its whole row with the source pattern", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    setCellBackground(cells[1], "blue");
    render(table);

    enterPaintFormatMode(table, "row", [cells[0], cells[1]]);
    pointerDown(cells[3]); // any cell of row 1

    expect(getCellBackground(cells[2])).toBe("red");
    expect(getCellBackground(cells[3])).toBe("blue");
  });

  it("Escape exits: badge and cursor class go away, clicks stop painting", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    render(table);
    enterPaintFormatMode(table, "cell", [cells[0]]);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(isPaintFormatModeActive()).toBe(false);
    expect(document.body.classList.contains("bloom-paint-format")).toBe(false);
    expect(document.querySelector(".bloom-paint-format-badge")).toBe(null);

    pointerDown(cells[3]);
    expect(getCellBackground(cells[3])).toBe(null);
  });

  it("a press outside every table exits the mode, and is not swallowed", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    render(table);
    enterPaintFormatMode(table, "cell", [cells[0]]);

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    const notSwallowed = pointerDown(outside);

    expect(isPaintFormatModeActive()).toBe(false);
    expect(notSwallowed).toBe(true); // not preventDefault()ed
    // The next click on a cell is an ordinary click again.
    pointerDown(cells[3]);
    expect(getCellBackground(cells[3])).toBe(null);
  });

  it("a press on the badge does not count as a press outside the table", () => {
    const { table, cells } = makeTable();
    enterPaintFormatMode(table, "cell", [cells[0]]);
    const badge = document.querySelector(
      ".bloom-paint-format-badge",
    ) as HTMLElement;

    pointerDown(badge);
    // Only the badge's own click handler ends the mode, so a press alone
    // leaves it running.
    expect(isPaintFormatModeActive()).toBe(true);
  });

  it("clicking the badge exits the mode", () => {
    const { table, cells } = makeTable();
    enterPaintFormatMode(table, "cell", [cells[0]]);
    const badge = document.querySelector(
      ".bloom-paint-format-badge",
    ) as HTMLElement;
    badge.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(isPaintFormatModeActive()).toBe(false);
  });

  it("only the primary button paints: a right or middle press stamps nothing", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    render(table);
    enterPaintFormatMode(table, "cell", [cells[0]]);

    pointerDown(cells[3], 2); // right button
    expect(getCellBackground(cells[3])).toBe(null);
    pointerDown(cells[3], 1); // middle button
    expect(getCellBackground(cells[3])).toBe(null);
    // The mode is still on, and the primary button still paints.
    expect(isPaintFormatModeActive()).toBe(true);
    pointerDown(cells[3]);
    expect(getCellBackground(cells[3])).toBe("red");
  });

  it("a right-click does not open the Cell menu while the mode is active", () => {
    const { table, cells } = makeTable();
    enterPaintFormatMode(table, "cell", [cells[0]]);

    cells[3].dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );

    expect(document.querySelector("[data-btable-menu]")).toBe(null);
    expect(isPaintFormatModeActive()).toBe(true);
  });

  it("re-installs the cursor <style> after prepare-for-save removed it", () => {
    const { table, cells } = makeTable();
    enterPaintFormatMode(table, "cell", [cells[0]]);
    const selector = 'style[data-table-overlay="paint-format-style"]';
    expect(document.head.querySelector(selector)).not.toBe(null);

    // The host saves: the style is a tagged overlay, so it goes.
    removeTableEditingArtifacts(document);
    expect(document.head.querySelector(selector)).toBe(null);

    enterPaintFormatMode(table, "cell", [cells[0]]);
    expect(document.head.querySelector(selector)).not.toBe(null);
  });

  it("prepare-for-save exits the mode instead of leaving it armed and invisible", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    render(table);
    enterPaintFormatMode(table, "cell", [cells[0]]);

    removeTableEditingArtifacts(document);

    expect(isPaintFormatModeActive()).toBe(false);
    // A later click is an ordinary click again: nothing is stamped, and the
    // event is not swallowed.
    const clicked = pointerDown(cells[3]);
    expect(getCellBackground(cells[3])).toBe(null);
    expect(clicked).toBe(true); // not preventDefault()ed
  });

  it("row scope: the source row's height travels with the format", () => {
    const { table, cells } = makeTable();
    setRowHeights(table, ["40mm", "hug"]);
    render(table);

    enterPaintFormatMode(table, "row", [cells[0], cells[1]]);
    pointerDown(cells[3]); // any cell of row 1

    expect(getRowHeights(table)).toEqual(["40mm", "40mm"]);
  });

  it("column scope: the source column's width travels with the format", () => {
    const { table, cells } = makeTable();
    setColumnWidths(table, ["fill", "hug"]);
    render(table);

    enterPaintFormatMode(table, "column", [cells[1], cells[3]]); // column 1
    pointerDown(cells[0]); // any cell of column 0

    expect(getColumnWidths(table)).toEqual(["hug", "hug"]);
  });

  it("cell scope leaves the row height and column width alone", () => {
    const { table, cells } = makeTable();
    setRowHeights(table, ["40mm", "hug"]);
    setColumnWidths(table, ["fill", "hug"]);
    setCellBackground(cells[0], "red");
    render(table);

    enterPaintFormatMode(table, "cell", [cells[0]]);
    pointerDown(cells[3]);

    expect(getCellBackground(cells[3])).toBe("red");
    expect(getRowHeights(table)).toEqual(["40mm", "hug"]);
    expect(getColumnWidths(table)).toEqual(["fill", "hug"]);
  });

  it("the size change is part of the same undo entry as the cells", () => {
    const { table, cells } = makeTable();
    setRowHeights(table, ["40mm", "hug"]);
    setCellBackground(cells[0], "red");
    render(table);

    enterPaintFormatMode(table, "row", [cells[0], cells[1]]);
    pointerDown(cells[3]);
    expect(getRowHeights(table)).toEqual(["40mm", "40mm"]);

    tableHistoryManager.undo(table);
    expect(getRowHeights(table)).toEqual(["40mm", "hug"]);
    expect(getCellBackground(liveCells(table)[2])).toBe(null);
  });

  it("hovering outlines the region the next click would stamp, and exiting clears it", () => {
    const { table, cells } = makeTable();
    stubCellRects(cells);
    enterPaintFormatMode(table, "row", [cells[0], cells[1]]);
    expect(overlayCount()).toBe(0);

    pointerMove(cells[3]);
    expect(overlayCount()).toBe(1);
    // The whole of row 1, not just the cell under the pointer.
    const overlay = document.querySelector(".bloom-sel-overlay") as HTMLElement;
    expect(overlay.style.width).toBe("100px");
    expect(overlay.style.height).toBe("50px");

    // Moving off every table takes the outline away again.
    pointerMove(document.body);
    expect(overlayCount()).toBe(0);

    pointerMove(cells[3]);
    expect(overlayCount()).toBe(1);
    exitPaintFormatMode();
    expect(overlayCount()).toBe(0);
  });

  it("no outline is drawn before the mode starts", () => {
    const { cells } = makeTable();
    stubCellRects(cells);
    pointerMove(cells[3]);
    expect(overlayCount()).toBe(0);
  });

  it("a pattern cycles across a longer target and truncates across a shorter one", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    setCellBackground(cells[1], "blue");
    render(table);
    const pattern = [snapshotCellProperties(cells[0])];

    // One-cell pattern onto a two-cell row: both get it (cycling).
    paintProperties(table, "row", [cells[2], cells[3]], pattern);
    expect(getCellBackground(cells[2])).toBe("red");
    expect(getCellBackground(cells[3])).toBe("red");

    // Two-cell pattern onto a one-cell target: truncated to the first entry.
    const pattern2 = [
      snapshotCellProperties(cells[1]),
      snapshotCellProperties(cells[0]),
    ];
    paintProperties(table, "cell", [cells[2]], pattern2);
    expect(getCellBackground(cells[2])).toBe("blue");
  });
});
