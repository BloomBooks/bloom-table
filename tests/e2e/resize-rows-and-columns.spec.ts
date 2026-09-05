import { test, expect } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// A row resize must move the data attribute and the rendered grid together,
// while the pointer is still down. The data attribute alone proved nothing:
// the earlier version of this spec passed while the table on screen did not
// move until the drag ended.
test.describe("Resize rows", () => {
  test("dragging the bottom edge of a cell grows the row and the rendered grid", async ({
    page,
  }) => {
    await page.goto("/demo/ui-harness.html?fixture=basic-table");
    await page.waitForSelector(".bloom-table");

    const table = page.locator("#main-table");
    await expect(table).toBeVisible();

    const initialRowHeights = await table.getAttribute("data-row-heights");
    const initialTemplateRows = await table.evaluate(
      (el) => window.getComputedStyle(el).gridTemplateRows,
    );

    const firstCell = table.locator(".bloom-cell").first();
    const bounds = await firstCell.boundingBox();
    expect(bounds).not.toBeNull();

    const startX = bounds!.x + bounds!.width / 2;
    const startY = bounds!.y + bounds!.height - 2; // 2px inside the bottom edge

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 50, { steps: 5 });

    // Still mid-drag: both the model and the rendered grid must have moved.
    await expect
      .poll(() => table.getAttribute("data-row-heights"))
      .not.toBe(initialRowHeights);
    const duringDragTemplateRows = await table.evaluate(
      (el) => window.getComputedStyle(el).gridTemplateRows,
    );
    expect(duringDragTemplateRows).not.toBe(initialTemplateRows);

    await page.mouse.up();

    const finalRowHeights = await table.getAttribute("data-row-heights");
    const finalTemplateRows = await table.evaluate(
      (el) => window.getComputedStyle(el).gridTemplateRows,
    );
    expect(finalTemplateRows).toBe(duringDragTemplateRows);
    // The drag turns the first row from "hug" into a fixed size, written in mm.
    expect(finalRowHeights).toMatch(/^[0-9.]+mm,/);

    const initialHeight = parseFloat(initialTemplateRows);
    const finalHeight = parseFloat(finalTemplateRows);
    expect(finalHeight).toBeGreaterThan(initialHeight);
  });

  test("undo reverts the row height and the rendered grid", async ({ page }) => {
    await page.goto("/demo/ui-harness.html?fixture=basic-table");
    await page.waitForSelector(".bloom-table");

    // The harness publishes the history manager it uses itself, so undo here
    // runs on the same singleton as the demo's Undo button.
    await waitForTestHooks(page);

    const table = page.locator("#main-table");
    await expect(table).toBeVisible();

    const initialRowHeights = await table.getAttribute("data-row-heights");
    const initialTemplateRows = await table.evaluate(
      (el) => window.getComputedStyle(el).gridTemplateRows,
    );

    const firstCell = table.locator(".bloom-cell").first();
    const bounds = await firstCell.boundingBox();
    expect(bounds).not.toBeNull();

    const startX = bounds!.x + bounds!.width / 2;
    const startY = bounds!.y + bounds!.height - 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 30, { steps: 5 });
    await page.mouse.up();

    expect(await table.getAttribute("data-row-heights")).not.toBe(initialRowHeights);

    const lastOperation = await page.evaluate(() =>
      window.bloomTableTestHooks!.tableHistoryManager.getLastOperationLabel(),
    );
    expect(lastOperation).toMatch(/Resize Row/i);

    const undone = await table.evaluate((el) =>
      window.bloomTableTestHooks!.tableHistoryManager.undo(el as HTMLElement),
    );
    expect(undone).toBe(true);

    await expect.poll(() => table.getAttribute("data-row-heights")).toBe(initialRowHeights);
    const afterUndoTemplateRows = await table.evaluate(
      (el) => window.getComputedStyle(el).gridTemplateRows,
    );
    expect(afterUndoTemplateRows).toBe(initialTemplateRows);
  });
});
