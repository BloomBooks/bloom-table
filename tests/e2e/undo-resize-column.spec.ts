import { test, expect } from "@playwright/test";
import { waitForTestHooks } from "./utils/test-hooks";

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
    // The UI harness loads the fixture and attaches table behavior itself.
    await page.goto("/demo/ui-harness.html?fixture=basic-table");
    await page.waitForSelector(".bloom-table");

    // The harness publishes the history manager it uses itself, so undo runs on
    // the same singleton as the demo's Undo button (tableHistoryManager.undo).
    await waitForTestHooks(page);

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
    const lastOp = await page.evaluate(() =>
      window.bloomTableTestHooks!.tableHistoryManager.getLastOperationLabel(),
    );
    console.log("Last operation:", lastOp);
    expect(lastOp).toMatch(/Resize Column/i);

    // Trigger undo exactly like the demo's Undo button.
    const undoResult = await table.evaluate((el) =>
      window.bloomTableTestHooks!.tableHistoryManager.undo(el as HTMLElement),
    );
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
