import { test, expect } from "@playwright/test";
import { attachTablesToPage } from "./utils/table-attachment";

/**
 * Regression test for: "Undo: Resize Column" made no visual change.
 *
 * The undo operation reverted the `data-column-widths` attribute but never
 * called render(), so the computed `table-template-columns` (the actual visual
 * layout) was left at the dragged value. This test drags a column wider, then
 * undoes, and asserts BOTH the data attribute and the computed template revert.
 */
test.describe("Undo resize column", () => {
  test("undo reverts both data-column-widths and the visual table-template-columns", async ({
    page,
  }) => {
    await page.goto("/demo/exercises/new-table.html");
    await page.waitForSelector(".bloom-table");
    await attachTablesToPage(page);

    // Expose the history manager singleton so we can trigger undo exactly as
    // the demo's Undo button does (tableHistoryManager.undo(table)).
    await page.addScriptTag({
      type: "module",
      content: `
        import { tableHistoryManager } from "/src/history.ts";
        window.__gridHistory = tableHistoryManager;
      `,
    });
    await page.waitForTimeout(100);

    const table = page.locator("#main-table");
    await expect(table).toBeVisible();

    const readState = () =>
      table.evaluate((el) => ({
        dataColumnWidths: el.getAttribute("data-column-widths"),
        templateColumns: window.getComputedStyle(el).gridTemplateColumns,
      }));

    const initial = await readState();
    console.log("Initial:", initial);

    // Drag the right edge of the first cell to widen column 0.
    const firstCell = table.locator(".bloom-cell").first();
    const bounds = await firstCell.boundingBox();
    expect(bounds).not.toBeNull();

    const startX = bounds!.x + bounds!.width - 2; // 2px from right edge
    const startY = bounds!.y + bounds!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY, { steps: 5 });
    await page.mouse.up();

    const afterDrag = await readState();
    console.log("After drag:", afterDrag);

    // Sanity: the drag actually changed the column width (data + visual).
    expect(afterDrag.dataColumnWidths).not.toBe(initial.dataColumnWidths);
    expect(afterDrag.templateColumns).not.toBe(initial.templateColumns);

    // A resize-column entry should be on the history stack.
    const lastOp = await page.evaluate(() => window.__gridHistory.getLastOperationLabel());
    console.log("Last operation:", lastOp);
    expect(lastOp).toMatch(/Resize Column/i);

    // Trigger undo exactly like the demo's Undo button.
    const undoResult = await table.evaluate((el) => window.__gridHistory.undo(el));
    expect(undoResult).toBe(true);
    await page.waitForTimeout(50);

    const afterUndo = await readState();
    console.log("After undo:", afterUndo);

    // Data attribute reverts (this already worked before the fix).
    expect(afterUndo.dataColumnWidths).toBe(initial.dataColumnWidths);

    // The actual visual layout reverts too (THIS is what was broken).
    expect(afterUndo.templateColumns).toBe(initial.templateColumns);
  });
});

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __gridHistory: any;
  }
}
