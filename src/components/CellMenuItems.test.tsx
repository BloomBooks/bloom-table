import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import type * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { CellMenuItems } from "./CellMenuItems";
import { attachTable } from "../attach";
import { tableHistoryManager } from "../history";
import { setCellMenuItemFilter } from "../cell-menu-host";
import { getCurrentContentTypeId } from "../cell-contents";
import { removeTable, resetTableSizeButtons } from "../table-size-buttons";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The one renderer of a cell's menu items. The library's popup mounts it and so does
// a host, so these tests are about what the user sees either way: the commands as
// rows, the content type as a row of toggles, a divider where the group changes,
// every action the model's own, and the host's say over the labels and the items.
describe("the CellMenuItems component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
    resetTableSizeButtons();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setCellMenuItemFilter(undefined);
    document.querySelectorAll<HTMLElement>(".bloom-table").forEach((t) => removeTable(t));
  });

  const makeTable = (): { table: HTMLElement; cells: HTMLElement[] } => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
        <div class="bloom-cell"><div contenteditable="true">a</div></div>
        <div class="bloom-cell"><div contenteditable="true">b</div></div>
        <div class="bloom-cell"><div contenteditable="true">c</div></div>
        <div class="bloom-cell"><div contenteditable="true">d</div></div>
      </div>`;
    const table = wrapper.firstElementChild as HTMLElement;
    document.body.appendChild(table);
    attachTable(table);
    return {
      table,
      cells: Array.from(table.querySelectorAll<HTMLElement>(".bloom-cell")),
    };
  };

  const render = (
    cell: HTMLElement,
    props: Partial<React.ComponentProps<typeof CellMenuItems>> = {},
  ) => {
    act(() => root.render(<CellMenuItems cell={cell} {...props} />));
  };

  const rows = () =>
    Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).map((row) =>
      row.getAttribute("aria-label"),
    );
  const toggles = () =>
    Array.from(container.querySelectorAll<HTMLElement>("[data-ct-id]"));
  const click = (element: HTMLElement) =>
    act(() => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

  it("renders the cell's commands as rows and the content type as toggles", () => {
    const { cells } = makeTable();
    render(cells[0]);

    expect(rows()).toEqual(["Paint format", "Merge with cell to the right", "Split"]);
    expect(toggles().map((t) => t.dataset.ctId)).toEqual(["text", "table", "image", "video"]);
    // The cell holds text, so that is the pressed toggle.
    expect(toggles().filter((t) => t.getAttribute("aria-pressed") === "true").length).toBe(1);
    expect(
      toggles().find((t) => t.getAttribute("aria-pressed") === "true")?.dataset.ctId,
    ).toBe("text");
  });

  it("heads the items with the section's name", () => {
    const { cells } = makeTable();
    render(cells[0]);

    const heading = container.firstElementChild as HTMLElement;
    expect(heading.textContent).toBe("Table Cell");
    // The heading says what the items act on; it is not one of them.
    expect(heading.getAttribute("role")).toBe(null);
    // It starts at the menu's left edge, not at the icon gutter the labels use.
    expect(heading.style.paddingLeft).toBe("14px");
  });

  it("lets the host word the heading too", () => {
    const { cells } = makeTable();
    render(cells[0], {
      localize: (englishLabel, id) => (id === "tableCell" ? "Cellule" : englishLabel),
    });

    expect(container.firstElementChild?.textContent).toBe("Cellule");
  });

  it("shows no heading when the host's filter leaves no items", () => {
    const { cells } = makeTable();
    setCellMenuItemFilter(() => false);
    render(cells[0]);

    expect(container.textContent).toBe("");
  });

  it("puts a divider wherever the group changes", () => {
    const { cells } = makeTable();
    render(cells[0]);

    // Four groups appear — the content type, the Format stand-in (drawn only when a
    // host passes renderFormatControls, so it contributes no row here), Paint format
    // and the span commands — which leaves three group changes.
    expect(container.querySelectorAll("hr").length).toBe(3);
  });

  it("choosing a content type changes the cell and moves the pressed toggle", () => {
    const { cells } = makeTable();
    const cell = cells[0];
    // Sanity check: a fresh cell holds text, so a later "image" is a real change.
    expect(getCurrentContentTypeId(cell)).toBe("text");
    render(cell);

    click(toggles().find((t) => t.dataset.ctId === "image")!);

    expect(getCurrentContentTypeId(cell)).toBe("image");
    expect(
      toggles().find((t) => t.getAttribute("aria-pressed") === "true")?.dataset.ctId,
    ).toBe("image");
  });

  it("runs a command's own action, and closes the host's menu first", () => {
    const { cells } = makeTable();
    const closed: string[] = [];
    render(cells[0], { closeMenu: () => closed.push("closed") });
    // Sanity check: nothing is spanned yet.
    expect(cells[0].getAttribute("data-span-x")).toBe(null);

    click(container.querySelector<HTMLElement>('[aria-label="Merge with cell to the right"]')!);

    expect(cells[0].getAttribute("data-span-x")).toBe("2");
    expect(closed).toEqual(["closed"]);
  });

  it("marks a command the model disables", () => {
    const { cells } = makeTable();
    render(cells[0]);

    // Nothing is spanned, so Split has nothing to reduce.
    expect(
      container
        .querySelector<HTMLElement>('[aria-label="Split"]')
        ?.getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("shows only what the host's filter allows", () => {
    const { cells } = makeTable();
    setCellMenuItemFilter((itemId) =>
      ["contentType", "contentType:text", "contentType:image"].includes(itemId),
    );
    render(cells[0]);

    expect(rows()).toEqual([]);
    expect(toggles().map((t) => t.dataset.ctId)).toEqual(["text", "image"]);
    // One group is left, so there is nothing to divide.
    expect(container.querySelectorAll("hr").length).toBe(0);
  });

  it("uses the host's wording, item by item", () => {
    const { cells } = makeTable();
    render(cells[0], {
      localize: (englishLabel, id) => (id === "split" ? "Diviser" : englishLabel),
    });

    expect(rows()).toContain("Diviser");
    expect(rows()).not.toContain("Split");
  });

  it("lets the host draw the Format rows itself", () => {
    const { cells } = makeTable();
    render(cells[0], {
      renderFormatControls: (element) => {
        const mine = document.createElement("div");
        mine.className = "host-format-rows";
        element.appendChild(mine);
      },
    });

    expect(container.querySelectorAll(".host-format-rows").length).toBe(1);
  });

  it("acts on the cell it was given", () => {
    const { cells } = makeTable();
    // The host renders the menu itself, so nothing has selected a cell.
    render(cells[2]);

    click(container.querySelector<HTMLElement>('[aria-label="Merge with cell to the right"]')!);

    expect(cells[2].getAttribute("data-span-x")).toBe("2");
    expect(cells[0].getAttribute("data-span-x")).toBe(null);
  });
});
