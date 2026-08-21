import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { tableHistoryManager } from "./history";
import {
  setupContentsOfCell,
  registerCellContentType,
  unregisterCellContentType,
  kTableCellContentChangedEvent,
} from "./cell-contents";

function makeTable(id: string, innerHTML: string): HTMLElement {
  const table = document.createElement("div");
  table.classList.add("bloom-table");
  table.id = id;
  table.innerHTML = innerHTML;
  document.body.appendChild(table);
  tableHistoryManager.attachTable(table);
  return table;
}

describe("tableHistoryManager undo targeting", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("refuses to undo an entry belonging to a different table", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");
    const bContentBefore = b.innerHTML;

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });

    // The user has table B selected and asks to undo. The newest entry is A's,
    // so nothing should happen to B - and A's entry must survive.
    expect(tableHistoryManager.undo(b)).toBe(false);
    expect(b.innerHTML).toBe(bContentBefore);
    expect(b.getAttribute("data-formatted")).toBe(null);
    expect(tableHistoryManager.canUndo()).toBe(true);

    // Undoing on A still works.
    expect(tableHistoryManager.undo(a)).toBe(true);
    expect(a.getAttribute("data-formatted")).toBe(null);
    expect(tableHistoryManager.canUndo()).toBe(false);
  });

  it("undoLast drops entries whose table is no longer attached instead of using another table", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");
    const bContentBefore = b.innerHTML;

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    tableHistoryManager.detachTable(a);
    a.remove();

    expect(tableHistoryManager.undoLast()).toBe(false);
    expect(b.innerHTML).toBe(bContentBefore);
    expect(tableHistoryManager.canUndo()).toBe(false);
  });

  it("undoLast undoes the newest entry that still has its table", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");

    tableHistoryManager.addHistoryEntry(b, "Format B", () => {
      b.setAttribute("data-formatted", "true");
    });
    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    tableHistoryManager.detachTable(a);
    a.remove();

    expect(tableHistoryManager.undoLast()).toBe(true);
    expect(b.getAttribute("data-formatted")).toBe(null);
    expect(tableHistoryManager.canUndo()).toBe(false);
  });
});

describe("tableHistoryManager operation failure", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("restores the table and reports failure when the operation throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const table = makeTable("a", "<div class='bloom-cell'>original</div>");
      const before = table.innerHTML;

      const result = tableHistoryManager.addHistoryEntry(table, "Half done", () => {
        table.setAttribute("data-half-done", "true");
        table.innerHTML = "<div class='bloom-cell'>mangled</div>";
        throw new Error("boom");
      });

      expect(result).toBe(false);
      expect(table.innerHTML).toBe(before);
      expect(table.getAttribute("data-half-done")).toBe(null);
      expect(tableHistoryManager.canUndo()).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("setupContentsOfCell with a failing template", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
    registerCellContentType({
      id: "two-roots",
      englishName: "Two Roots",
      icon: "",
      templateHtml: "<div>one</div><div>two</div>",
      regexToIdentify: /never-matches-this/,
    });
  });

  afterEach(() => {
    unregisterCellContentType("two-roots");
  });

  it("leaves the cell as it was and does not notify the host", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const table = makeTable("a", "<div class='bloom-cell' data-content-type='text'>hello</div>");
      const before = table.innerHTML;
      const changed = vi.fn();
      table.addEventListener(kTableCellContentChangedEvent, changed);

      const cell = table.querySelector<HTMLElement>(".bloom-cell")!;
      setupContentsOfCell(cell, "two-roots", true);

      expect(changed).not.toHaveBeenCalled();
      expect(table.innerHTML).toBe(before);
      expect(tableHistoryManager.canUndo()).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});
