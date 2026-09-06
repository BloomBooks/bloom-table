import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { defaultTableApi, TableApi } from "./TableApiContext";
import TableMenu from "./TableMenu";
import { attachTable } from "../attach";
import { tableHistoryManager } from "../history";
import * as Structure from "../structure";
import { BloomTable } from "../BloomTable";
import { setupContentsOfCell, contentTypeOptions, getCurrentContentTypeId } from "../cell-contents";
import { render as renderTable } from "../table-renderer";
import {
  applyCellPerimeter,
  ensureEdgesArrays,
  applyUniformInner,
  setDefaultBorder,
  applyOuterBorders,
} from "../edge-utils";
import { getCellPerimeterValueMap, getTableOuterBorderValueMap } from "../border-state";
import {
  getCellAlign,
  setCellAlign,
  getCellCorners,
  setCellCorners,
  getCellPadding,
  setCellPadding,
  getCellBackground,
  setCellBackground,
  getTableBackground,
  setTableBackground,
  getGapX,
  setGapX,
  getGapY,
  setGapY,
} from "../table-model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("defaultTableApi", () => {
  it("maps every method to the library function it wraps", () => {
    const expected: Record<keyof TableApi, unknown> = {
      BloomTable,
      getRowIndex: Structure.getRowIndex,
      getRowAndColumn: Structure.getRowAndColumn,
      canUndo: Structure.canUndo,
      undoLastOperation: Structure.undoLastOperation,
      getTargetTable: Structure.getTargetTable,
      setupContentsOfCell,
      contentTypeOptions,
      getCurrentContentTypeId,
      render: renderTable,
      applyCellPerimeter,
      ensureEdgesArrays,
      applyUniformInner,
      setDefaultBorder,
      applyOuterBorders,
      getCellPerimeterValueMap,
      getTableOuterBorderValueMap,
      getCellAlign,
      setCellAlign,
      getCellCorners,
      setCellCorners,
      getCellPadding,
      setCellPadding,
      getCellBackground,
      setCellBackground,
      getTableBackground,
      setTableBackground,
      getGapX,
      setGapX,
      getGapY,
      setGapY,
    };

    for (const [name, fn] of Object.entries(expected)) {
      expect(defaultTableApi[name as keyof TableApi]).toBe(fn);
    }
  });

  it("carries no member the interface does not name", () => {
    // A member left out of the interface is a member a host cannot know to
    // provide, and the panel would then call it on an injected api that has
    // no such function.
    const expectedNames = [
      "BloomTable",
      "getRowIndex",
      "getRowAndColumn",
      "canUndo",
      "undoLastOperation",
      "getTargetTable",
      "setupContentsOfCell",
      "contentTypeOptions",
      "getCurrentContentTypeId",
      "render",
      "applyCellPerimeter",
      "ensureEdgesArrays",
      "applyUniformInner",
      "setDefaultBorder",
      "applyOuterBorders",
      "getCellPerimeterValueMap",
      "getTableOuterBorderValueMap",
      "getCellAlign",
      "setCellAlign",
      "getCellCorners",
      "setCellCorners",
      "getCellPadding",
      "setCellPadding",
      "getCellBackground",
      "setCellBackground",
      "getTableBackground",
      "setTableBackground",
      "getGapX",
      "setGapX",
      "getGapY",
      "setGapY",
    ];
    expect(Object.keys(defaultTableApi).sort()).toEqual([...expectedNames].sort());
  });
});

describe("a table api injected into TableMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function makeAttachedTable(): { table: HTMLElement; cells: HTMLElement[] } {
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", "hug,hug");
    table.setAttribute("data-row-heights", "hug,hug");
    for (const text of ["A", "B", "C", "D"]) {
      const cell = document.createElement("div");
      cell.className = "bloom-cell";
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      editable.textContent = text;
      cell.appendChild(editable);
      table.appendChild(cell);
    }
    document.body.appendChild(table);
    attachTable(table);
    return { table, cells: Array.from(table.children) as HTMLElement[] };
  }

  // A host's api: every method spied on, each still doing the real work, so the
  // panel behaves normally while the test can see which object it called.
  function makeSpyingApi(): { api: TableApi; spies: Record<string, ReturnType<typeof vi.fn>> } {
    const spies: Record<string, ReturnType<typeof vi.fn>> = {};
    const api = { ...defaultTableApi } as unknown as Record<string, unknown>;
    for (const [name, member] of Object.entries(defaultTableApi)) {
      if (name === "BloomTable" || typeof member !== "function") continue;
      const spy = vi.fn((...args: unknown[]) => (member as (...a: unknown[]) => unknown)(...args));
      spies[name] = spy;
      api[name] = spy;
    }
    return { api: api as unknown as TableApi, spies };
  }

  const mount = (currentCell: HTMLElement | null, api?: TableApi) => {
    act(() => root.render(<TableMenu currentCell={currentCell} tableApi={api} />));
  };

  const button = (label: string): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  const click = (el: HTMLElement) => {
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  };

  it("reads the selected cell's position through the injected api", () => {
    const { cells } = makeAttachedTable();
    const { api, spies } = makeSpyingApi();

    mount(cells[1], api);

    expect(spies.getRowAndColumn).toHaveBeenCalled();
  });

  it("runs a structural command on the injected controller, not the default one", () => {
    const { table, cells } = makeAttachedTable();
    const constructed: HTMLElement[] = [];
    class HostBloomTable extends BloomTable {
      constructor(element: HTMLElement) {
        super(element);
        constructed.push(element);
      }
    }
    const api: TableApi = { ...defaultTableApi, BloomTable: HostBloomTable };

    mount(cells[0], api);
    click(button("Insert Row Below"));

    expect(constructed).toContain(table);
    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(3);
  });

  it("undoes through the injected api, which is the manager holding the table", () => {
    const { table, cells } = makeAttachedTable();
    const { api, spies } = makeSpyingApi();

    mount(cells[0], api);
    click(button("Insert Row Below"));

    const undo = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Undo",
    )!;
    click(undo);

    expect(spies.undoLastOperation).toHaveBeenCalled();
    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(2);
  });

  it("lets the injected controller decide whether Undo is offered", () => {
    // The panel asks a controller built from api.BloomTable, not the bare
    // canUndo, so the answer is about the selected table rather than about
    // whichever table wrote the newest history entry.
    const { cells } = makeAttachedTable();
    class AlwaysUndoable extends BloomTable {
      canUndo(): boolean {
        return true;
      }
    }
    const api: TableApi = { ...defaultTableApi, BloomTable: AlwaysUndoable };

    mount(cells[0], api);

    const undo = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Undo",
    )!;
    expect(undo.disabled).toBe(false);
  });

  it("disables Undo when the injected controller says the table has no history", () => {
    const { cells } = makeAttachedTable();
    class NeverUndoable extends BloomTable {
      canUndo(): boolean {
        return false;
      }
    }
    const api: TableApi = { ...defaultTableApi, BloomTable: NeverUndoable };

    mount(cells[0], api);
    click(button("Insert Row Below"));

    const undo = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Undo",
    )!;
    expect(undo.disabled).toBe(true);
  });

  it("obeys the injected api rather than the module's own answer", () => {
    // The injected getRowIndex always says row 0. Selecting a cell in row 1
    // and inserting below must therefore land the new row at index 1, which
    // is what the injected answer asks for and not what the real function
    // would have said.
    const { table, cells } = makeAttachedTable();
    const api: TableApi = { ...defaultTableApi, getRowIndex: () => 0 };

    mount(cells[2], api); // "C", row 1
    click(button("Insert Row Below"));

    const texts = Array.from(table.querySelectorAll(".bloom-cell")).map((c) => c.textContent);
    expect(texts).toEqual(["A", "B", "", "", "C", "D"]);
  });

  it("uses this module's own functions when the host injects nothing", () => {
    const { table, cells } = makeAttachedTable();

    mount(cells[0]);
    click(button("Insert Row Below"));

    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(3);
  });
});
