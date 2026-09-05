import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import TableMenu from "./TableMenu";
import { defaultTableApi, TableApi } from "./TableApiContext";
import { BloomTable } from "../BloomTable";
import { attachTable } from "../attach";
import { tableHistoryManager } from "../history";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the Column section of the panel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let calls: string[];

  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
    calls = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The panel reaches the table only through api.BloomTable, so a subclass that
  // notes each call and then does the real work shows which method ran and with
  // which index, while the table still changes as it normally would.
  function recordingApi(): TableApi {
    class Recording extends BloomTable {
      addColumnAt(index: number): void {
        calls.push(`addColumnAt(${index})`);
        super.addColumnAt(index);
      }
      removeColumnAt(index: number): void {
        calls.push(`removeColumnAt(${index})`);
        super.removeColumnAt(index);
      }
      setColumnWidth(index: number, value: string): void {
        calls.push(`setColumnWidth(${index}, ${value})`);
        super.setColumnWidth(index, value);
      }
    }
    return { ...defaultTableApi, BloomTable: Recording };
  }

  function makeAttachedTable(
    columnWidths = "hug,hug",
    texts = ["A", "B", "C", "D"],
  ): { table: HTMLElement; cells: HTMLElement[] } {
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", columnWidths);
    table.setAttribute("data-row-heights", "hug,hug");
    for (const text of texts) {
      const cell = document.createElement("div");
      cell.className = "bloom-cell";
      cell.setAttribute("data-content-type", "text");
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

  const mount = (currentCell: HTMLElement | null, api?: TableApi) => {
    act(() => root.render(<TableMenu currentCell={currentCell} tableApi={api} />));
  };

  const button = (label: string): HTMLButtonElement => {
    const el = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!el) throw new Error(`No button labeled "${label}"`);
    return el;
  };

  const click = (el: HTMLElement) => {
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  };

  const sizeTiles = (): HTMLElement[] =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        '[role="radiogroup"][aria-label="Column size"] [role="radio"]',
      ),
    );

  const checkedSize = (): string | undefined =>
    sizeTiles()
      .find((tile) => tile.getAttribute("aria-checked") === "true")
      ?.getAttribute("aria-label") ?? undefined;

  const widthsOf = (table: HTMLElement): string[] =>
    table.getAttribute("data-column-widths")!.split(",");

  const textsOf = (table: HTMLElement): (string | null)[] =>
    Array.from(table.querySelectorAll(".bloom-cell")).map((c) => c.textContent);

  describe("Add and Remove", () => {
    it("inserts a column at the index of the column the selected cell sits in", () => {
      const { table, cells } = makeAttachedTable();
      mount(cells[1], recordingApi()); // "B", column 1

      click(button("Insert Column Left"));

      expect(calls).toEqual(["addColumnAt(1)"]);
      expect(textsOf(table)).toEqual(["A", "", "B", "C", "", "D"]);
    });

    it("inserts a column one past the column the selected cell sits in", () => {
      const { table, cells } = makeAttachedTable();
      mount(cells[0], recordingApi()); // "A", column 0

      click(button("Insert Column Right"));

      expect(calls).toEqual(["addColumnAt(1)"]);
      expect(textsOf(table)).toEqual(["A", "", "B", "C", "", "D"]);
    });

    it("removes the column the selected cell sits in, not another one", () => {
      const { table, cells } = makeAttachedTable();
      mount(cells[1], recordingApi()); // "B", column 1

      click(button("Delete Column"));

      expect(calls).toEqual(["removeColumnAt(1)"]);
      expect(textsOf(table)).toEqual(["A", "C"]);
    });

    it("leaves all three buttons inoperable while no cell is selected", () => {
      mount(null, recordingApi());

      expect(button("Insert Column Left").disabled).toBe(true);
      expect(button("Insert Column Right").disabled).toBe(true);
      expect(button("Delete Column").disabled).toBe(true);
    });

    // DEFECT: the panel never disables Delete Column, so on a one-column table
    // the click reaches removeColumnAt, which throws "Cannot remove the only
    // column".
    it.fails("disables Delete Column on a table that has only one column", () => {
      const { cells } = makeAttachedTable("hug", ["A", "C"]);
      mount(cells[0], recordingApi());

      expect(button("Delete Column").disabled).toBe(true);
    });
  });

  describe("the Size control", () => {
    it("shows Hug for a column the model sizes to its contents", () => {
      const { cells } = makeAttachedTable("hug,fill");
      mount(cells[0], recordingApi()); // column 0

      expect(checkedSize()).toBe("Hug");
    });

    it("shows Grow for a column the model sizes to fill the table", () => {
      const { cells } = makeAttachedTable("hug,fill");
      mount(cells[1], recordingApi()); // column 1

      expect(checkedSize()).toBe("Grow");
    });

    it("shows the column's own measurement on the third tile when the width is fixed", () => {
      const { cells } = makeAttachedTable("10mm,hug");
      mount(cells[0], recordingApi());

      expect(checkedSize()).toBe("10\nmm");
    });

    it("writes fill for the selected cell's column when Grow is chosen", () => {
      const { table, cells } = makeAttachedTable("hug,hug");
      mount(cells[1], recordingApi()); // column 1

      click(sizeTiles()[0]);

      expect(calls).toEqual(["setColumnWidth(1, fill)"]);
      expect(widthsOf(table)).toEqual(["hug", "fill"]);
    });

    it("writes hug for the selected cell's column when Hug is chosen", () => {
      const { table, cells } = makeAttachedTable("fill,fill");
      mount(cells[0], recordingApi()); // column 0

      click(sizeTiles()[1]);

      expect(calls).toEqual(["setColumnWidth(0, hug)"]);
      expect(widthsOf(table)).toEqual(["hug", "fill"]);
    });

    it("writes ten millimetres when Fixed is chosen for a column that has no measurement", () => {
      const { table, cells } = makeAttachedTable("hug,hug");
      mount(cells[0], recordingApi());

      click(sizeTiles()[2]);

      expect(calls).toEqual(["setColumnWidth(0, 10mm)"]);
      expect(widthsOf(table)).toEqual(["10mm", "hug"]);
    });

    it("keeps the column's existing measurement when Fixed is chosen again", () => {
      const { table, cells } = makeAttachedTable("20mm,hug");
      mount(cells[0], recordingApi());

      click(sizeTiles()[2]);

      expect(calls).toEqual(["setColumnWidth(0, 20mm)"]);
      expect(widthsOf(table)).toEqual(["20mm", "hug"]);
    });
  });
});
