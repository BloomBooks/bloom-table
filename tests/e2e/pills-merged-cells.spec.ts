import { test, expect, type Page } from "@playwright/test";

// The row pill sits outside the row's last cell, and the column pill above the
// column's top cell. When that cell is merged across several rows (columns), the
// pill must still be centred on the selected row (column), the one its menu acts
// on, not on the whole merged cell.

async function select(page: Page, selector: string) {
  await page.locator(`${selector} [contenteditable]`).click();
}

async function middle(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("pills beside merged cells", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto("/demo/ui-harness.html?fixture=merged-cells");
    await page.waitForSelector("#merged-top");
  });

  test("the row pill is level with the selected row, not the merged cell beside it", async ({
    page,
  }) => {
    const firstRowCell = "#merged-right > .bloom-cell:nth-child(1)";
    const mergedCell = "#merged-right > .bloom-cell:nth-child(2)";
    const row = await middle(page, firstRowCell);
    const merged = await middle(page, mergedCell);
    expect(
      Math.abs(row.y - merged.y),
      "the merged cell's middle should be well away from the first row's",
    ).toBeGreaterThan(40);

    await select(page, firstRowCell);
    const pill = await middle(page, '[data-btable-menu-pill="row"]');
    expect(
      Math.abs(pill.y - row.y),
      `the row pill's middle (${Math.round(pill.y)}) should be level with the first row's (${Math.round(row.y)})`,
    ).toBeLessThanOrEqual(2);
  });

  test("the column pill is over the selected column, not the merged cell above it", async ({
    page,
  }) => {
    const secondColumnCell = "#merged-top > .bloom-cell:nth-child(4)";
    const mergedCell = "#merged-top > .bloom-cell:nth-child(1)";
    const column = await middle(page, secondColumnCell);
    const merged = await middle(page, mergedCell);
    expect(
      Math.abs(column.x - merged.x),
      "the merged cell's middle should be well away from the second column's",
    ).toBeGreaterThan(40);

    await select(page, secondColumnCell);
    const pill = await middle(page, '[data-btable-menu-pill="column"]');
    expect(
      Math.abs(pill.x - column.x),
      `the column pill's middle (${Math.round(pill.x)}) should be over the second column's (${Math.round(column.x)})`,
    ).toBeLessThanOrEqual(2);
  });
});
