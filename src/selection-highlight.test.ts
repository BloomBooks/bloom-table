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
