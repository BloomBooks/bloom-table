import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import TableMenu from "./TableMenu";
import { defaultTableApi, TableApi } from "./TableApiContext";
import { attachTable } from "../attach";
import { tableHistoryManager } from "../history";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const kSolid = '{"weight":1,"style":"solid","color":"#000"}';
const kThick = '{"weight":2,"style":"solid","color":"#000"}';

describe("the Cell section of the panel", () => {
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

  // Every function member spied on, each still doing the real work, so the panel
  // behaves normally while the test can see which member the control called.
  function spyingApi(): { api: TableApi; spies: Record<string, ReturnType<typeof vi.fn>> } {
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

  function makeAttachedTable(edges?: { h: string; v: string }): {
    table: HTMLElement;
    cells: HTMLElement[];
  } {
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", "hug,hug");
    table.setAttribute("data-row-heights", "hug,hug");
    if (edges) {
      table.setAttribute("data-edges-h", edges.h);
      table.setAttribute("data-edges-v", edges.v);
    }
    for (const text of ["A", "B", "C", "D"]) {
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

  // The Table section carries its own Style, Weight and Corners menus, so every
  // border query has to name the section it belongs to.
  const section = (label: string): HTMLElement => {
    const heading = Array.from(container.querySelectorAll("h2")).find(
      (h) => h.textContent === label,
    );
    if (!heading) throw new Error(`No section titled "${label}"`);
    return heading.parentElement as HTMLElement;
  };

  const cellButton = (label: string): HTMLButtonElement => {
    const el = section("Cell").querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!el) throw new Error(`No button labeled "${label}" in the Cell section`);
    return el;
  };

  const click = (el: HTMLElement) => {
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  };

  const tiles = (groupLabel: string): HTMLElement[] =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        `[role="radiogroup"][aria-label="${groupLabel}"] [role="radio"]`,
      ),
    );

  const tile = (groupLabel: string, label: string): HTMLElement => {
    const el = tiles(groupLabel).find((t) => t.getAttribute("aria-label") === label);
    if (!el) throw new Error(`No "${label}" tile in the ${groupLabel} group`);
    return el;
  };

  const checkedTile = (groupLabel: string): string | undefined =>
    tiles(groupLabel)
      .find((t) => t.getAttribute("aria-checked") === "true")
      ?.getAttribute("aria-label") ?? undefined;

  // Set through the native setter so React's onChange sees the new value.
  const setInput = (el: HTMLInputElement, value: string) => {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  const input = (label: string): HTMLInputElement => {
    const el = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    if (!el) throw new Error(`No input labeled "${label}"`);
    return el;
  };

  // The menu opens on the button and lists its choices as menu item radios,
  // each titled with the value it writes.
  const chooseFromMenu = (button: HTMLButtonElement, choice: string) => {
    click(button);
    const item = container.querySelector<HTMLElement>(
      `div[role="menu"] [role="menuitemradio"][title="${choice}"]`,
    );
    if (!item) throw new Error(`No "${choice}" choice in the open menu`);
    click(item);
  };

  describe("Content Type", () => {
    it("shows the content type the selected cell already carries", () => {
      const { cells } = makeAttachedTable();
      cells[1].setAttribute("data-content-type", "image");

      mount(cells[1]);

      expect(checkedTile("Content type")).toBe("Image");
    });

    it("sets up the cell's contents for the type that is chosen", () => {
      const { cells } = makeAttachedTable();
      const { api, spies } = spyingApi();
      mount(cells[0], api);

      click(tile("Content type", "Image"));

      expect(spies.setupContentsOfCell).toHaveBeenCalledWith(cells[0], "image", true);
      expect(cells[0].getAttribute("data-content-type")).toBe("image");
    });
  });

  describe("Text alignment", () => {
    it("shows the alignment the selected cell already carries", () => {
      const { cells } = makeAttachedTable();
      cells[0].setAttribute("data-align", "end");

      mount(cells[0]);

      expect(checkedTile("Text alignment")).toBe("Right");
    });

    it("shows Center for a cell that has no alignment of its own", () => {
      const { cells } = makeAttachedTable();

      mount(cells[0]);

      expect(checkedTile("Text alignment")).toBe("Center");
    });

    it("writes the chosen alignment to the selected cell", () => {
      const { cells } = makeAttachedTable();
      const { api, spies } = spyingApi();
      mount(cells[0], api);

      click(tile("Text alignment", "Left"));

      expect(spies.setCellAlign).toHaveBeenCalledWith(cells[0], "start");
      expect(cells[0].getAttribute("data-align")).toBe("start");
      expect(checkedTile("Text alignment")).toBe("Left");
    });
  });

  describe("Borders", () => {
    const uniform = {
      h: `[[${kSolid},${kSolid}],[${kSolid},${kSolid}],[${kSolid},${kSolid}]]`,
      v: `[[${kSolid},${kSolid},${kSolid}],[${kSolid},${kSolid},${kSolid}]]`,
    };
    // The second cell of the first row carries a weight of 2 on all four of its
    // own edges; every other edge stays at 1.
    const thickSecondCell = {
      h: `[[${kSolid},${kThick}],[${kSolid},${kThick}],[${kSolid},${kSolid}]]`,
      v: `[[${kSolid},${kThick},${kThick}],[${kSolid},${kSolid},${kSolid}]]`,
    };

    it("reports the weight and style of a cell whose perimeter is uniform", () => {
      const { cells } = makeAttachedTable(uniform);

      mount(cells[0]);

      expect(cellButton("Style").title).toBe("Style: solid");
      expect(cellButton("Weight").title).toBe("Weight: 1");
    });

    it("reports the perimeter of the cell now selected, not the one before it", () => {
      const { cells } = makeAttachedTable(thickSecondCell);

      mount(cells[0]);
      expect(cellButton("Weight").title).toBe("Weight: 1");

      mount(cells[1]);
      expect(cellButton("Weight").title).toBe("Weight: 2");
    });

    it("writes the chosen style to the selected cell's perimeter", () => {
      const { cells } = makeAttachedTable(uniform);
      const { api, spies } = spyingApi();
      mount(cells[0], api);

      chooseFromMenu(cellButton("Style"), "Dashed");

      expect(spies.applyCellPerimeter).toHaveBeenCalled();
      expect(cellButton("Style").title).toBe("Style: dashed");
    });

    it("writes the chosen border colour to the selected cell's perimeter", () => {
      const { table, cells } = makeAttachedTable(uniform);
      mount(cells[0]);

      setInput(input("Cell border color"), "#ff0000");

      expect(table.getAttribute("data-edges-h")).toContain("#ff0000");
    });
  });

  describe("Corners", () => {
    it("shows the corner radius the selected cell already carries", () => {
      const { cells } = makeAttachedTable();
      cells[0].setAttribute("data-corners", '{"radius":8}');

      mount(cells[0]);

      expect(cellButton("Corners").title).toBe("Corners: 8");
    });

    it("writes the chosen corner radius to the selected cell", () => {
      const { cells } = makeAttachedTable();
      const { api, spies } = spyingApi();
      mount(cells[0], api);

      chooseFromMenu(cellButton("Corners"), "16");

      expect(spies.setCellCorners).toHaveBeenCalledWith(cells[0], { radius: 16 });
      expect(cells[0].getAttribute("data-corners")).toBe('{"radius":16}');
    });

    it("clears the cell's corners when the radius is set back to zero", () => {
      const { cells } = makeAttachedTable();
      cells[0].setAttribute("data-corners", '{"radius":8}');
      const { api, spies } = spyingApi();
      mount(cells[0], api);

      chooseFromMenu(cellButton("Corners"), "0");

      expect(spies.setCellCorners).toHaveBeenCalledWith(cells[0], null);
      expect(cells[0].hasAttribute("data-corners")).toBe(false);
    });
  });

  describe("Padding and Fill", () => {
    it("writes the padding the slider is moved to", () => {
      const { cells } = makeAttachedTable();
      const { api, spies } = spyingApi();
      mount(cells[0], api);

      setInput(input("Cell padding"), "12");

      expect(spies.setCellPadding).toHaveBeenCalledWith(cells[0], "12px");
      expect(cells[0].getAttribute("data-pad")).toBe("12px");
    });

    it("shows the fill the selected cell already carries", () => {
      const { cells } = makeAttachedTable();
      cells[0].setAttribute("data-bg", "#00ff00");

      mount(cells[0]);

      expect(input("Cell fill").value).toBe("#00ff00");
    });

    it("writes the chosen fill to the selected cell", () => {
      const { cells } = makeAttachedTable();
      const { api, spies } = spyingApi();
      mount(cells[0], api);

      setInput(input("Cell fill"), "#123456");

      expect(spies.setCellBackground).toHaveBeenCalledWith(cells[0], "#123456");
      expect(cells[0].getAttribute("data-bg")).toBe("#123456");
    });
  });

  describe("Merge and Split", () => {
    it("offers Split only once the cell spans more than one column", () => {
      const { cells } = makeAttachedTable();
      mount(cells[0]);

      expect(cellButton("Split").disabled).toBe(true);

      click(cellButton("Merge"));

      expect(cellButton("Split").disabled).toBe(false);
    });

    it("returns a merged cell to a single column when Split is clicked", () => {
      const { cells } = makeAttachedTable();
      mount(cells[0]);

      click(cellButton("Merge"));
      expect(cells[0].getAttribute("data-span-x")).toBe("2");

      click(cellButton("Split"));

      expect(cells[0].getAttribute("data-span-x") ?? "1").toBe("1");
      expect(cellButton("Split").disabled).toBe(true);
    });

    it("leaves both buttons inoperable while no cell is selected", () => {
      mount(null);

      expect(cellButton("Merge").disabled).toBe(true);
      expect(cellButton("Split").disabled).toBe(true);
    });
  });
});
