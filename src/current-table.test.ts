import { describe, it, expect, beforeEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";
import {
  cellChain,
  clickTargetCell,
  currentTable,
  doubleClickTargetCell,
  firstCellOf,
  hostCellOf,
  isNestedTable,
  nestedTableIn,
  ownEditable,
  ownSelectedCell,
  ownerTable,
  selectCell,
} from "./current-table";

// An outer 1x2 table whose FIRST cell hosts a nested 1x2 table, which in turn
// hosts a third table in its own first cell — deep enough to test that each
// gesture moves exactly one level.
function buildNested(): {
  outer: HTMLElement;
  middle: HTMLElement;
  inner: HTMLElement;
} {
  document.body.innerHTML = `
    <div class="bloom-table" id="outer" data-column-widths="hug,hug" data-row-heights="hug">
      <div class="bloom-cell" data-content-type="table">
        <div class="bloom-table" id="middle" data-column-widths="hug,hug" data-row-heights="hug">
          <div class="bloom-cell" data-content-type="table">
            <div class="bloom-table" id="inner" data-column-widths="hug" data-row-heights="hug">
              <div class="bloom-cell"><div contenteditable="true">deep</div></div>
            </div>
          </div>
          <div class="bloom-cell"><div contenteditable="true">middle</div></div>
        </div>
      </div>
      <div class="bloom-cell"><div contenteditable="true">outer</div></div>
    </div>`;
  const outer = document.getElementById("outer") as HTMLElement;
  const middle = document.getElementById("middle") as HTMLElement;
  const inner = document.getElementById("inner") as HTMLElement;
  attachTable(outer);
  attachTable(middle);
  attachTable(inner);
  // happy-dom reports a zero rect for every element, and drag-to-resize reads a
  // press anywhere in a zero-sized cell as a grab of its bottom edge — it then
  // stops propagation, and the click never reaches the selection handlers. Give
  // every cell a real box so a press in the middle of one is an ordinary click.
  document.querySelectorAll<HTMLElement>(".bloom-cell").forEach((cell) => {
    cell.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 }) as DOMRect;
  });
  return { outer, middle, inner };
}

beforeEach(() => {
  tableHistoryManager.reset();
  document.body.innerHTML = "";
  resetTableSizeButtons();
});

describe("reading the current table", () => {
  it("names the table that owns the selected cell, not an ancestor", () => {
    const { outer, middle } = buildNested();
    expect(currentTable()).toBe(null);

    const middleCell = middle.children[1] as HTMLElement;
    selectCell(middleCell);
    expect(currentTable()).toBe(middle);
    // The outer table has no selected cell of its OWN, even though a selected
    // cell sits inside it.
    expect(ownSelectedCell(outer)).toBe(null);
    expect(ownSelectedCell(middle)).toBe(middleCell);
  });

  it("reports the owner table, host cell and nesting of each level", () => {
    const { outer, middle, inner } = buildNested();
    const hostOfMiddle = outer.children[0] as HTMLElement;

    expect(ownerTable(hostOfMiddle)).toBe(outer);
    expect(ownerTable(inner.children[0] as HTMLElement)).toBe(inner);
    expect(isNestedTable(outer)).toBe(false);
    expect(isNestedTable(middle)).toBe(true);
    expect(hostCellOf(middle)).toBe(hostOfMiddle);
    expect(hostCellOf(outer)).toBe(null);
    expect(nestedTableIn(hostOfMiddle)).toBe(middle);
    expect(nestedTableIn(outer.children[1] as HTMLElement)).toBe(null);
    expect(firstCellOf(middle)).toBe(middle.children[0]);
  });

  it("finds only the cell's own editable, never a nested table's", () => {
    const { outer, middle } = buildNested();
    const hostOfMiddle = outer.children[0] as HTMLElement;
    expect(ownEditable(hostOfMiddle)).toBe(null);
    expect(ownEditable(middle.children[1] as HTMLElement)).toBe(
      middle.children[1].querySelector("[contenteditable]"),
    );
  });
});

describe("which cell a click selects", () => {
  it("lists the containing cells outermost first", () => {
    const { outer, middle, inner } = buildNested();
    const deep = inner.querySelector("[contenteditable]") as HTMLElement;
    expect(cellChain(deep)).toEqual([outer.children[0], middle.children[0], inner.children[0]]);
    expect(cellChain(document.body)).toEqual([]);
  });

  it("stays at the current table's level, so a click falls on the HOST cell", () => {
    const { outer, middle, inner } = buildNested();
    const deep = inner.querySelector("[contenteditable]") as HTMLElement;

    // Nothing selected yet: the click lands on the outermost cell.
    expect(clickTargetCell(deep, null)).toBe(outer.children[0]);
    // Outer table current: same answer — the click does not fall through.
    expect(clickTargetCell(deep, outer)).toBe(outer.children[0]);
    // Middle table current: the click selects the middle table's own cell.
    expect(clickTargetCell(deep, middle)).toBe(middle.children[0]);
    expect(clickTargetCell(deep, inner)).toBe(inner.children[0]);
  });

  it("selects an outer cell when the click leaves the current table (the exit gesture)", () => {
    const { outer, inner } = buildNested();
    const outerEditable = outer.children[1].querySelector("[contenteditable]") as HTMLElement;
    // The inner table is current, but the click landed in a cell of the outer
    // table: that cell is selected, which makes the outer table current.
    expect(clickTargetCell(outerEditable, inner)).toBe(outer.children[1]);
  });

  it("descends exactly one level per double-click", () => {
    const { outer, middle, inner } = buildNested();
    const deep = inner.querySelector("[contenteditable]") as HTMLElement;

    expect(doubleClickTargetCell(deep, outer)).toBe(middle.children[0]);
    expect(doubleClickTargetCell(deep, middle)).toBe(inner.children[0]);
    // No level below the inner table: null, which leaves the browser's own
    // double-click (selecting a word) alone.
    expect(doubleClickTargetCell(deep, inner)).toBe(null);
  });

  it("has no deeper level to enter on a plain text cell", () => {
    const { outer } = buildNested();
    const outerEditable = outer.children[1].querySelector("[contenteditable]") as HTMLElement;
    expect(doubleClickTargetCell(outerEditable, outer)).toBe(null);
  });
});

describe("click and double-click gestures on a live table", () => {
  const mousedown = (target: HTMLElement) => {
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      // Away from the cell edges, which drag-to-resize claims.
      clientX: 50,
      clientY: 50,
    });
    target.dispatchEvent(event);
    return event;
  };
  const dblclick = (target: HTMLElement) =>
    target.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
      }),
    );

  it("a click on a host cell selects the host; a double-click enters the nested table", () => {
    const { outer, middle } = buildNested();
    const host = outer.children[0] as HTMLElement;
    const middleEditable = middle.children[1].querySelector("[contenteditable]") as HTMLElement;

    mousedown(middleEditable);
    expect(currentTable()).toBe(outer);
    expect(host.classList.contains("cell--selected")).toBe(true);

    dblclick(middleEditable);
    expect(currentTable()).toBe(middle);
    expect((middle.children[1] as HTMLElement).classList.contains("cell--selected")).toBe(true);
    expect(document.activeElement).toBe(middleEditable);
    // The entered table carries the visible "you are here" mark; the outer one
    // never does.
    expect(middle.classList.contains("bloom-current-table")).toBe(true);
    expect(outer.classList.contains("bloom-current-table")).toBe(false);
  });

  it("a click on an outer cell exits the nested table", () => {
    const { outer, middle } = buildNested();
    selectCell(middle.children[1] as HTMLElement);
    expect(currentTable()).toBe(middle);

    // The press is on the outer cell itself (its padding), which is the case
    // this handler owns. A press that lands in that cell's own text box is left
    // to the browser, which moves focus there by itself.
    mousedown(outer.children[1] as HTMLElement);
    expect(currentTable()).toBe(outer);
    expect((outer.children[1] as HTMLElement).classList.contains("cell--selected")).toBe(true);
    expect(middle.classList.contains("bloom-current-table")).toBe(false);
  });

  it("Enter enters the nested table, Escape leaves it", () => {
    const { outer, middle } = buildNested();
    const host = outer.children[0] as HTMLElement;
    selectCell(host);
    expect(currentTable()).toBe(outer);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(currentTable()).toBe(middle);
    expect((middle.children[0] as HTMLElement).classList.contains("cell--selected")).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(currentTable()).toBe(outer);
    expect(host.classList.contains("cell--selected")).toBe(true);
  });
});

