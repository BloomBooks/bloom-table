import { test, expect } from "@playwright/test";

// Failing test: after changing Style to Dashed (and Weight to 2),
// computed borders for the table's outer edges should be dashed.
// Today they are not, so this spec intentionally fails to signal the bug.

test.describe("Borders changing - visual expectation", () => {
  test("initial Table border selector shows 1px solid and all edges selected (BUG)", async ({
    page,
  }) => {
    await page.goto("/demo/index.html");
    await page.waitForSelector("#root");
    await page.waitForSelector("#example-list");

    // Select New-table
    const newGridItem = page.locator("#example-list").getByText("New-table", { exact: false });
    await newGridItem.click();

    const table = page.locator("#example-container #main-table.bloom-table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Focus a cell to activate menu
    const firstCellEditor = page.locator("#example-container .bloom-cell div[contenteditable]").first();
    await firstCellEditor.click();

    const tableSection = page
      .locator(".table-menu div")
      .filter({ has: page.locator("h2", { hasText: "Table" }) })
      .first();

    // Read button titles which encode the current value (e.g., "Style: solid", "Weight: 1")
    const styleTitle = await tableSection
      .locator('button[aria-label="Style"]')
      .getAttribute("title");
    const weightTitle = await tableSection
      .locator('button[aria-label="Weight"]')
      .getAttribute("title");

    // Expect solid and 1. This currently fails (shows Ø/Mixed).
    expect(styleTitle?.toLowerCase()).toContain("solid");
    expect(weightTitle).toMatch(/\b1\b/);

    // All edges (inner + outer) should be selected initially when they are uniform; menus should not show Mixed
    expect(styleTitle?.toLowerCase()).not.toContain("mixed");
    expect(weightTitle?.toLowerCase()).not.toContain("mixed");
  });
  test("changing table style to dashed applies dashed borders (BUG)", async ({ page }) => {
    await page.goto("/demo/index.html");
    await page.waitForSelector("#root");
    await page.waitForSelector("#example-list");

    // Select New-table
    const newGridItem = page.locator("#example-list").getByText("New-table", { exact: false });
    await newGridItem.click();

    const table = page.locator("#example-container #main-table.bloom-table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Focus a cell to activate menu
    const firstCellEditor = page.locator("#example-container .bloom-cell div[contenteditable]").first();
    await firstCellEditor.click();

    // In the Table section, set Style=Dashed and Weight=2
    const tableSection = page
      .locator(".table-menu div")
      .filter({ has: page.locator("h2", { hasText: "Table" }) })
      .first();
    await tableSection.locator('button[aria-label="Style"]').click();
    await tableSection.locator('div[role="menu"] [role="menuitemradio"][title="Dashed"]').click();
    await tableSection.locator('button[aria-label="Weight"]').click();
    await tableSection.locator('div[role="menu"] [role="menuitemradio"][title="2"]').click();

    await page.waitForTimeout(150);

    // Sanity-check model reflects dashed somewhere
    const modelHasDashed = await table.evaluate((el) => {
      const h = el.getAttribute("data-edges-h") || "";
      const v = el.getAttribute("data-edges-v") || "";
      const d = el.getAttribute("data-border-default") || "";
      return (
        h.includes('"style":"dashed"') ||
        v.includes('"style":"dashed"') ||
        d.includes('"style":"dashed"')
      );
    });
    expect(modelHasDashed).toBe(true);

    // Expect both inner and outer edges to reflect the change since all edges are initially selected
    const firstCell = page.locator("#example-container .bloom-cell").first();
    const computed = await firstCell.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        right: cs.borderRightStyle, // inner V against first cell
        bottom: cs.borderBottomStyle, // inner H against first cell
        top: cs.borderTopStyle, // outer top
        left: cs.borderLeftStyle, // outer left
      };
    });
    // This is what should happen once the bug is fixed:
    expect(
      [computed.right, computed.bottom, computed.top, computed.left].some((s) => s === "dashed"),
    ).toBe(true);
  });
});
