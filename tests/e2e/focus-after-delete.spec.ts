import { test, expect } from "@playwright/test";

// Helper to focus a specific cell by index (focuses its contenteditable child)
async function focusCell(page, gridSelector: string, index: number) {
  const cell = page.locator(`${gridSelector} .cell`).nth(index);
  const editable = cell.locator("[contenteditable]");
  await editable.click();
  await expect(editable).toBeFocused();
}

function nthCellIndex(row: number, col: number, cols: number) {
  return row * cols + col;
}

test.describe("Focus after delete", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/pages/new-grid.html");
    await expect(page.locator("#main-grid")).toBeVisible();
    // Attach grid behavior by injecting a module script and exposing API
    await page.addScriptTag({
      type: "module",
      content: `
        import { attachGrid, BloomGrid } from '/src/index.tsx';
        const grid = document.querySelector('#main-grid');
        window.__BG = { attachGrid, BloomGrid };
        attachGrid(grid);
      `,
    });
  });

  test("Delete row focuses same column in neighbor row", async ({ page }) => {
    const gridSel = "#main-grid";
    // Start with 2x2: focus r0c1
    await focusCell(page, gridSel, nthCellIndex(0, 1, 2));

    // Delete current row (row 0)
    await page.evaluate(() => {
      const { BloomGrid } = (window as any).__BG;
      const grid = document.querySelector("#main-grid") as HTMLElement;
      const controller = new BloomGrid(grid);
      controller.removeRowAt(0);
    });

    // Expect focus on neighbor row (new row 0), same column 1
    const expectedIndex = nthCellIndex(0, 1, 2);
    const expectedCell = page.locator(`${gridSel} .cell`).nth(expectedIndex);
    await expect(expectedCell.locator("[contenteditable]")).toBeFocused();
  });

  test("Delete column focuses same row in neighbor column", async ({ page }) => {
    const gridSel = "#main-grid";
    // Start with 2x2: focus r1c1
    await focusCell(page, gridSel, nthCellIndex(1, 1, 2));

    // Delete current column (column 1)
    await page.evaluate(() => {
      const { BloomGrid } = (window as any).__BG;
      const grid = document.querySelector("#main-grid") as HTMLElement;
      const controller = new BloomGrid(grid);
      controller.removeColumnAt(1);
    });

    // Now 1 column remains; expect focus at same row (1), neighbor column (0)
    const expectedIndex = nthCellIndex(1, 0, 1);
    const expectedCell = page.locator(`${gridSel} .cell`).nth(expectedIndex);
    await expect(expectedCell.locator("[contenteditable]")).toBeFocused();
  });
});
