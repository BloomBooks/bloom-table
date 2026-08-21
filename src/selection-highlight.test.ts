import { describe, it, expect } from "vite-plus/test";
import { attachTable } from "./attach";

describe("selection highlighting", () => {
  it("adds classes to focused cell and its table", () => {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="fill,fill" data-row-heights="fit,fit">
        <div class="bloom-cell"><div contenteditable="true">A</div></div>
        <div class="bloom-cell"><div contenteditable="true">B</div></div>
        <div class="bloom-cell"><div contenteditable="true">C</div></div>
        <div class="bloom-cell"><div contenteditable="true">D</div></div>
      </div>`;

    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);

    const firstEditable = table.querySelector(
      ".bloom-cell:nth-of-type(1) [contenteditable]",
    ) as HTMLElement;

    // Simulate focus entering the first cell
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const firstCell = firstEditable.closest(".bloom-cell") as HTMLElement;

    expect(firstCell.classList.contains("cell--selected")).toBe(true);
    expect(table.classList.contains("table--selected")).toBe(true);
  });

  it("persists selection when focusing outside cells and updates on new cell", () => {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="fill,fill" data-row-heights="fit,fit">
        <div class="bloom-cell"><div contenteditable="true">A</div></div>
        <div class="bloom-cell"><div contenteditable="true">B</div></div>
        <div class="bloom-cell"><div contenteditable="true">C</div></div>
        <div class="bloom-cell"><div contenteditable="true">D</div></div>
      </div>
      <button id="outside">Outside</button>`;

    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);

    const firstEditable = table.querySelector(
      ".bloom-cell:nth-of-type(1) [contenteditable]",
    ) as HTMLElement;
    const secondEditable = table.querySelector(
      ".bloom-cell:nth-of-type(2) [contenteditable]",
    ) as HTMLElement;

    // Focus first cell
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const firstCell = firstEditable.closest(".bloom-cell") as HTMLElement;
    expect(firstCell.classList.contains("cell--selected")).toBe(true);

    // Focus outside element (not a cell) - selection should persist
    const outside = document.getElementById("outside") as HTMLElement;
    outside.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(firstCell.classList.contains("cell--selected")).toBe(true);
    expect(table.classList.contains("table--selected")).toBe(true);

    // Now focus second cell - classes should move
    secondEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const secondCell = secondEditable.closest(".bloom-cell") as HTMLElement;
    expect(secondCell.classList.contains("cell--selected")).toBe(true);
    expect(firstCell.classList.contains("cell--selected")).toBe(false);
    expect(table.classList.contains("table--selected")).toBe(true);
  });
});

describe("selection mousedown handling", () => {
  function buildTable(secondCellInner: string): HTMLElement {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="fill,fill" data-row-heights="fit,fit">
        <div class="bloom-cell"><div contenteditable="true">A</div></div>
        <div class="bloom-cell">${secondCellInner}</div>
        <div class="bloom-cell"><div contenteditable="true">C</div></div>
        <div class="bloom-cell"><div contenteditable="true">D</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);
    return table;
  }

  function mousedown(target: HTMLElement, button: number): MouseEvent {
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button,
      // Away from a cell's edges: jsdom reports a zero-sized rect, and a press at
      // 0,0 in one reads as a row/column resize grab (drag-to-resize would then
      // preventDefault, hiding what we are measuring here).
      clientX: 3,
      clientY: 3,
    });
    target.dispatchEvent(event);
    return event;
  }

  it("takes over a primary click on the cell's padding", () => {
    const table = buildTable(`<div contenteditable="true">B</div>`);
    const cell = table.querySelector(".bloom-cell") as HTMLElement;
    const editable = cell.querySelector('[contenteditable="true"]') as HTMLElement;

    const event = mousedown(cell, 0);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(editable);
  });

  it("leaves non-primary clicks alone", () => {
    const table = buildTable(`<div contenteditable="true">B</div>`);
    const cell = table.querySelector(".bloom-cell") as HTMLElement;

    for (const button of [1, 2]) {
      (document.activeElement as HTMLElement | null)?.blur();
      const event = mousedown(cell, button);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(document.body);
    }
  });

  it("selects the cell without suppressing mousedown on media content", () => {
    const table = buildTable(`<img alt="" src="x.png" />`);
    const imageCell = table.querySelectorAll(".bloom-cell")[1] as HTMLElement;
    const image = imageCell.querySelector("img") as HTMLElement;

    const event = mousedown(image, 0);

    expect(event.defaultPrevented).toBe(false);
    // The cell still becomes the selected one.
    expect(document.activeElement).toBe(imageCell);
    expect(imageCell.classList.contains("cell--selected")).toBe(true);
  });
});
