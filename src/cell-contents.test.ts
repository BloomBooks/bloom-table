import { describe, it, expect, vi } from "vite-plus/test";
import { setupContentsOfCell } from "./cell-contents";
import { gridHistoryManager } from "./history";

describe("setupContentsOfCell", () => {
  let cell: HTMLElement;

  it("should set up text content by default", () => {
    cell = document.createElement("div");
    setupContentsOfCell(cell);
    expect(cell.innerHTML).toBe(`<div contenteditable="true"></div>`);
    expect(cell.dataset.contentType).toBe("text");
  });

  it("should change content type when specified", () => {
    cell = document.createElement("div");
    setupContentsOfCell(cell, "grid");
    expect(cell.innerHTML).toContain(`grid`);
    expect(cell.dataset.contentType).toBe("grid");
  });

  it("should not change content if type is the same", () => {
    cell = document.createElement("div");
    const textDiv = setupContentsOfCell(cell, "text");
    textDiv!.innerHTML = "hello world";
    const unchangedDiv = setupContentsOfCell(cell, "text");
    expect(unchangedDiv!.innerHTML).toBe("hello world");
  });

  it("if target is not specified and the cell is empty, it should set up with default content type", () => {
    cell = document.createElement("div");
    const contentDiv = setupContentsOfCell(cell);
    expect(contentDiv?.outerHTML).toContain(`contenteditable="true"`);
    expect(cell.dataset.contentType).toBe("text");
  });

  it("should use history when putInHistory is true", () => {
    cell = document.createElement("div");
    const grid = document.createElement("div");
    grid.classList.add("grid");
    grid.appendChild(cell);
    const addHistoryEntry = vi.spyOn(gridHistoryManager, "addHistoryEntry");
    setupContentsOfCell(cell, "text", true);
    expect(addHistoryEntry).toHaveBeenCalled();
  });

  // TODO there are many more cases to cover
});
