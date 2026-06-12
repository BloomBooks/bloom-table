import { test, expect } from "@playwright/test";

// Assumes dev server is already running on :5173 (per request)

test.describe("yada primer double border", () => {
  test("top-right cell has double top and right while outer table has none", async ({ page }) => {
    await page.goto("/demo/exercises/yada-primer.html");

    // Locate the target nested table: use a robust path by text around it
    // The upper-right "Y y" cell is the top-right cell of the 2x2 table within the top area.
    const yCell = page.getByText(/^Y y$/).locator("xpath=ancestor::*[@class='cell'][1]");

    // Ensure it is visible
    await expect(yCell).toBeVisible();

    // Read computed styles for top and right borders
    const styles = await yCell.evaluate((el) => {
      const cs = window.getComputedStyle(el as HTMLElement);
      return {
        topStyle: cs.borderTopStyle,
        rightStyle: cs.borderRightStyle,
        topWidth: cs.borderTopWidth,
        rightWidth: cs.borderRightWidth,
      };
    });

    // Expect double with at least 4px due to renderer clamp
    expect(styles.topStyle).toBe("double");
    expect(parseFloat(styles.topWidth)).toBeGreaterThanOrEqual(4);
    expect(styles.rightStyle).toBe("double");
    expect(parseFloat(styles.rightWidth)).toBeGreaterThanOrEqual(4);

    // Also assert that the outermost table has no border (visually none on its perimeter)
    const outerGrid = page.locator("#main-table > .cell:nth-child(2) > .table");
    await expect(outerGrid).toBeVisible();
    const outerTopLeftCell = outerGrid.locator(".cell").first();
    const outerStyles = await outerTopLeftCell.evaluate((el) => {
      const cs = window.getComputedStyle(el as HTMLElement);
      return {
        topStyle: cs.borderTopStyle,
        leftStyle: cs.borderLeftStyle,
        topWidth: cs.borderTopWidth,
        leftWidth: cs.borderLeftWidth,
      };
    });
    // These might be none due to data-border-default or explicit none; assert not double and not >=4
    expect(outerStyles.topStyle === "none" || parseFloat(outerStyles.topWidth) < 4).toBeTruthy();
    expect(outerStyles.leftStyle === "none" || parseFloat(outerStyles.leftWidth) < 4).toBeTruthy();
  });
});
