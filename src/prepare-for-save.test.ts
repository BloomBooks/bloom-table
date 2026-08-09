import { describe, it, expect, beforeEach } from "vite-plus/test";
import { removeTableEditingArtifacts } from "./prepare-for-save";

describe("removeTableEditingArtifacts", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
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
});
