import { describe, it, expect, vi } from "vite-plus/test";
import {
  getCurrentContentTypeId,
  kTableCellContentChangedEvent,
  registerCellContentType,
  setupContentsOfCell,
  unregisterCellContentType,
} from "./cell-contents";
import { tableHistoryManager } from "./history";

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
    setupContentsOfCell(cell, "table");
    expect(cell.innerHTML).toContain(`table`);
    expect(cell.dataset.contentType).toBe("table");
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
    const table = document.createElement("div");
    table.classList.add("bloom-table");
    table.appendChild(cell);
    const addHistoryEntry = vi.spyOn(tableHistoryManager, "addHistoryEntry");
    setupContentsOfCell(cell, "text", true);
    expect(addHistoryEntry).toHaveBeenCalled();
  });

  // TODO there are many more cases to cover
});

describe("setupContentsOfCell content-changed notification", () => {
  function makeTableWithCell(): { table: HTMLElement; cell: HTMLElement } {
    const table = document.createElement("div");
    table.classList.add("bloom-table");
    const cell = document.createElement("div");
    cell.classList.add("bloom-cell");
    table.appendChild(cell);
    return { table, cell };
  }

  it("does not announce a change the history manager refused to make (detached table)", () => {
    tableHistoryManager.reset();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { table, cell } = makeTableWithCell();
    document.body.appendChild(table); // in the DOM, but never attached to the history manager
    const listener = vi.fn();
    cell.addEventListener(kTableCellContentChangedEvent, listener);

    setupContentsOfCell(cell, "text", true);

    expect(cell.innerHTML).toBe(""); // the rebuild never happened
    expect(listener).not.toHaveBeenCalled();
    warn.mockRestore();
    table.remove();
  });

  it("does announce the change when the history entry does run", () => {
    tableHistoryManager.reset();
    const { table, cell } = makeTableWithCell();
    document.body.appendChild(table);
    tableHistoryManager.attachTable(table);
    const listener = vi.fn();
    cell.addEventListener(kTableCellContentChangedEvent, listener);

    setupContentsOfCell(cell, "text", true);

    expect(cell.innerHTML).toBe(`<div contenteditable="true"></div>`);
    expect(listener).toHaveBeenCalledTimes(1);
    tableHistoryManager.reset();
    table.remove();
  });

  it("does not announce a change whose operation threw inside the history entry", () => {
    tableHistoryManager.reset();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    registerCellContentType({
      id: "two-roots",
      englishName: "Two Roots",
      icon: "",
      templateHtml: "<div></div><div></div>",
      regexToIdentify: /never-matches-anything/,
    });
    const { table, cell } = makeTableWithCell();
    document.body.appendChild(table);
    tableHistoryManager.attachTable(table);
    const listener = vi.fn();
    cell.addEventListener(kTableCellContentChangedEvent, listener);

    setupContentsOfCell(cell, "two-roots", true);

    expect(listener).not.toHaveBeenCalled();
    unregisterCellContentType("two-roots");
    error.mockRestore();
    tableHistoryManager.reset();
    table.remove();
  });
});

describe("identifying the content type of legacy cells with no data-content-type", () => {
  const nestedTableHtml = `<div class="bloom-table" data-column-widths="fill,fill" data-row-heights="fill,fill">
      <div class="bloom-cell"><div contenteditable="true">one</div></div>
      <div class="bloom-cell"><div contenteditable="true">two</div></div>
    </div>`;

  it("reports a cell holding a nested table as a table, not as text", () => {
    const cell = document.createElement("div");
    cell.innerHTML = nestedTableHtml;
    expect(getCurrentContentTypeId(cell)).toBe("table");
  });

  it("leaves a legacy nested table alone when 'table' is applied to it", () => {
    const cell = document.createElement("div");
    cell.innerHTML = nestedTableHtml;
    setupContentsOfCell(cell, "table");
    expect(cell.textContent).toContain("one");
    expect(cell.querySelectorAll(".bloom-cell").length).toBe(2);
  });

  it("does not treat an unrelated class that merely contains 'table' as a table", () => {
    for (const className of ["table", "sortable", "timetable"]) {
      const cell = document.createElement("div");
      cell.innerHTML = `<div class="${className}"><span>x</span></div>`;
      expect(getCurrentContentTypeId(cell)).not.toBe("table");
    }
  });
});
