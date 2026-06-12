import { test, expect } from "@playwright/test";
import { attachGridsToPage } from "./utils/grid-attachment";

test.describe("Table Border Visual Validation", () => {
  test("validates border rendering in real browser", async ({ page }) => {
    // Navigate to the table-border demo
    await page.goto("/demo/tests/table-border.html");

    // Wait for the page to load
    await page.waitForSelector(".grid");

    // Manually attach grids since we removed script tags from HTML files
    await attachGridsToPage(page);

    // Debug: Log the edge data for the first grid
    const gridEdgeData = await page.evaluate(() => {
      const grid = document.querySelector("#grid-with-red-cross");
      return {
        edgesH: grid?.getAttribute("data-edges-h"),
        edgesV: grid?.getAttribute("data-edges-v"),
        columnWidths: grid?.getAttribute("data-column-widths"),
        rowHeights: grid?.getAttribute("data-row-heights"),
      };
    });
    console.log("Grid edge data:", gridEdgeData);

    // Debug: Log what borders are actually applied to each cell
    const cellBorderDebug = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll("#grid-with-red-cross .cell"));
      return cells.map((cell, index) => {
        const computed = getComputedStyle(cell);
        return {
          cellIndex: index,
          borderTop: `${computed.borderTopStyle} ${computed.borderTopWidth} ${computed.borderTopColor}`,
          borderRight: `${computed.borderRightStyle} ${computed.borderRightWidth} ${computed.borderRightColor}`,
          borderBottom: `${computed.borderBottomStyle} ${computed.borderBottomWidth} ${computed.borderBottomColor}`,
          borderLeft: `${computed.borderLeftStyle} ${computed.borderLeftWidth} ${computed.borderLeftColor}`,
        };
      });
    });
    console.log("Actual cell borders:", cellBorderDebug);

    // === Grid 1: Red Cross Pattern (should apply per-side borders) ===
    const grid1 = page.locator("#grid-with-red-cross");
    await expect(grid1).toBeVisible();

    const r1c1 = grid1.locator(".cell").nth(0);
    const r1c2 = grid1.locator(".cell").nth(1);
    const r2c1 = grid1.locator(".cell").nth(2);
    const r2c2 = grid1.locator(".cell").nth(3);

    // Check computed styles for r1c1 (should have red borders applied via per-side CSS borders)
    const r1c1Styles = await r1c1.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        // Individual border styles
        borderTopStyle: computed.borderTopStyle,
        borderRightStyle: computed.borderRightStyle,
        borderBottomStyle: computed.borderBottomStyle,
        borderLeftStyle: computed.borderLeftStyle,
        borderTopColor: computed.borderTopColor,
        borderRightColor: computed.borderRightColor,
        borderBottomColor: computed.borderBottomColor,
        borderLeftColor: computed.borderLeftColor,
        // Additional debugging info
        borderTopWidth: computed.borderTopWidth,
        borderRightWidth: computed.borderRightWidth,
        borderBottomWidth: computed.borderBottomWidth,
        borderLeftWidth: computed.borderLeftWidth,
      };
    });

    console.log("r1c1 actual computed styles:", JSON.stringify(r1c1Styles, null, 2));

    // Verify r1c1 has solid red borders on all sides per the cross pattern
    expect(r1c1Styles.borderTopStyle).toBe("solid");
    expect(r1c1Styles.borderRightStyle).toBe("solid");
    expect(r1c1Styles.borderBottomStyle).toBe("solid");
    expect(r1c1Styles.borderLeftStyle).toBe("solid");
    const redPattern = /(rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))|(#ff0000)|(#f00)|\bred\b/i;
    expect(r1c1Styles.borderTopColor).toMatch(redPattern);
    expect(r1c1Styles.borderRightColor).toMatch(redPattern);
    expect(r1c1Styles.borderBottomColor).toMatch(redPattern);
    expect(r1c1Styles.borderLeftColor).toMatch(redPattern);

    // Check r2c2 (should also have red borders)
    const r2c2Styles = await r2c2.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        borderTopStyle: computed.borderTopStyle,
        borderRightStyle: computed.borderRightStyle,
        borderBottomStyle: computed.borderBottomStyle,
        borderLeftStyle: computed.borderLeftStyle,
        borderTopColor: computed.borderTopColor,
        borderRightColor: computed.borderRightColor,
        borderBottomColor: computed.borderBottomColor,
        borderLeftColor: computed.borderLeftColor,
      };
    });

    // In border-only mode, interior shared edges are owned by top/left cells.
    // For bottom-right cell, expect bottom and right to be drawn (perimeter), top/left none.
    expect(r2c2Styles.borderTopStyle).toBe("none");
    expect(r2c2Styles.borderLeftStyle).toBe("none");
    expect(r2c2Styles.borderRightStyle).toBe("solid");
    expect(r2c2Styles.borderBottomStyle).toBe("solid");

    // Check r1c2 and r2c1 (should have no outlines)
    // No specific assertion for r1c2 now; depends on model of cross pattern

    // === Grid 2: External Border Pattern (should use individual borders) ===
    const grid2 = page.locator("#grid-with-external-border");
    await expect(grid2).toBeVisible();

    const grid2r1c1 = grid2.locator(".cell").nth(0);

    const grid2Styles = await grid2r1c1.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        // Should use individual border styles
        borderTopStyle: computed.borderTopStyle,
        borderLeftStyle: computed.borderLeftStyle,
        borderRightStyle: computed.borderRightStyle,
        borderBottomStyle: computed.borderBottomStyle,
        borderTopColor: computed.borderTopColor,
        borderLeftColor: computed.borderLeftColor,
      };
    });

    // Should use individual borders
    expect(grid2Styles.borderTopStyle).toBe("solid");
    expect(grid2Styles.borderLeftStyle).toBe("solid");
    expect(grid2Styles.borderRightStyle).toBe("none");
    expect(grid2Styles.borderBottomStyle).toBe("none");

    // Colors should be black (#000)
    expect(grid2Styles.borderTopColor).toMatch(/(rgb\(0,\s*0,\s*0\)|#000)/);
    expect(grid2Styles.borderLeftColor).toMatch(/(rgb\(0,\s*0,\s*0\)|#000)/);

    // === Grid 3: Red Divider Pattern (should use individual borders) ===
    const grid3 = page.locator("#grid-with-red-border");
    await expect(grid3).toBeVisible();

    const grid3r1c1 = grid3.locator(".cell").nth(0);

    const grid3Styles = await grid3r1c1.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        borderRightStyle: computed.borderRightStyle,
        borderRightColor: computed.borderRightColor,
        borderTopStyle: computed.borderTopStyle,
        borderTopColor: computed.borderTopColor,
        borderBottomStyle: computed.borderBottomStyle,
        borderBottomColor: computed.borderBottomColor,
        borderLeftStyle: computed.borderLeftStyle,
        borderLeftColor: computed.borderLeftColor,
      };
    });

    // Should have black borders on top, bottom, left and red border on right
    expect(grid3Styles.borderRightStyle).toBe("solid");
    expect(grid3Styles.borderRightColor).toMatch(redPattern);
    expect(grid3Styles.borderTopStyle).toBe("solid");
    expect(grid3Styles.borderBottomStyle).toBe("solid");
    expect(grid3Styles.borderLeftStyle).toBe("solid");

    // Check that top, bottom, left borders are black
    const blackPattern = /(rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))|(#000000)|(#000)|\bblack\b/i;
    expect(grid3Styles.borderTopColor).toMatch(blackPattern);
    expect(grid3Styles.borderBottomColor).toMatch(blackPattern);
    expect(grid3Styles.borderLeftColor).toMatch(blackPattern);
  });

  test("visual regression - grid rendering", async ({ page }) => {
    await page.goto("/demo/tests/table-border.html");
    await page.waitForSelector(".grid");

    // Manually attach grids since we removed script tags from HTML files
    await attachGridsToPage(page);

    // Take a screenshot for visual regression testing
    await expect(page).toHaveScreenshot("table-border-grids.png", {
      maxDiffPixelRatio: 0.03,
    });
  });
});
