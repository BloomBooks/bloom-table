import { describe, it, expect } from "vite-plus/test";
import { attachGrid } from "./attach";

describe("demo HTML smoke", () => {
  it("primer snippet attaches and applies span via data-*", () => {
    document.body.innerHTML = `
      <div class="grid" data-column-widths="fill,fill" data-row-heights="fit,fit">
        <div class="cell"></div>
        <div class="cell"></div>
        <div class="cell" data-span-x="2"><div>Spanning nested cell</div></div>
        <div class="cell"></div>
      </div>`;
    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);
    const cells = Array.from(grid.querySelectorAll(".cell")) as HTMLElement[];
    expect(cells[2].getAttribute("data-span-x")).toBe("2");
    // renderer mirrors CSS var for layout
    expect(cells[2].style.getPropertyValue("--span-x")).toBe("2");
  });
});
