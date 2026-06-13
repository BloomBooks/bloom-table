import { test, expect } from "@playwright/test";

test.describe("Cell BorderControl shows current perimeter state", () => {
  test("first cell shows 1px solid; second none; last solid", async ({ page }) => {
    await page.goto("/demo/index.html");
    await page.waitForSelector("#root");
    await page.waitForSelector("#example-list");

    // Open Table-border example
    await page.locator("#example-list").getByText("table-border", { exact: false }).click();
    const table = page.locator("#example-container #table-with-red-cross.bloom-table");
    await expect(table).toBeVisible();

    // Focus first cell (r1c1) and read Cell section menus
    const firstCellEditor = table.locator(".bloom-cell div[contenteditable]"),
      second = firstCellEditor.nth(1);
    await firstCellEditor.first().click();

    const cellSection = page
      .locator(".table-menu div")
      .filter({ has: page.locator("h2", { hasText: "Cell" }) })
      .first();
    const styleTitle1 = await cellSection
      .locator('button[aria-label="Style"]')
      .getAttribute("title");
    const weightTitle1 = await cellSection
      .locator('button[aria-label="Weight"]')
      .getAttribute("title");
    expect(styleTitle1?.toLowerCase()).toContain("solid");
    expect(weightTitle1).toMatch(/\b1\b/);

    // Focus second cell (r1c2)
    await second.click();
    const styleTitle2 = await cellSection
      .locator('button[aria-label="Style"]')
      .getAttribute("title");
    const weightTitle2 = await cellSection
      .locator('button[aria-label="Weight"]')
      .getAttribute("title");
    expect(styleTitle2?.toLowerCase()).toContain("solid");
    expect(weightTitle2).toMatch(/\b1\b/);

    // Focus last cell (r2c2) which has solid red border
    const lastCellEditor = firstCellEditor.nth(3);
    await lastCellEditor.click();
    const styleTitleLast = await cellSection
      .locator('button[aria-label="Style"]')
      .getAttribute("title");
    const weightTitleLast = await cellSection
      .locator('button[aria-label="Weight"]')
      .getAttribute("title");
    expect(styleTitleLast?.toLowerCase()).toContain("solid");
    expect(weightTitleLast).toMatch(/\b1\b/);
    expect(styleTitleLast?.toLowerCase()).not.toContain("mixed");
    expect(weightTitleLast?.toLowerCase()).not.toContain("mixed");
  });
});
