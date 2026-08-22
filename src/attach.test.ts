import { describe, it, expect, beforeEach } from "vite-plus/test";
import { attachTable, detachTable } from "./attach";
import { tableHistoryManager } from "./history";

describe("attachTable / detachTable lifecycle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
  });

  it("attach on a bare div creates the default 2x2 grid", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    attachTable(div);
    expect(div.getAttribute("data-column-widths")!.split(",").length).toBe(2);
    expect(div.getAttribute("data-row-heights")!.split(",").length).toBe(2);
    expect(div.querySelectorAll(".bloom-cell").length).toBe(4);
  });

  it("attach on saved content with size attributes does not add default rows/columns", () => {
    const div = document.createElement("div");
    div.className = "bloom-table";
    div.setAttribute("data-column-widths", "100px");
    div.setAttribute("data-row-heights", "50px");
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    div.appendChild(cell);
    document.body.appendChild(div);

    attachTable(div);
    expect(div.getAttribute("data-column-widths")).toBe("100px");
    expect(div.getAttribute("data-row-heights")).toBe("50px");
    expect(div.querySelectorAll(".bloom-cell").length).toBe(1);
  });

  it("attach -> detach -> attach does not re-default an already-populated table", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    attachTable(div);
    detachTable(div);
    attachTable(div);
    expect(div.getAttribute("data-column-widths")!.split(",").length).toBe(2);
    expect(div.querySelectorAll(".bloom-cell").length).toBe(4);
  });

  it("attach scrubs stale selection classes saved by a previous session", () => {
    const div = document.createElement("div");
    div.className = "bloom-table table--selected bloom-pointer-near";
    div.setAttribute("data-column-widths", "hug,hug");
    div.setAttribute("data-row-heights", "hug,hug");
    for (let i = 0; i < 4; i++) {
      const cell = document.createElement("div");
      cell.className = "bloom-cell";
      div.appendChild(cell);
    }
    (div.children[1] as HTMLElement).classList.add("cell--selected");
    document.body.appendChild(div);

    attachTable(div);
    expect(div.classList.contains("table--selected")).toBe(false);
    expect(div.classList.contains("bloom-pointer-near")).toBe(false);
    expect(div.querySelectorAll(".cell--selected").length).toBe(0);
  });

  it("attach scrubs anchor names minted by a previous session", () => {
    const div = document.createElement("div");
    div.className = "bloom-table";
    div.setAttribute("data-column-widths", "hug");
    div.setAttribute("data-row-heights", "hug");
    const cell = document.createElement("div");
    cell.className = "bloom-cell";
    // A name baked into saved HTML — not minted in this session.
    cell.dataset.btableAnchorName = "--btable-anchor-999";
    cell.style.setProperty("anchor-name", "--btable-anchor-999");
    div.appendChild(cell);
    document.body.appendChild(div);

    attachTable(div);
    expect(cell.dataset.btableAnchorName).toBeUndefined();
    expect(cell.style.getPropertyValue("anchor-name")).toBe("");
  });

  it("a detached table's operations are refused by the history manager", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    attachTable(div);
    detachTable(div);

    let ran = false;
    const ok = tableHistoryManager.addHistoryEntry(div, "After Detach", () => {
      ran = true;
    });
    expect(ok).toBe(false);
    expect(ran).toBe(false);
    expect(tableHistoryManager.canUndo(div)).toBe(false);
  });

  it("re-attach restores history participation", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    attachTable(div);
    detachTable(div);
    attachTable(div);

    const ok = tableHistoryManager.addHistoryEntry(div, "After Re-attach", () => {
      div.setAttribute("data-mark", "1");
    });
    expect(ok).toBe(true);
    expect(div.getAttribute("data-mark")).toBe("1");
    expect(tableHistoryManager.undo(div)).toBe(true);
    expect(div.hasAttribute("data-mark")).toBe(false);
  });
});
