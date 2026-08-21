import { describe, it, expect, beforeEach } from "vite-plus/test";
import { removeTableEditingArtifacts } from "./prepare-for-save";
import { attachTable, detachTable } from "./attach";
import { tableHistoryManager } from "./history";
import {
  resetTableSizeButtons,
  enterPaintFormatMode,
  exitPaintFormatMode,
} from "./table-size-buttons";

describe("removeTableEditingArtifacts", () => {
  beforeEach(() => {
    exitPaintFormatMode();
    tableHistoryManager.reset?.();
    document.body.innerHTML = "";
    document.body.className = "";
    resetTableSizeButtons();
  });

  it("strips minted anchor names along with selection classes", () => {
    document.body.innerHTML = `
      <div class="bloom-table table--selected bloom-pointer-near"
           data-column-widths="hug,hug" data-row-heights="hug">
        <div class="bloom-cell cell--selected"
             style="anchor-name: --btable-cell-3; background: red"
             data-btable-anchor-name="--btable-cell-3"><div contenteditable>a</div></div>
        <div class="bloom-cell"><div contenteditable>b</div></div>
      </div>`;

    removeTableEditingArtifacts(document);

    const table = document.querySelector(".bloom-table") as HTMLElement;
    const cell = table.querySelector(".bloom-cell") as HTMLElement;
    expect(cell.style.getPropertyValue("anchor-name")).toBe("");
    expect(cell.getAttribute("data-btable-anchor-name")).toBe(null);
    expect(cell.classList.contains("cell--selected")).toBe(false);
    expect(table.classList.contains("table--selected")).toBe(false);
    expect(table.classList.contains("bloom-pointer-near")).toBe(false);
    // Unrelated inline styles survive.
    expect(cell.style.getPropertyValue("background")).toBe("red");
  });

  it("leaves nothing but the table under <body> after real editing chrome exists", () => {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
        <div class="bloom-cell"><div contenteditable>1</div></div>
        <div class="bloom-cell"><div contenteditable>2</div></div>
        <div class="bloom-cell"><div contenteditable>3</div></div>
        <div class="bloom-cell"><div contenteditable>4</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);

    // Focusing a cell builds the "+" add buttons, the row/column/table menu
    // pills, their clusters and each one's ProximityDiv wrapper (all appended
    // to <body>).
    const editable = table.querySelector(".bloom-cell [contenteditable]") as HTMLElement;
    editable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    // Right-clicking a cell opens the menu popup (also appended to <body>).
    const cell = table.querySelector(".bloom-cell") as HTMLElement;
    cell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(document.querySelector("[data-btable-menu]")).not.toBe(null);
    // Paint Format adds its badge plus a class on <body>.
    enterPaintFormatMode(table, "cell", [cell]);

    // Sanity: the chrome really is there before we strip it.
    expect(document.body.children.length).toBeGreaterThan(1);
    expect(document.querySelector("[data-btable-menu-pill]")).not.toBe(null);
    expect(document.querySelector(".bloom-paint-format-badge")).not.toBe(null);

    removeTableEditingArtifacts(document);

    expect(Array.from(document.body.children)).toEqual([table]);
    expect(document.querySelector("[data-btable-menu-pill]")).toBe(null);
    expect(document.querySelector("[data-overlay-cluster]")).toBe(null);
    expect(document.querySelector("[data-btable-menu]")).toBe(null);
    expect(document.querySelector(".bloom-paint-format-badge")).toBe(null);
    expect(document.body.classList.contains("bloom-paint-format")).toBe(false);

    detachTable(table);
  });

  it("strips an open menu popup", () => {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="hug" data-row-heights="hug">
        <div class="bloom-cell"><div contenteditable>1</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);
    const cell = table.querySelector(".bloom-cell") as HTMLElement;
    cell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(document.querySelector("[data-btable-menu]")).not.toBe(null);

    removeTableEditingArtifacts(document);

    expect(document.querySelector("[data-btable-menu]")).toBe(null);
    expect(Array.from(document.body.children)).toEqual([table]);

    detachTable(table);
  });
});
