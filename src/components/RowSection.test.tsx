import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import TableMenu from "./TableMenu";
import { defaultTableApi, TableApi } from "./TableApiContext";
import { BloomTable } from "../BloomTable";
import { attachTable } from "../attach";
import { tableHistoryManager } from "../history";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the Row section of the panel", () => {
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
      addRowAt(index: number): void {
        calls.push(`addRowAt(${index})`);
        super.addRowAt(index);
      }
      removeRowAt(index: number): void {
        calls.push(`removeRowAt(${index})`);
        super.removeRowAt(index);
      }
      setRowHeight(index: number, value: string): void {
        calls.push(`setRowHeight(${index}, ${value})`);
        super.setRowHeight(index, value);
      }
    }
    return { ...defaultTableApi, BloomTable: Recording };
  }

  function makeAttachedTable(
    rowHeights = "hug,hug",
    texts = ["A", "B", "C", "D"],
  ): { table: HTMLElement; cells: HTMLElement[] } {
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", "hug,hug");
    table.setAttribute("data-row-heights", rowHeights);
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
        '[role="radiogroup"][aria-label="Row size"] [role="radio"]',
      ),
    );

  const checkedSize = (): string | undefined =>
    sizeTiles()
      .find((tile) => tile.getAttribute("aria-checked") === "true")
      ?.getAttribute("aria-label") ?? undefined;

  const heightsOf = (table: HTMLElement): string[] =>
    table.getAttribute("data-row-heights")!.split(",");

  const textsOf = (table: HTMLElement): (string | null)[] =>
    Array.from(table.querySelectorAll(".bloom-cell")).map((c) => c.textContent);

  describe("Add and Remove", () => {
    it("inserts a row at the index of the row the selected cell sits in", () => {
      const { table, cells } = makeAttachedTable();
      mount(cells[2], recordingApi()); // "C", row 1

      click(button("Insert Row Above"));

      expect(calls).toEqual(["addRowAt(1)"]);
      expect(textsOf(table)).toEqual(["A", "B", "", "", "C", "D"]);
    });

    it("inserts a row one past the row the selected cell sits in", () => {
      const { table, cells } = makeAttachedTable();
      mount(cells[0], recordingApi()); // "A", row 0

      click(button("Insert Row Below"));

      expect(calls).toEqual(["addRowAt(1)"]);
      expect(textsOf(table)).toEqual(["A", "B", "", "", "C", "D"]);
    });

    it("removes the row the selected cell sits in, not another one", () => {
      const { table, cells } = makeAttachedTable();
      mount(cells[2], recordingApi()); // "C", row 1

      click(button("Delete Row"));

      expect(calls).toEqual(["removeRowAt(1)"]);
      expect(textsOf(table)).toEqual(["A", "B"]);
    });

    it("leaves all three buttons inoperable while no cell is selected", () => {
      mount(null, recordingApi());

      expect(button("Insert Row Above").disabled).toBe(true);
      expect(button("Insert Row Below").disabled).toBe(true);
      expect(button("Delete Row").disabled).toBe(true);
    });

    it("disables Delete Row on a table that has only one row", () => {
      const { cells } = makeAttachedTable("hug", ["A", "B"]);
      mount(cells[0], recordingApi());

      expect(button("Delete Row").disabled).toBe(true);
    });
  });

  describe("the Size control", () => {
    it("shows Hug for a row the model sizes to its contents", () => {
      const { cells } = makeAttachedTable("hug,fill");
      mount(cells[0], recordingApi()); // row 0

      expect(checkedSize()).toBe("Hug");
    });

    it("shows Grow for a row the model sizes to fill the table", () => {
      const { cells } = makeAttachedTable("hug,fill");
      mount(cells[2], recordingApi()); // row 1

      expect(checkedSize()).toBe("Grow");
    });

    it("shows the row's own measurement on the third tile when the height is fixed", () => {
      const { cells } = makeAttachedTable("10mm,hug");
      mount(cells[0], recordingApi());

      expect(checkedSize()).toBe("10\nmm");
    });

    it("writes fill for the selected cell's row when Grow is chosen", () => {
      const { table, cells } = makeAttachedTable("hug,hug");
      mount(cells[2], recordingApi()); // row 1

      click(sizeTiles()[0]);

      expect(calls).toEqual(["setRowHeight(1, fill)"]);
      expect(heightsOf(table)).toEqual(["hug", "fill"]);
    });

    it("writes hug for the selected cell's row when Hug is chosen", () => {
      const { table, cells } = makeAttachedTable("fill,fill");
      mount(cells[0], recordingApi()); // row 0

      click(sizeTiles()[1]);

      expect(calls).toEqual(["setRowHeight(0, hug)"]);
      expect(heightsOf(table)).toEqual(["hug", "fill"]);
    });

    it("writes ten millimetres when Fixed is chosen for a row that has no measurement", () => {
      const { table, cells } = makeAttachedTable("hug,hug");
      mount(cells[0], recordingApi());

      click(sizeTiles()[2]);

      expect(calls).toEqual(["setRowHeight(0, 10mm)"]);
      expect(heightsOf(table)).toEqual(["10mm", "hug"]);
    });

    it("keeps the row's existing measurement when Fixed is chosen again", () => {
      const { table, cells } = makeAttachedTable("20mm,hug");
      mount(cells[0], recordingApi());

      click(sizeTiles()[2]);

      expect(calls).toEqual(["setRowHeight(0, 20mm)"]);
      expect(heightsOf(table)).toEqual(["20mm", "hug"]);
    });

    it("follows the row a divider drag names rather than the selected cell's row", () => {
      const { table, cells } = makeAttachedTable("hug,fill");
      table.setAttribute("data-ui-active-row-index", "1");
      mount(cells[0], recordingApi()); // the selected cell is in row 0

      expect(checkedSize()).toBe("Grow");

      click(sizeTiles()[1]);

      expect(calls).toEqual(["setRowHeight(1, hug)"]);
      expect(heightsOf(table)).toEqual(["hug", "hug"]);
    });
  });
});
