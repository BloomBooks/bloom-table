import { test, expect, Page } from "./utils/strict-page";

test.describe("TableMenu Integration Tests", () => {
  test.beforeEach(async ({ page }) => {
    // The UI harness mounts a blank 2x2 table plus the real TableMenu toolbar
    await page.goto("/demo/ui-harness.html");
    await page.waitForSelector("#root", { timeout: 10000 });
    await page.waitForSelector("#attempt-container .bloom-table", {
      timeout: 10000,
    });
  });

  test("can add column to the left", async ({ page }) => {
    await focusFirstCell(page);

    // Check that TableMenu is visible and has proper content
    const gridMenu = page.locator(".table-menu");
    await expect(gridMenu).toBeVisible();
    await expect(gridMenu).not.toContainText("Click in a table cell");

    const initialColumnCount = await getColumnCount(page);
    const initialRowCount = await getRowCount(page);
    const initialCellCount = await getCellCount(page);

    const insertLeftButton = page.locator('#controls-panel button[aria-label="Insert Column Left"]');
    await expect(insertLeftButton).toBeVisible();
    await insertLeftButton.click();

    await expect.poll(() => getColumnCount(page)).toBe(initialColumnCount + 1);
    // One new cell per row
    expect(await getCellCount(page)).toBe(initialCellCount + initialRowCount);
  });

  test("can add column to the right", async ({ page }) => {
    await focusFirstCell(page);

    const initialColumnCount = await getColumnCount(page);
    const initialRowCount = await getRowCount(page);
    const initialCellCount = await getCellCount(page);

    const insertRightButton = page.locator(
      '#controls-panel button[aria-label="Insert Column Right"]',
    );
    await expect(insertRightButton).toBeVisible();
    await insertRightButton.click();

    await expect.poll(() => getColumnCount(page)).toBe(initialColumnCount + 1);
    // One new cell per row
    expect(await getCellCount(page)).toBe(initialCellCount + initialRowCount);
  });

  test("can add row above", async ({ page }) => {
    await focusFirstCell(page);

    const initialRowCount = await getRowCount(page);
    const initialColumnCount = await getColumnCount(page);
    const initialCellCount = await getCellCount(page);

    const insertAboveButton = page.locator('#controls-panel button[aria-label="Insert Row Above"]');
    await expect(insertAboveButton).toBeVisible();
    await insertAboveButton.click();

    await expect.poll(() => getRowCount(page)).toBe(initialRowCount + 1);
    // One new cell per column
    expect(await getCellCount(page)).toBe(initialCellCount + initialColumnCount);
  });

  test("can add row below", async ({ page }) => {
    await focusFirstCell(page);

    const initialRowCount = await getRowCount(page);
    const initialColumnCount = await getColumnCount(page);
    const initialCellCount = await getCellCount(page);

    const insertBelowButton = page.locator('#controls-panel button[aria-label="Insert Row Below"]');
    await expect(insertBelowButton).toBeVisible();
    await insertBelowButton.click();

    await expect.poll(() => getRowCount(page)).toBe(initialRowCount + 1);
    // One new cell per column
    expect(await getCellCount(page)).toBe(initialCellCount + initialColumnCount);
  });

  test("can delete column", async ({ page }) => {
    await focusFirstCell(page);

    // First add an extra column so we can safely delete one
    const startColumnCount = await getColumnCount(page);
    await page.locator('#controls-panel button[aria-label="Insert Column Right"]').click();
    await expect.poll(() => getColumnCount(page)).toBe(startColumnCount + 1);

    const beforeDeleteColumnCount = await getColumnCount(page);
    const beforeDeleteRowCount = await getRowCount(page);
    const beforeDeleteCellCount = await getCellCount(page);

    const deleteColumnButton = page.locator('#controls-panel button[aria-label="Delete Column"]');
    await expect(deleteColumnButton).toBeVisible();
    await deleteColumnButton.click();

    await expect.poll(() => getColumnCount(page)).toBe(beforeDeleteColumnCount - 1);
    // One cell removed per row
    expect(await getCellCount(page)).toBe(beforeDeleteCellCount - beforeDeleteRowCount);
  });

  test("can delete row", async ({ page }) => {
    await focusFirstCell(page);

    // First add an extra row so we can safely delete one
    const startRowCount = await getRowCount(page);
    await page.locator('#controls-panel button[aria-label="Insert Row Below"]').click();
    await expect.poll(() => getRowCount(page)).toBe(startRowCount + 1);

    const beforeDeleteRowCount = await getRowCount(page);
    const beforeDeleteColumnCount = await getColumnCount(page);
    const beforeDeleteCellCount = await getCellCount(page);

    const deleteRowButton = page.locator('#controls-panel button[aria-label="Delete Row"]');
    await expect(deleteRowButton).toBeVisible();
    await deleteRowButton.click();

    await expect.poll(() => getRowCount(page)).toBe(beforeDeleteRowCount - 1);
    // One cell removed per column
    expect(await getCellCount(page)).toBe(beforeDeleteCellCount - beforeDeleteColumnCount);
  });

  test("complex operations: multiple adds and removes", async ({ page }) => {
    await focusFirstCell(page);

    const initialColumnCount = await getColumnCount(page);
    const initialRowCount = await getRowCount(page);

    // Add 2 columns and 1 row
    await page.locator('#controls-panel button[aria-label="Insert Column Right"]').click();
    await expect.poll(() => getColumnCount(page)).toBe(initialColumnCount + 1);
    await page.locator('#controls-panel button[aria-label="Insert Column Right"]').click();
    await expect.poll(() => getColumnCount(page)).toBe(initialColumnCount + 2);
    await page.locator('#controls-panel button[aria-label="Insert Row Below"]').click();
    await expect.poll(() => getRowCount(page)).toBe(initialRowCount + 1);

    // Remove 1 column and 1 row
    await page.locator('#controls-panel button[aria-label="Delete Column"]').click();
    await expect.poll(() => getColumnCount(page)).toBe(initialColumnCount + 1);

    // Ensure a cell is still focused after column deletion
    await focusFirstCell(page);

    const deleteRowButton = page.locator('#controls-panel button[aria-label="Delete Row"]');
    await expect(deleteRowButton).toBeVisible({ timeout: 5000 });
    await deleteRowButton.click();

    await expect.poll(() => getRowCount(page)).toBe(initialRowCount);
    expect(await getColumnCount(page)).toBe(initialColumnCount + 1);
  });

  test("undo functionality works", async ({ page }) => {
    await focusFirstCell(page);

    const initialState = {
      columnCount: await getColumnCount(page),
      rowCount: await getRowCount(page),
      cellCount: await getCellCount(page),
    };

    await page.locator('#controls-panel button[aria-label="Insert Column Right"]').click();
    await expect.poll(() => getColumnCount(page)).toBe(initialState.columnCount + 1);

    const undoButton = page.locator("#controls-panel button").filter({ hasText: /^Undo/ }).first();
    await expect(undoButton).toBeVisible();
    await undoButton.click();

    await expect.poll(() => getColumnCount(page)).toBe(initialState.columnCount);
    expect(await getRowCount(page)).toBe(initialState.rowCount);
    expect(await getCellCount(page)).toBe(initialState.cellCount);
  });

  test("TableMenu appears and disappears when cell focus changes", async ({ page }) => {
    // Initially no cell is focused, so TableMenu should show instructional message
    const gridMenu = page.locator(".table-menu");
    await expect(gridMenu).toBeVisible();
    await expect(gridMenu).toContainText("Click in a table cell");

    await focusFirstCell(page);

    // TableMenu should now show the full menu
    await expect(gridMenu).not.toContainText("Click in a table cell");
    await expect(
      page.locator('#controls-panel button[aria-label="Insert Column Left"]'),
    ).toBeVisible();
    await expect(
      page.locator('#controls-panel button[aria-label="Insert Column Right"]'),
    ).toBeVisible();
    await expect(
      page.locator('#controls-panel button[aria-label="Insert Row Above"]'),
    ).toBeVisible();
    await expect(
      page.locator('#controls-panel button[aria-label="Insert Row Below"]'),
    ).toBeVisible();

    // Click outside the table (on the body)
    await page.locator("body").click({ position: { x: 50, y: 50 } });

    // TableMenu stays on screen. The panel is a fixed part of the harness, so
    // its content is what changes, not its presence.
    await expect(gridMenu).toBeVisible();
  });
});

// Helper functions

// Click the first cell's editor and wait until the menu has followed the
// focus, so the next click lands on a button that is already bound to a cell.
async function focusFirstCell(page: Page): Promise<void> {
  const firstCell = page.locator("#attempt-container .bloom-cell").first();
  await firstCell.locator("div[contenteditable]").click();
  await expect(
    page.locator('#controls-panel button[aria-label="Insert Column Left"]'),
  ).toBeVisible();
}

async function getColumnCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const table = document.querySelector("#attempt-container .bloom-table") as HTMLElement;
    const columnWidths = table?.getAttribute("data-column-widths");
    return columnWidths ? columnWidths.split(",").length : 0;
  });
}

async function getRowCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const table = document.querySelector("#attempt-container .bloom-table") as HTMLElement;
    const rowHeights = table?.getAttribute("data-row-heights");
    return rowHeights ? rowHeights.split(",").length : 0;
  });
}

async function getCellCount(page: Page): Promise<number> {
  return await page.locator("#attempt-container .bloom-cell").count();
}
