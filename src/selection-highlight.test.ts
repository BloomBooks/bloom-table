import { describe, it, expect } from "vite-plus/test";
import { attachGrid } from "./attach";

describe("selection highlighting", () => {
  it("adds classes to focused cell and its grid", () => {
    document.body.innerHTML = `
      <div class="grid" data-column-widths="fill,fill" data-row-heights="fit,fit">
        <div class="cell"><div contenteditable="true">A</div></div>
        <div class="cell"><div contenteditable="true">B</div></div>
        <div class="cell"><div contenteditable="true">C</div></div>
        <div class="cell"><div contenteditable="true">D</div></div>
      </div>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    const firstEditable = grid.querySelector(
      ".cell:nth-of-type(1) [contenteditable]",
    ) as HTMLElement;

    // Simulate focus entering the first cell
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const firstCell = firstEditable.closest(".cell") as HTMLElement;

    expect(firstCell.classList.contains("cell--selected")).toBe(true);
    expect(grid.classList.contains("grid--selected")).toBe(true);
  });

  it("persists selection when focusing outside cells and updates on new cell", () => {
    document.body.innerHTML = `
      <div class="grid" data-column-widths="fill,fill" data-row-heights="fit,fit">
        <div class="cell"><div contenteditable="true">A</div></div>
        <div class="cell"><div contenteditable="true">B</div></div>
        <div class="cell"><div contenteditable="true">C</div></div>
        <div class="cell"><div contenteditable="true">D</div></div>
      </div>
      <button id="outside">Outside</button>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    const firstEditable = grid.querySelector(
      ".cell:nth-of-type(1) [contenteditable]",
    ) as HTMLElement;
    const secondEditable = grid.querySelector(
      ".cell:nth-of-type(2) [contenteditable]",
    ) as HTMLElement;

    // Focus first cell
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const firstCell = firstEditable.closest(".cell") as HTMLElement;
    expect(firstCell.classList.contains("cell--selected")).toBe(true);

    // Focus outside element (not a cell) - selection should persist
    const outside = document.getElementById("outside") as HTMLElement;
    outside.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(firstCell.classList.contains("cell--selected")).toBe(true);
    expect(grid.classList.contains("grid--selected")).toBe(true);

    // Now focus second cell - classes should move
    secondEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const secondCell = secondEditable.closest(".cell") as HTMLElement;
    expect(secondCell.classList.contains("cell--selected")).toBe(true);
    expect(firstCell.classList.contains("cell--selected")).toBe(false);
    expect(grid.classList.contains("grid--selected")).toBe(true);
  });
});
