import { describe, it, expect, beforeEach } from "vite-plus/test";
import { attachGrid, detachGrid } from "./attach";
import { gridHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";

function dispatchMouse(el: Element, type: string, opts: MouseEventInit) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, ...opts });
  el.dispatchEvent(ev);
}

describe("corner handle drag to resize table", () => {
  beforeEach(() => {
    gridHistoryManager.reset?.();
    document.body.innerHTML = "";
    resetTableSizeButtons(); // Reset the table size buttons state
  });

  it("adds/removes rows and columns while dragging and commits one history entry", () => {
    document.body.innerHTML = `
      <div class="grid" data-column-widths="hug,hug" data-row-heights="hug,hug">
        <div class="cell"><div contenteditable>1</div></div>
        <div class="cell"><div contenteditable>2</div></div>
        <div class="cell"><div contenteditable>3</div></div>
        <div class="cell"><div contenteditable>4</div></div>
      </div>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    // Focus a cell to trigger overlay installation and show overlays
    const firstEditable = grid.querySelector(
      ".cell [contenteditable]"
    ) as HTMLElement;
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    // Corner handle is created on demand by overlays; find it
    const handle = document.querySelector(
      "[data-bgrid-corner-handle]"
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    // Simulate drag: mousedown at current position, then move by enough pixels to increment rows/cols
    const rect = grid.getBoundingClientRect();
    const startX = rect.right + 10;
    const startY = rect.bottom + 10;

    dispatchMouse(handle, "mousedown", { clientX: startX, clientY: startY });

    // Move by +100px X -> +2 columns; +80px Y -> +2 rows (based on steps 40px/30px)
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: startX + 100,
        clientY: startY + 80,
        bubbles: true,
      })
    );

    // Expect attributes updated during live drag
    const cols = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    const rows = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(cols).toBeGreaterThanOrEqual(4);
    expect(rows).toBeGreaterThanOrEqual(4);

    // Mouse up commits a single history entry
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // Undo should restore to 2x2
    const undoOk = gridHistoryManager.undo(grid);
    expect(undoOk).toBe(true);

    const colsAfter = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    const rowsAfter = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(colsAfter).toBe(2);
    expect(rowsAfter).toBe(2);

    detachGrid(grid);
  });

  it("shrinks rows and columns when dragging back toward the grid", () => {
    // Start with a 4x4 grid
    const colsAttr = Array(4).fill("hug").join(",");
    const rowsAttr = Array(4).fill("hug").join(",");
    const cellsHtml = Array.from(
      { length: 16 },
      (_, i) => `<div class="cell"><div contenteditable>${i + 1}</div></div>`
    ).join("");
    document.body.innerHTML = `
      <div class="grid" data-column-widths="${colsAttr}" data-row-heights="${rowsAttr}">
        ${cellsHtml}
      </div>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    // Focus a cell to trigger overlays
    const firstEditable = grid.querySelector(
      ".cell [contenteditable]"
    ) as HTMLElement;
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const handle = document.querySelector(
      "[data-bgrid-corner-handle]"
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    const rect = grid.getBoundingClientRect();
    const startX = rect.right + 10;
    const startY = rect.bottom + 10;

    // Begin drag
    dispatchMouse(handle, "mousedown", { clientX: startX, clientY: startY });

    // Drag up-left by enough to reduce by 1-2 rows/cols (units 40px/30px)
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: startX - 90,
        clientY: startY - 70,
        bubbles: true,
      })
    );

    // Expect attributes updated during live drag (from 4x4 down to <= 3x3)
    const cols = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    const rows = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(cols).toBeLessThanOrEqual(3);
    expect(rows).toBeLessThanOrEqual(3);

    // End drag
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    detachGrid(grid);
  });

  it("can grow then shrink within the same drag gesture", () => {
    document.body.innerHTML = `
      <div class="grid" data-column-widths="hug,hug" data-row-heights="hug,hug">
        <div class="cell"><div contenteditable>1</div></div>
        <div class="cell"><div contenteditable>2</div></div>
        <div class="cell"><div contenteditable>3</div></div>
        <div class="cell"><div contenteditable>4</div></div>
      </div>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    const firstEditable = grid.querySelector(
      ".cell [contenteditable]"
    ) as HTMLElement;
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const handle = document.querySelector(
      "[data-bgrid-corner-handle]"
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    const rect = grid.getBoundingClientRect();
    const startX = rect.right + 10;
    const startY = rect.bottom + 10;

    // Start drag
    dispatchMouse(handle, "mousedown", { clientX: startX, clientY: startY });

    // Grow by ~ +2 cols and +2 rows
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: startX + 100,
        clientY: startY + 80,
        bubbles: true,
      })
    );
    let cols = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    let rows = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(cols).toBeGreaterThanOrEqual(4);
    expect(rows).toBeGreaterThanOrEqual(4);

    // Now shrink back near the start point (close to 2x2)
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: startX + 10,
        clientY: startY + 10,
        bubbles: true,
      })
    );
    cols = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    rows = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(cols).toBeLessThanOrEqual(2);
    expect(rows).toBeLessThanOrEqual(2);

    // End drag
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    detachGrid(grid);
  });

  it("shrinking commits one undoable entry that restores original size", () => {
    // Start 4x4
    const colsAttr = Array(4).fill("hug").join(",");
    const rowsAttr = Array(4).fill("hug").join(",");
    const cellsHtml = Array.from(
      { length: 16 },
      (_, i) => `<div class="cell"><div contenteditable>${i + 1}</div></div>`
    ).join("");
    document.body.innerHTML = `
      <div class="grid" data-column-widths="${colsAttr}" data-row-heights="${rowsAttr}">
        ${cellsHtml}
      </div>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    const firstEditable = grid.querySelector(
      ".cell [contenteditable]"
    ) as HTMLElement;
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const handle = document.querySelector(
      "[data-bgrid-corner-handle]"
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    const rect = grid.getBoundingClientRect();
    const startX = rect.right + 10;
    const startY = rect.bottom + 10;

    // Drag to shrink by ~2 cols and ~2 rows
    dispatchMouse(handle, "mousedown", { clientX: startX, clientY: startY });
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: startX - 100,
        clientY: startY - 80,
        bubbles: true,
      })
    );

    // End drag to commit history
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // Verify grid is now smaller
    let cols = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    let rows = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(cols).toBeLessThan(4);
    expect(rows).toBeLessThan(4);

    // Undo should restore 4x4
    const undoOk = gridHistoryManager.undo(grid);
    expect(undoOk).toBe(true);
    cols = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    rows = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(cols).toBe(4);
    expect(rows).toBe(4);

    detachGrid(grid);
  });

  it("handles high-velocity dragging without losing the drag session", () => {
    document.body.innerHTML = `
      <div class="grid" data-column-widths="hug,hug" data-row-heights="hug,hug">
        <div class="cell"><div contenteditable>1</div></div>
        <div class="cell"><div contenteditable>2</div></div>
        <div class="cell"><div contenteditable>3</div></div>
        <div class="cell"><div contenteditable>4</div></div>
      </div>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    const firstEditable = grid.querySelector(
      ".cell [contenteditable]"
    ) as HTMLElement;
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    const handle = document.querySelector(
      "[data-bgrid-corner-handle]"
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    const rect = grid.getBoundingClientRect();
    const startX = rect.right + 10;
    const startY = rect.bottom + 10;

    // Start drag
    dispatchMouse(handle, "mousedown", { clientX: startX, clientY: startY });

    // Simulate high-velocity dragging with large coordinate jumps
    const steps = [
      { x: startX + 50, y: startY + 40 }, // +1 col, +1 row
      { x: startX + 120, y: startY + 90 }, // +3 cols, +3 rows
      { x: startX + 200, y: startY + 150 }, // +5 cols, +5 rows
      { x: startX + 160, y: startY + 120 }, // back to +4 cols, +4 rows
    ];

    steps.forEach((step) => {
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: step.x,
          clientY: step.y,
          bubbles: true,
        })
      );
    });

    // End drag
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // Verify final grid size (should be around 4x4 based on last step)
    const cols = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    const rows = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(cols).toBeGreaterThanOrEqual(4);
    expect(rows).toBeGreaterThanOrEqual(4);

    // Verify undo still works
    const undoOk = gridHistoryManager.undo(grid);
    expect(undoOk).toBe(true);

    detachGrid(grid);
  });

  it("maintains grid selection after corner drag operations", () => {
    // Start with a 3x3 grid
    const colsAttr = Array(3).fill("hug").join(",");
    const rowsAttr = Array(3).fill("hug").join(",");
    const cellsHtml = Array.from(
      { length: 9 },
      (_, i) => `<div class="cell"><div contenteditable>${i + 1}</div></div>`
    ).join("");
    document.body.innerHTML = `
      <div class="grid" data-column-widths="${colsAttr}" data-row-heights="${rowsAttr}">
        ${cellsHtml}
      </div>`;

    const grid = document.querySelector(".grid") as HTMLElement;
    attachGrid(grid);

    // Focus a cell to trigger overlays and establish initial selection
    const firstEditable = grid.querySelector(
      ".cell [contenteditable]"
    ) as HTMLElement;
    firstEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    // Verify initial selection state
    expect(document.querySelector(".cell.cell--selected")).toBeTruthy();
    expect(document.querySelector(".grid.grid--selected")).toBe(grid);

    const handle = document.querySelector(
      "[data-bgrid-corner-handle]"
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    const rect = grid.getBoundingClientRect();
    const startX = rect.right + 10;
    const startY = rect.bottom + 10;

    // Begin drag - this should store initial selection state
    dispatchMouse(handle, "mousedown", { clientX: startX, clientY: startY });

    // Shrink the grid (drag towards origin) - this removes rows/columns
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: startX - 50, // Move left to reduce columns
        clientY: startY - 40, // Move up to reduce rows
        bubbles: true,
      })
    );

    // Verify grid was resized (should be smaller)
    const colsDuringDrag = (grid.getAttribute("data-column-widths") || "")
      .split(",")
      .filter(Boolean).length;
    const rowsDuringDrag = (grid.getAttribute("data-row-heights") || "")
      .split(",")
      .filter(Boolean).length;
    expect(colsDuringDrag).toBeLessThan(3);
    expect(rowsDuringDrag).toBeLessThan(3);

    // End drag - this should restore selection
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // ❓ THE BUG: After corner drag ends, selection should be maintained
    // but currently these expectations fail because selection is lost
    const selectedCellAfter = document.querySelector(".cell.cell--selected");
    const selectedGridAfter = document.querySelector(".grid.grid--selected");

    console.log("🔍 Selection state after drag:", {
      selectedCell: !!selectedCellAfter,
      selectedGrid: !!selectedGridAfter,
      gridMatch: selectedGridAfter === grid,
      activeElement: document.activeElement?.tagName,
      activeElementClass: (document.activeElement as HTMLElement)?.className,
    });

    expect(selectedCellAfter).toBeTruthy();
    expect(selectedGridAfter).toBe(grid);

    // Also verify that a cell in the grid is focused
    const activeElement = document.activeElement;
    const activeCell = activeElement?.closest(".cell");
    expect(activeCell).toBeTruthy();
    expect(activeCell?.closest(".grid")).toBe(grid);

    detachGrid(grid);
  });
});
