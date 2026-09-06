import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import TableMenu from "./TableMenu";
import { attachTable } from "../attach";
import { tableHistoryManager } from "../history";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("TableMenu panel", () => {
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
    const texts = ["A", "B", "C", "D"];
    for (const t of texts) {
      const cell = document.createElement("div");
      cell.className = "bloom-cell";
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      editable.textContent = t;
      cell.appendChild(editable);
      table.appendChild(cell);
    }
    document.body.appendChild(table);
    attachTable(table);
    return { table, cells: Array.from(table.children) as HTMLElement[] };
  }

  const mount = (currentCell: HTMLElement | null) => {
    act(() => {
      root.render(<TableMenu currentCell={currentCell} />);
    });
  };

  const button = (label: string): HTMLButtonElement => {
    const el = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!el) throw new Error(`No button labeled "${label}"`);
    return el;
  };

  // Undo, Redo and Select Parent Cell carry their names as text, not as labels.
  const textButton = (name: string): HTMLButtonElement => {
    const el = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === name,
    );
    if (!el) throw new Error(`No button reading "${name}"`);
    return el;
  };

  const click = (el: HTMLElement) => {
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  };

  const rowCount = (table: HTMLElement): number =>
    table.getAttribute("data-row-heights")!.split(",").length;

  const firstCell = (table: HTMLElement): HTMLElement =>
    table.querySelector<HTMLElement>(".bloom-cell")!;

  it("renders visibly disabled with a hint when there is no selected cell", () => {
    mount(null);
    expect(container.textContent).toContain("Click in a table cell to edit it.");
    expect(button("Insert Row Below").disabled).toBe(true);
    expect(button("Delete Column").disabled).toBe(true);
    const undo = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Undo",
    )!;
    expect(undo.disabled).toBe(true);
  });

  it("normalizes a focused descendant to its cell and inserts a row below it", () => {
    const { table, cells } = makeAttachedTable();
    // The host hands us the editable INSIDE the cell, not the cell itself.
    const editable = cells[1].querySelector<HTMLElement>("[contenteditable]")!;
    mount(editable);

    expect(button("Insert Row Below").disabled).toBe(false);
    click(button("Insert Row Below"));

    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(3);
    const after = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell"));
    expect(after.length).toBe(6);
    // The selected cell is in row 0, so the new row lands at index 1: the old
    // row-1 texts (C, D) are pushed down to row 2.
    expect(after[0].textContent).toBe("A");
    expect(after[1].textContent).toBe("B");
    expect(after[4].textContent).toBe("C");
    expect(after[5].textContent).toBe("D");
  });

  it("deletes the selected cell's column, not a neighbor's", () => {
    const { table, cells } = makeAttachedTable();
    mount(cells[1]); // r0c1 -> column 1 ("B"/"D")

    click(button("Delete Column"));

    expect(table.getAttribute("data-column-widths")!.split(",").length).toBe(1);
    const remaining = Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell")).map(
      (c) => c.textContent,
    );
    expect(remaining).toEqual(["A", "C"]);
  });

  it("refocuses the cell the selection actually sat in after an op moved it", () => {
    const { table, cells } = makeAttachedTable();
    mount(cells[2]); // "C", row 1 column 0

    // Insert above the selected row: the element stays, its row becomes 2.
    click(button("Insert Row Above"));
    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(3);
    expect(cells[2].isConnected).toBe(true);

    // A second operation, then undo it. Undo replaces every cell element, so
    // the panel refocuses by remembered position.
    click(button("Insert Row Below"));
    const undoButton = () =>
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Undo")!;
    click(undoButton());

    // Position (2,0) is where the selection was, and it holds "C". Focusing
    // (1,0) would mean the panel remembered the pre-insert coordinates.
    const focused = (document.activeElement as HTMLElement | null)?.closest(".bloom-cell");
    expect(focused?.textContent).toBe("C");
  });

  it("disables Merge for a cell whose span already reaches the last column", () => {
    const { cells } = makeAttachedTable(); // 2 columns

    mount(cells[1]); // column 1: nothing to the right
    expect(button("Merge").disabled).toBe(true);

    mount(cells[0]); // column 0: can merge with the cell to its right
    expect(button("Merge").disabled).toBe(false);

    click(button("Merge"));
    expect(cells[0].getAttribute("data-span-x")).toBe("2");
    // The span now reaches the last column, so Merge has nowhere left to go.
    expect(button("Merge").disabled).toBe(true);
  });

  it("the Undo button enables after an operation and undoes it on click", () => {
    const { table, cells } = makeAttachedTable();
    mount(cells[0]);

    const undoButton = () =>
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Undo")!;
    expect(undoButton().disabled).toBe(true);

    click(button("Insert Row Below"));
    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(3);
    expect(undoButton().disabled).toBe(false);

    click(undoButton());
    expect(table.getAttribute("data-row-heights")!.split(",").length).toBe(2);
    expect(table.querySelectorAll(".bloom-cell").length).toBe(4);
  });

  describe("as the focus moves", () => {
    it("drops the hint and enables the controls once a cell takes the focus", () => {
      const { cells } = makeAttachedTable();

      mount(null);
      expect(container.textContent).toContain("Click in a table cell to edit it.");

      mount(cells[0]);

      expect(container.textContent).not.toContain("Click in a table cell to edit it.");
      expect(button("Insert Row Below").disabled).toBe(false);
    });

    it("shows the hint again and disables the controls when the focus leaves the table", () => {
      const { cells } = makeAttachedTable();

      mount(cells[0]);
      mount(null);

      expect(container.textContent).toContain("Click in a table cell to edit it.");
      expect(button("Insert Row Below").disabled).toBe(true);
    });

    it("takes the disabled sections out of the tab order, not just out of the mouse's reach", () => {
      const { cells } = makeAttachedTable();
      const wrapper = () => container.querySelector<HTMLElement>('[aria-disabled="true"]');

      mount(null);
      expect((wrapper() as HTMLElement & { inert?: boolean }).inert).toBe(true);

      mount(cells[0]);
      expect(wrapper()).toBe(null);
    });

    it("acts on the table the newly focused cell belongs to", () => {
      const first = makeAttachedTable();
      const second = makeAttachedTable();

      mount(first.cells[0]);
      click(button("Insert Row Below"));
      mount(second.cells[0]);
      click(button("Insert Row Below"));

      expect(rowCount(first.table)).toBe(3);
      expect(rowCount(second.table)).toBe(3);
    });
  });

  describe("the Undo and Redo buttons with two tables on the page", () => {
    it("offers Undo for the table that has history, and not for the other one", () => {
      const first = makeAttachedTable();
      const second = makeAttachedTable();

      mount(first.cells[0]);
      click(button("Insert Row Below"));
      expect(textButton("Undo").disabled).toBe(false);

      // The newest entry in the manager belongs to the first table, so an
      // answer that ignored the selection would offer Undo here too.
      mount(second.cells[0]);
      expect(textButton("Undo").disabled).toBe(true);

      mount(first.cells[0]);
      expect(textButton("Undo").disabled).toBe(false);
    });

    it("offers Redo for the table whose operation was undone, and not for the other one", () => {
      const first = makeAttachedTable();
      const second = makeAttachedTable();

      mount(first.cells[0]);
      click(button("Insert Row Below"));
      click(textButton("Undo"));
      // Undo replaces every cell element, so the host reports the cell that
      // took the selection's place; the panel is given it as any host would.
      mount(firstCell(first.table));
      expect(textButton("Redo").disabled).toBe(false);

      mount(second.cells[0]);
      expect(textButton("Redo").disabled).toBe(true);
    });

    it("redoes the undone operation on the selected table", () => {
      const { table, cells } = makeAttachedTable();

      mount(cells[0]);
      click(button("Insert Row Below"));
      click(textButton("Undo"));
      expect(rowCount(table)).toBe(2);
      mount(firstCell(table));

      click(textButton("Redo"));

      expect(rowCount(table)).toBe(3);
    });

    it("offers neither button while no cell is selected", () => {
      const { cells } = makeAttachedTable();

      mount(cells[0]);
      click(button("Insert Row Below"));
      mount(null);

      expect(textButton("Undo").disabled).toBe(true);
      expect(textButton("Redo").disabled).toBe(true);
    });
  });
});
