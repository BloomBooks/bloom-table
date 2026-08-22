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
import { getCellBackground, setCellBackground } from "./table-model";
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
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  return { table, cells };
}

const pointerDown = (el: HTMLElement, button = 0) =>
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button }));

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

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isPaintFormatModeActive()).toBe(false);
    expect(document.body.classList.contains("bloom-paint-format")).toBe(false);
    expect(document.querySelector(".bloom-paint-format-badge")).toBe(null);

    pointerDown(cells[3]);
    expect(getCellBackground(cells[3])).toBe(null);
  });

  it("clicking the badge exits the mode", () => {
    const { table, cells } = makeTable();
    enterPaintFormatMode(table, "cell", [cells[0]]);
    const badge = document.querySelector(".bloom-paint-format-badge") as HTMLElement;
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
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

    cells[3].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

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

  it("a pattern cycles across a longer target and truncates across a shorter one", () => {
    const { table, cells } = makeTable();
    setCellBackground(cells[0], "red");
    setCellBackground(cells[1], "blue");
    render(table);
    const pattern = [snapshotCellProperties(cells[0])];

    // One-cell pattern onto a two-cell row: both get it (cycling).
    paintProperties(table, [cells[2], cells[3]], pattern);
    expect(getCellBackground(cells[2])).toBe("red");
    expect(getCellBackground(cells[3])).toBe("red");

    // Two-cell pattern onto a one-cell target: truncated to the first entry.
    const pattern2 = [snapshotCellProperties(cells[1]), snapshotCellProperties(cells[0])];
    paintProperties(table, [cells[2]], pattern2);
    expect(getCellBackground(cells[2])).toBe("blue");
  });
});
