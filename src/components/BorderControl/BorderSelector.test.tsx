import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import BorderSelector from "./BorderSelector";
import { BorderControl } from "./BorderControl";
import type { BorderValueMap, EdgeKey, SelectedEdges } from "./logic/types";
import TableMenu from "../TableMenu";
import { attachTable } from "../../attach";
import { tableHistoryManager } from "../../history";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const edge = (weight: 0 | 1 | 2 | 4, style: "none" | "solid" | "dashed" = "solid") => ({
  weight,
  style,
  radius: 0 as const,
});

const uniformMap = (): BorderValueMap => ({
  top: edge(1),
  right: edge(1),
  bottom: edge(1),
  left: edge(1),
  innerH: edge(1),
  innerV: edge(1),
});

describe("the border selector", () => {
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

  const click = (el: Element) => {
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  };

  // Each bar names itself with a <title>, which is the only handle the DOM
  // offers on one segment of the drawing.
  const bar = (title: string): Element => {
    const label = Array.from(container.querySelectorAll("title")).find(
      (t) => t.textContent === title,
    );
    if (!label) throw new Error(`No bar titled "${title}"`);
    return label.parentElement as Element;
  };

  const renderSelector = (
    selected: EdgeKey[],
    onChange: (s: SelectedEdges) => void,
    showInner = true,
  ) => {
    act(() => {
      root.render(
        <BorderSelector
          valueMap={uniformMap()}
          showInner={showInner}
          selected={new Set(selected)}
          onChange={onChange}
        />,
      );
    });
  };

  const selectionFrom = (onChange: ReturnType<typeof vi.fn>): string[] =>
    Array.from(onChange.mock.calls[0][0] as SelectedEdges).sort();

  describe("choosing edges", () => {
    it("adds an unselected outer edge to the selection", () => {
      const onChange = vi.fn();
      renderSelector([], onChange);

      click(bar("Toggle top border"));

      expect(selectionFrom(onChange)).toEqual(["top"]);
    });

    it("removes an outer edge that is already selected", () => {
      const onChange = vi.fn();
      renderSelector(["top", "left"], onChange);

      click(bar("Toggle top border"));

      expect(selectionFrom(onChange)).toEqual(["left"]);
    });

    it("selects both inner axes when the inner plus is clicked", () => {
      const onChange = vi.fn();
      renderSelector([], onChange);

      click(bar("Toggle inner borders"));

      expect(selectionFrom(onChange)).toEqual(["innerH", "innerV"]);
    });

    it("clears both inner axes when only one of them is selected", () => {
      // A click on the plus must not turn a half-selection into the other half,
      // which is what flipping each axis on its own would do.
      const onChange = vi.fn();
      renderSelector(["innerH"], onChange);

      click(bar("Toggle inner borders"));

      expect(selectionFrom(onChange)).toEqual([]);
    });

    it("leaves the other edges alone when one is clicked", () => {
      const onChange = vi.fn();
      renderSelector(["left", "right"], onChange);

      click(bar("Toggle bottom border"));

      expect(selectionFrom(onChange)).toEqual(["bottom", "left", "right"]);
    });

    it("offers no inner plus when the control edits a single cell", () => {
      renderSelector([], vi.fn(), false);

      const titles = Array.from(container.querySelectorAll("title")).map((t) => t.textContent);
      expect(titles).not.toContain("Toggle inner borders");
    });

    it("draws a selected edge at full strength and an unselected one faded", () => {
      renderSelector(["top"], vi.fn());

      expect(bar("Toggle top border").getAttribute("opacity")).toBe("1");
      expect(bar("Toggle bottom border").getAttribute("opacity")).toBe("0.6");
    });
  });

  describe("what the selection writes", () => {
    const renderControl = (
      valueMap: BorderValueMap,
      selected: EdgeKey[],
      onChange: (m: BorderValueMap) => void,
    ) => {
      act(() => {
        root.render(
          <BorderControl
            valueMap={valueMap}
            initialSelected={new Set(selected)}
            onChange={onChange}
          />,
        );
      });
    };

    const menuButton = (label: string): HTMLButtonElement => {
      const el = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (!el) throw new Error(`No button labeled "${label}"`);
      return el;
    };

    const chooseFromMenu = (label: string, choice: string) => {
      click(menuButton(label));
      const item = container.querySelector<HTMLElement>(
        `div[role="menu"] [role="menuitemradio"][title="${choice}"]`,
      );
      if (!item) throw new Error(`No "${choice}" choice in the open ${label} menu`);
      click(item);
    };

    it("writes a style to the selected edge and to no other", () => {
      const onChange = vi.fn();
      renderControl(uniformMap(), ["top"], onChange);

      chooseFromMenu("Style", "Dashed");

      const next = onChange.mock.calls[0][0] as BorderValueMap;
      expect(next.top.style).toBe("dashed");
      expect([next.right.style, next.bottom.style, next.left.style]).toEqual([
        "solid",
        "solid",
        "solid",
      ]);
    });

    it("writes to an edge added to the selection after the control was drawn", () => {
      const onChange = vi.fn();
      renderControl(uniformMap(), ["top"], onChange);

      click(bar("Toggle right border"));
      chooseFromMenu("Style", "Dashed");

      const next = onChange.mock.calls[0][0] as BorderValueMap;
      expect([next.top.style, next.right.style]).toEqual(["dashed", "dashed"]);
      expect(next.left.style).toBe("solid");
    });

    it("writes nothing while no edge is selected", () => {
      const onChange = vi.fn();
      renderControl(uniformMap(), [], onChange);

      chooseFromMenu("Style", "Dashed");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("shows the value the selected edges share", () => {
      renderControl(uniformMap(), ["top", "bottom"], vi.fn());

      expect(menuButton("Style").title).toBe("Style: solid");
      expect(menuButton("Weight").title).toBe("Weight: 1");
    });

    it("shows no value when the selected edges disagree", () => {
      const map = { ...uniformMap(), right: edge(2) };
      renderControl(map, ["top", "right"], vi.fn());

      expect(menuButton("Weight").title).toBe("Weight: Mixed");
    });

    it("ticks no choice in the open menu while the selected edges disagree", () => {
      const map = { ...uniformMap(), right: edge(2) };
      renderControl(map, ["top", "right"], vi.fn());

      click(menuButton("Weight"));

      const ticked = container.querySelectorAll('[role="menuitemradio"][aria-checked="true"]');
      expect(ticked.length).toBe(0);
    });
  });

  describe("the Table section's border control", () => {
    // Migrated from an end-to-end spec: it only read the two menu buttons, and
    // nothing here needs a real browser's computed borders.
    function makeAttachedTable(): HTMLElement[] {
      const table = document.createElement("div");
      table.className = "bloom-table";
      table.setAttribute("data-column-widths", "hug,hug");
      table.setAttribute("data-row-heights", "hug,hug");
      for (let i = 0; i < 4; i++) {
        const cell = document.createElement("div");
        cell.className = "bloom-cell";
        cell.setAttribute("data-content-type", "text");
        const editable = document.createElement("div");
        editable.setAttribute("contenteditable", "true");
        cell.appendChild(editable);
        table.appendChild(cell);
      }
      document.body.appendChild(table);
      attachTable(table);
      return Array.from(table.children) as HTMLElement[];
    }

    const tableSectionButton = (label: string): HTMLButtonElement => {
      const heading = Array.from(container.querySelectorAll("h2")).find(
        (h) => h.textContent === "Table",
      )!;
      const el = (heading.parentElement as HTMLElement).querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
      );
      if (!el) throw new Error(`No button labeled "${label}" in the Table section`);
      return el;
    };

    it("reports one pixel of solid border for a table nobody has edited", () => {
      const cells = makeAttachedTable();

      act(() => root.render(<TableMenu currentCell={cells[0]} />));

      expect(tableSectionButton("Style").title).toBe("Style: solid");
      expect(tableSectionButton("Weight").title).toBe("Weight: 1");
    });
  });
});
