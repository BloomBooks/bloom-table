import { describe, it, expect } from "vite-plus/test";
import { attachTable } from "./attach";

describe("demo HTML smoke", () => {
  it("primer snippet attaches and applies span via data-*", () => {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="fill,fill" data-row-heights="fit,fit">
        <div class="bloom-cell"></div>
        <div class="bloom-cell"></div>
        <div class="bloom-cell" data-span-x="2"><div>Spanning nested cell</div></div>
        <div class="bloom-cell"></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);
    const cells = Array.from(table.querySelectorAll(".bloom-cell")) as HTMLElement[];
    expect(cells[2].getAttribute("data-span-x")).toBe("2");
    // renderer mirrors CSS var for layout
    expect(cells[2].style.getPropertyValue("--span-x")).toBe("2");
  });
});
