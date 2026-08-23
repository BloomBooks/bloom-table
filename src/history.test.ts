import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { setRestoreReattacher, tableHistoryManager } from "./history";
import { attachTable } from "./attach";
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

describe("tableHistoryManager redo", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("round-trips undo then redo, and the redone entry is undoable again", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    expect(tableHistoryManager.canRedo()).toBe(false);

    expect(tableHistoryManager.undo(a)).toBe(true);
    expect(a.getAttribute("data-formatted")).toBe(null);
    expect(tableHistoryManager.canRedo()).toBe(true);

    expect(tableHistoryManager.redo(a)).toBe(true);
    expect(a.getAttribute("data-formatted")).toBe("true");
    expect(tableHistoryManager.canUndo()).toBe(true);
    expect(tableHistoryManager.canRedo()).toBe(false);

    // The redone entry went back onto history, so a second undo works.
    expect(tableHistoryManager.undo(a)).toBe(true);
    expect(a.getAttribute("data-formatted")).toBe(null);
  });

  it("redo restores the state at undo time, not at entry-creation time", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    // Like typing in a contenteditable: a mutation that never enters history.
    a.setAttribute("data-typed", "yes");

    // Undo restores the pre-op snapshot, so both mutations vanish.
    expect(tableHistoryManager.undo(a)).toBe(true);
    expect(a.getAttribute("data-formatted")).toBe(null);
    expect(a.getAttribute("data-typed")).toBe(null);

    // Redo returns the user to exactly the state the undo destroyed.
    expect(tableHistoryManager.redo(a)).toBe(true);
    expect(a.getAttribute("data-formatted")).toBe("true");
    expect(a.getAttribute("data-typed")).toBe("yes");
  });

  it("redo works for a drag-style entry whose performOperation is a no-op", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    a.setAttribute("data-row-heights", "10px");

    // Drag-to-resize applies the change during the drag preview, then records
    // the entry with a no-op performOperation and a custom undoOperation that
    // restores the old value it closed over.
    const oldHeights = "10px";
    a.setAttribute("data-row-heights", "20px");
    tableHistoryManager.addHistoryEntry(
      a,
      "Resize Row 0",
      () => {},
      (t) => t.setAttribute("data-row-heights", oldHeights),
    );

    expect(tableHistoryManager.undo(a)).toBe(true);
    expect(a.getAttribute("data-row-heights")).toBe("10px");

    // If redo's snapshot had been taken inside addHistoryEntry ("after
    // performOperation"), it would equal the pre-snapshot and this would fail.
    expect(tableHistoryManager.redo(a)).toBe(true);
    expect(a.getAttribute("data-row-heights")).toBe("20px");
  });

  it("refuses to redo an entry belonging to a different table", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");
    const bContentBefore = b.innerHTML;

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    expect(tableHistoryManager.undo(a)).toBe(true);

    expect(tableHistoryManager.redo(b)).toBe(false);
    expect(b.innerHTML).toBe(bContentBefore);
    expect(b.getAttribute("data-formatted")).toBe(null);
    expect(tableHistoryManager.canRedo()).toBe(true);

    expect(tableHistoryManager.redo(a)).toBe(true);
    expect(a.getAttribute("data-formatted")).toBe("true");
  });

  it("a new operation clears redo for its own table only", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    tableHistoryManager.addHistoryEntry(b, "Format B", () => {
      b.setAttribute("data-formatted", "true");
    });
    expect(tableHistoryManager.undo(b)).toBe(true);
    expect(tableHistoryManager.undo(a)).toBe(true);

    tableHistoryManager.addHistoryEntry(a, "Format A Again", () => {
      a.setAttribute("data-again", "true");
    });

    expect(tableHistoryManager.canRedo(a)).toBe(false);
    expect(tableHistoryManager.canRedo(b)).toBe(true);
    expect(tableHistoryManager.redo(b)).toBe(true);
    expect(b.getAttribute("data-formatted")).toBe("true");
  });

  it("redoLast returns false once a detached table's redo entries are pruned, and redoes the newest live entry", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    expect(tableHistoryManager.undo(a)).toBe(true);
    tableHistoryManager.detachTable(a);
    a.remove();

    // Eager pruning emptied the redo stack the moment A detached.
    expect(tableHistoryManager.redoLast()).toBe(false);
    expect(tableHistoryManager.canRedo()).toBe(false);

    // The positive case: redoLast acts on the newest entry whose table lives.
    tableHistoryManager.addHistoryEntry(b, "Format B", () => {
      b.setAttribute("data-formatted", "true");
    });
    expect(tableHistoryManager.undo(b)).toBe(true);
    expect(tableHistoryManager.redoLast()).toBe(true);
    expect(b.getAttribute("data-formatted")).toBe("true");
  });

  it("a failed redo leaves the entry on the redo stack", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const a = makeTable("a", "<div class='bloom-cell'>A</div>");
      tableHistoryManager.addHistoryEntry(a, "Format A", () => {
        a.setAttribute("data-formatted", "true");
      });
      expect(tableHistoryManager.undo(a)).toBe(true);

      // Make the full-state restore throw when it writes innerHTML.
      Object.defineProperty(a, "innerHTML", {
        configurable: true,
        set() {
          throw new Error("boom");
        },
      });

      expect(tableHistoryManager.redo(a)).toBe(false);
      expect(tableHistoryManager.canRedo()).toBe(true);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("tableHistoryManager eager pruning on detach", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("detaching a table immediately empties its undo entries", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });

    tableHistoryManager.detachTable(a);

    // No undoLast call needed: canUndo tells the truth right away.
    expect(tableHistoryManager.canUndo()).toBe(false);
    expect(tableHistoryManager.getEntriesForDebug()).toEqual([]);
  });

  it("prunes per table, leaving other tables' entries undoable", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");
    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    tableHistoryManager.addHistoryEntry(b, "Format B", () => {
      b.setAttribute("data-formatted", "true");
    });

    tableHistoryManager.detachTable(a);

    expect(tableHistoryManager.canUndo()).toBe(true);
    expect(tableHistoryManager.getEntriesForDebug().map((e) => e.label)).toEqual(["Format B"]);
    expect(tableHistoryManager.undo(b)).toBe(true);
    expect(b.getAttribute("data-formatted")).toBe(null);
  });

  it("prunes redo entries too", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    expect(tableHistoryManager.undo(a)).toBe(true);

    tableHistoryManager.detachTable(a);

    expect(tableHistoryManager.canRedo()).toBe(false);
    expect(tableHistoryManager.getRedoEntriesForDebug()).toEqual([]);
  });

  it("dispatches tableHistoryUpdated only when something was removed", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });

    const listener = vi.fn();
    document.addEventListener("tableHistoryUpdated", listener);
    try {
      tableHistoryManager.detachTable(a);
      expect(listener).toHaveBeenCalledTimes(1);
      expect((listener.mock.calls[0][0] as CustomEvent).detail.operation).toBe("Detach Table");

      // A table with no entries produces no event noise.
      const c = makeTable("c", "<div class='bloom-cell'>C</div>");
      tableHistoryManager.detachTable(c);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("tableHistoryUpdated", listener);
    }
  });

  it("detaching a nested table leaves the outer table's entries alone", () => {
    const outer = makeTable(
      "outer",
      "<div class='bloom-cell'><div class='bloom-table' id='nested'><div class='bloom-cell'>N</div></div></div>",
    );
    const nested = outer.querySelector<HTMLElement>("#nested")!;
    tableHistoryManager.attachTable(nested);

    // Entries are keyed to the TOP-LEVEL table even when added via the nested one.
    tableHistoryManager.addHistoryEntry(nested, "Format Outer", () => {
      outer.setAttribute("data-formatted", "true");
    });

    tableHistoryManager.detachTable(nested);

    expect(tableHistoryManager.canUndo()).toBe(true);
    expect(tableHistoryManager.undo(outer)).toBe(true);
    expect(outer.getAttribute("data-formatted")).toBe(null);
  });
});

describe("tableHistoryManager per-table cap", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("evicts the oldest same-table entry at the cap", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    for (let i = 1; i <= 55; i++) {
      tableHistoryManager.addHistoryEntry(a, `Op ${i}`, () => {
        a.setAttribute("data-op", String(i));
      });
    }
    const labels = tableHistoryManager.getEntriesForDebug().map((e) => e.label);
    expect(labels.length).toBe(50);
    expect(labels[0]).toBe("Op 6");
    expect(labels[49]).toBe("Op 55");
  });

  it("one table's churn cannot evict another table's entries", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");
    tableHistoryManager.addHistoryEntry(b, "Format B", () => {
      b.setAttribute("data-formatted", "true");
    });
    for (let i = 1; i <= 55; i++) {
      tableHistoryManager.addHistoryEntry(a, `Op ${i}`, () => {
        a.setAttribute("data-op", String(i));
      });
    }
    const labels = tableHistoryManager.getEntriesForDebug().map((e) => e.label);
    expect(labels).toContain("Format B");
    expect(labels.length).toBe(51);
  });
});

describe("table-aware canUndo/canRedo", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("reports per table whether undo/redo would actually act", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    const b = makeTable("b", "<div class='bloom-cell'>B</div>");

    tableHistoryManager.addHistoryEntry(a, "Format A", () => {
      a.setAttribute("data-formatted", "true");
    });
    expect(tableHistoryManager.canUndo()).toBe(true);
    expect(tableHistoryManager.canUndo(a)).toBe(true);
    expect(tableHistoryManager.canUndo(b)).toBe(false);

    expect(tableHistoryManager.undo(a)).toBe(true);
    expect(tableHistoryManager.canRedo(a)).toBe(true);
    expect(tableHistoryManager.canRedo(b)).toBe(false);
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

describe("tableHistoryManager nested-table routing", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("an entry added via a nested table snapshots and restores the OUTER table", () => {
    const outer = makeTable(
      "outer",
      // The nested table carries its size attributes, as any table that has
      // been attached does: the restore re-attaches it, and attachTable invents
      // a default 2x2 grid for a table that has none.
      "<div class='bloom-cell'><div class='bloom-table' id='inner' " +
        "data-column-widths='hug' data-row-heights='hug'>" +
        "<div class='bloom-cell'>nested</div></div></div>",
    );
    const inner = outer.querySelector<HTMLElement>("#inner")!;
    // Only the outer table is attached; entries are keyed to the top level.

    const ok = tableHistoryManager.addHistoryEntry(inner, "Edit Inner", () => {
      inner.querySelector(".bloom-cell")!.textContent = "changed";
      outer.setAttribute("data-outer-mark", "1");
    });
    expect(ok).toBe(true);
    // canUndo asked with the inner table resolves to the outer entry.
    expect(tableHistoryManager.canUndo(inner)).toBe(true);

    // Undo via the inner table restores the whole outer table's state.
    expect(tableHistoryManager.undo(inner)).toBe(true);
    expect(outer.querySelector("#inner .bloom-cell")!.textContent).toBe("nested");
    expect(outer.hasAttribute("data-outer-mark")).toBe(false);
  });
});

describe("tableHistoryManager reentrancy", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("a nested addHistoryEntry inside performOperation is refused; one entry results", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const a = makeTable("a", "<div class='bloom-cell'>A</div>");
      let nestedResult: boolean | null = null;
      const ok = tableHistoryManager.addHistoryEntry(a, "Outer Op", () => {
        a.setAttribute("data-outer", "1");
        nestedResult = tableHistoryManager.addHistoryEntry(a, "Nested Op", () => {
          a.setAttribute("data-nested", "1");
        });
      });
      expect(ok).toBe(true);
      expect(nestedResult).toBe(false);
      // The nested op never ran and left no entry: exactly one undo works.
      expect(a.hasAttribute("data-nested")).toBe(false);
      expect(tableHistoryManager.undo(a)).toBe(true);
      expect(a.hasAttribute("data-outer")).toBe(false);
      expect(tableHistoryManager.canUndo()).toBe(false);
    } finally {
      consoleWarn.mockRestore();
    }
  });
});

describe("tableHistoryManager default undo restores attributes", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  it("removes attributes the operation added and restores ones it removed", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");
    a.setAttribute("data-keep-me", "original");

    tableHistoryManager.addHistoryEntry(a, "Attr Churn", () => {
      a.setAttribute("data-added", "new");
      a.removeAttribute("data-keep-me");
      a.setAttribute("id", "renamed");
    });
    expect(a.getAttribute("data-added")).toBe("new");
    expect(a.hasAttribute("data-keep-me")).toBe(false);

    expect(tableHistoryManager.undo(a)).toBe(true);
    expect(a.hasAttribute("data-added")).toBe(false);
    expect(a.getAttribute("data-keep-me")).toBe("original");
    expect(a.id).toBe("a");
  });
});

describe("tableHistoryManager re-attaches nested tables after a restore", () => {
  const nestedHtml =
    "<div class='bloom-cell'><div class='bloom-table' id='inner' " +
    "data-column-widths='hug' data-row-heights='hug'>" +
    "<div class='bloom-cell'>N</div></div></div>";

  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    // Put the real re-attacher back; these tests swap in a recorder.
    setRestoreReattacher(attachTable);
  });

  it("undo hands the restored nested table to the registered re-attacher", () => {
    const reattached: HTMLElement[] = [];
    setRestoreReattacher((t) => reattached.push(t));
    const outer = makeTable("outer", nestedHtml);

    tableHistoryManager.addHistoryEntry(outer, "Drop Nested", () => {
      outer.innerHTML = "<div class='bloom-cell'>plain</div>";
    });
    expect(outer.querySelector("#inner")).toBe(null);

    expect(tableHistoryManager.undo(outer)).toBe(true);
    const inner = outer.querySelector<HTMLElement>("#inner")!;
    // The nested table is back as a FRESH element, and it is the element the
    // re-attacher was given (not the one the snapshot was taken from).
    expect(inner).toBeTruthy();
    expect(reattached).toEqual([inner]);
  });

  it("redo hands the nested table it restores to the re-attacher too", () => {
    const outer = makeTable("outer", "<div class='bloom-cell'>plain</div>");
    tableHistoryManager.addHistoryEntry(outer, "Add Nested", () => {
      outer.innerHTML = nestedHtml;
    });
    expect(tableHistoryManager.undo(outer)).toBe(true);

    const reattached: HTMLElement[] = [];
    setRestoreReattacher((t) => reattached.push(t));
    expect(tableHistoryManager.redo(outer)).toBe(true);
    const inner = outer.querySelector<HTMLElement>("#inner")!;
    expect(inner).toBeTruthy();
    expect(reattached).toEqual([inner]);
  });
});

describe("a history entry records the table its operation acted on", () => {
  const nestedHtml =
    "<div class='bloom-cell' data-content-type='table'>" +
    "<div class='bloom-table' id='inner' data-column-widths='40px,40px' data-row-heights='20px'>" +
    "<div class='bloom-cell'>N1</div><div class='bloom-cell'>N2</div></div></div>";

  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  function build(): { outer: HTMLElement; inner: HTMLElement } {
    const outer = makeTable("outer", nestedHtml);
    outer.setAttribute("data-column-widths", "200px");
    outer.setAttribute("data-row-heights", "150px");
    const inner = outer.querySelector<HTMLElement>("#inner")!;
    return { outer, inner };
  }

  it("undoes a nested column resize on the NESTED table, leaving the outer one alone", () => {
    const { outer, inner } = build();
    // What drag-to-resize records: the change is already applied, and the undo
    // closure puts one column of the table it is handed back to its old value.
    inner.setAttribute("data-column-widths", "90px,40px");
    tableHistoryManager.addHistoryEntry(
      inner,
      "Resize Column 1 to 90px",
      () => {},
      (table) => {
        const widths = (table.getAttribute("data-column-widths") || "").split(",");
        widths[0] = "40px";
        table.setAttribute("data-column-widths", widths.join(","));
      },
    );

    expect(tableHistoryManager.undo(inner)).toBe(true);
    // The closure ran against the nested table...
    expect(
      outer.querySelector<HTMLElement>("#inner")!.getAttribute("data-column-widths"),
    ).toBe("40px,40px");
    // ...and the outer table's own widths were never touched. Handing the
    // closure the outer table wrote the nested value onto it instead.
    expect(outer.getAttribute("data-column-widths")).toBe("200px");
  });

  it("undoes a nested row resize the same way", () => {
    const { outer, inner } = build();
    inner.setAttribute("data-row-heights", "31.8mm");
    tableHistoryManager.addHistoryEntry(
      inner,
      "Resize Row 1 to 31.8mm",
      () => {},
      (table) => {
        const heights = (table.getAttribute("data-row-heights") || "").split(",");
        heights[0] = "20px";
        table.setAttribute("data-row-heights", heights.join(","));
      },
    );

    expect(tableHistoryManager.undo(inner)).toBe(true);
    expect(outer.querySelector<HTMLElement>("#inner")!.getAttribute("data-row-heights")).toBe(
      "20px",
    );
    expect(outer.getAttribute("data-row-heights")).toBe("150px");
  });

  it("redoes a nested resize, restoring the nested value and no other", () => {
    const { outer, inner } = build();
    inner.setAttribute("data-column-widths", "90px,40px");
    tableHistoryManager.addHistoryEntry(
      inner,
      "Resize Column 1 to 90px",
      () => {},
      (table) => table.setAttribute("data-column-widths", "40px,40px"),
    );
    expect(tableHistoryManager.undo(inner)).toBe(true);
    expect(tableHistoryManager.redo(outer)).toBe(true);

    expect(
      outer.querySelector<HTMLElement>("#inner")!.getAttribute("data-column-widths"),
    ).toBe("90px,40px");
    expect(outer.getAttribute("data-column-widths")).toBe("200px");
  });

  it("resolves the nested table again after a later undo replaced its element", () => {
    const { outer, inner } = build();
    const originalInner = inner;

    // Older entry: a resize of the nested table.
    inner.setAttribute("data-column-widths", "90px,40px");
    tableHistoryManager.addHistoryEntry(
      inner,
      "Resize Column 1 to 90px",
      () => {},
      (table) => table.setAttribute("data-column-widths", "40px,40px"),
    );
    // Newer entry, undone FIRST: its restore rewrites the outer table's
    // innerHTML, so the nested table comes back as a fresh element and the
    // older entry's own element is stale.
    tableHistoryManager.addHistoryEntry(outer, "Clear", () => {
      outer.innerHTML = "<div class='bloom-cell'>gone</div>";
    });

    expect(tableHistoryManager.undo(outer)).toBe(true);
    const restoredInner = outer.querySelector<HTMLElement>("#inner")!;
    expect(restoredInner).not.toBe(originalInner);
    expect(restoredInner.getAttribute("data-column-widths")).toBe("90px,40px");

    // Undo the older entry: it must act on the element that is in the document
    // now, not on the one it was created with.
    expect(tableHistoryManager.undo(outer)).toBe(true);
    expect(
      outer.querySelector<HTMLElement>("#inner")!.getAttribute("data-column-widths"),
    ).toBe("40px,40px");
    expect(originalInner.getAttribute("data-column-widths")).toBe("90px,40px");
    expect(outer.getAttribute("data-column-widths")).toBe("200px");
  });
});

describe("an entry's detail", () => {
  beforeEach(() => {
    tableHistoryManager.reset();
    document.body.innerHTML = "";
  });

  // Every "tableHistoryUpdated" event fired while fn runs.
  function eventsDuring(fn: () => void): { operation: string; operationDetail?: string }[] {
    const seen: { operation: string; operationDetail?: string }[] = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      seen.push({ operation: d.operation, operationDetail: d.operationDetail });
    };
    document.addEventListener("tableHistoryUpdated", listener);
    try {
      fn();
    } finally {
      document.removeEventListener("tableHistoryUpdated", listener);
    }
    return seen;
  }

  it("rides along on the record, the undo, and the redo events", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");

    const recorded = eventsDuring(() => {
      tableHistoryManager.addHistoryEntry(
        a,
        { label: "Set Corners", detail: "radius 8, row 2 (2 cells)" },
        () => a.setAttribute("data-corners", "8"),
      );
    });
    expect(recorded).toEqual([
      { operation: "Set Corners", operationDetail: "radius 8, row 2 (2 cells)" },
    ]);

    // The label stays short for tooltips; the detail travels beside it.
    expect(tableHistoryManager.getLastOperationLabel()).toBe("Set Corners");
    expect(tableHistoryManager.getEntriesForDebug()).toMatchObject([
      { label: "Set Corners", detail: "radius 8, row 2 (2 cells)" },
    ]);

    const undone = eventsDuring(() => {
      expect(tableHistoryManager.undo(a)).toBe(true);
    });
    expect(undone).toEqual([
      { operation: "Undo Set Corners", operationDetail: "radius 8, row 2 (2 cells)" },
    ]);

    const redone = eventsDuring(() => {
      expect(tableHistoryManager.redo(a)).toBe(true);
    });
    expect(redone).toEqual([
      { operation: "Redo Set Corners", operationDetail: "radius 8, row 2 (2 cells)" },
    ]);
  });

  it("is absent when the caller passes a label alone", () => {
    const a = makeTable("a", "<div class='bloom-cell'>A</div>");

    const recorded = eventsDuring(() => {
      tableHistoryManager.addHistoryEntry(a, "Delete Table", () => {
        a.setAttribute("data-deleted", "true");
      });
    });
    expect(recorded).toEqual([{ operation: "Delete Table", operationDetail: undefined }]);
    expect(tableHistoryManager.getEntriesForDebug()[0].detail).toBeUndefined();
  });
});
