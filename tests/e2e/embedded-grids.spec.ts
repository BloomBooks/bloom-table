import { test, expect } from "@playwright/test";
import { attachGridsToPage } from "./utils/grid-attachment";

test.describe("Embedded Grids", () => {
  test("validates embedded grid rendering and layout", async ({ page }) => {
    // Navigate to the embedded grids demo
    await page.goto("/demo/tests/embedded-grids.html");

    // Wait for the page to load
    await page.waitForSelector(".grid");

    // Manually attach grids since we removed script tags from HTML files
    await attachGridsToPage(page);

    // === Test the main grid with embedded grid ===
    const mainGrid = page.locator("#main-grid");
    await expect(mainGrid).toBeVisible();

    // Check that the main grid has 3 columns in 1 row as expected
    const mainGridStyles = await mainGrid.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        display: computed.display,
        gridTemplateColumns: computed.gridTemplateColumns,
        gridTemplateRows: computed.gridTemplateRows,
      };
    });

    expect(mainGridStyles.display).toBe("grid");
    // Should have 3 columns of 200px each
    expect(mainGridStyles.gridTemplateColumns).toBe("200px 200px 200px");
    expect(mainGridStyles.gridTemplateRows).toBe("150px");

    // === Test the embedded grid structure ===
    const embeddedGrid = mainGrid.locator(".cell[data-content-type='grid'] > .grid");
    await expect(embeddedGrid).toBeVisible();

    // Check that the embedded grid has proper 2x2 layout
    const embeddedGridStyles = await embeddedGrid.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        display: computed.display,
        gridTemplateColumns: computed.gridTemplateColumns,
        gridTemplateRows: computed.gridTemplateRows,
      };
    });

    expect(embeddedGridStyles.display).toBe("grid");
    // The grid should have 2 columns - the exact size doesn't matter as much as having 2 equal columns
    const columns = embeddedGridStyles.gridTemplateColumns.split(" ");
    expect(columns).toHaveLength(2);
    const rows = embeddedGridStyles.gridTemplateRows.split(" ");
    expect(rows).toHaveLength(2);

    // === Test embedded grid cells ===
    const embeddedCells = embeddedGrid.locator(".cell");
    await expect(embeddedCells).toHaveCount(4);

    // Check that all embedded cells are visible and have proper content
    const cellContents: string[] = [];
    for (let i = 0; i < 4; i++) {
      const cell = embeddedCells.nth(i);
      await expect(cell).toBeVisible();
      const text = await cell.locator("div[contenteditable]").textContent();
      cellContents.push(text || "");
    }
    expect(cellContents).toEqual(["A1", "A2", "B1", "B2"]);

    // === Test that borders are applied ===
    // Check that embedded grid cells have borders
    for (let i = 0; i < 4; i++) {
      const cell = embeddedCells.nth(i);
      const cellStyles = await cell.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          borderTopStyle: computed.borderTopStyle,
          borderRightStyle: computed.borderRightStyle,
          borderBottomStyle: computed.borderBottomStyle,
          borderLeftStyle: computed.borderLeftStyle,
          borderTopWidth: computed.borderTopWidth,
          borderRightWidth: computed.borderRightWidth,
          borderBottomWidth: computed.borderBottomWidth,
          borderLeftWidth: computed.borderLeftWidth,
        };
      });

      // Each cell should have at least some borders applied (depending on position)
      const hasBorders =
        cellStyles.borderTopStyle !== "none" ||
        cellStyles.borderRightStyle !== "none" ||
        cellStyles.borderBottomStyle !== "none" ||
        cellStyles.borderLeftStyle !== "none";

      expect(hasBorders).toBe(true);

      // Additionally, check that some borders have non-zero width
      const hasNonZeroWidth =
        parseFloat(cellStyles.borderTopWidth) > 0 ||
        parseFloat(cellStyles.borderRightWidth) > 0 ||
        parseFloat(cellStyles.borderBottomWidth) > 0 ||
        parseFloat(cellStyles.borderLeftWidth) > 0;

      expect(hasNonZeroWidth).toBe(true);
    }
  });

  test("validates that embedded grids fill their parent cell", async ({ page }) => {
    await page.goto("/demo/tests/embedded-grids.html");
    await page.waitForSelector(".grid");

    const parentCell = page.locator("#main-grid .cell[data-content-type='grid']");
    const embeddedGrid = parentCell.locator("> .grid");

    // Get dimensions of parent cell and embedded grid
    const parentRect = await parentCell.boundingBox();
    const embeddedRect = await embeddedGrid.boundingBox();

    expect(parentRect).not.toBeNull();
    expect(embeddedRect).not.toBeNull();

    // Embedded grid should fill most of the parent cell (allowing for any padding)
    const widthRatio = embeddedRect!.width / parentRect!.width;
    const heightRatio = embeddedRect!.height / parentRect!.height;

    expect(widthRatio).toBeGreaterThan(0.9); // At least 90% of parent width
    expect(heightRatio).toBeGreaterThan(0.9); // At least 90% of parent height
  });
});
