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

test.describe("Focus after insert", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/pages/new-grid.html");
    // Sanity: wait for the grid
    await expect(page.locator("#main-grid")).toBeVisible();
    // Attach grid behavior by injecting a module script (avoids TS resolving /src path)
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

  test("Add row below focuses same column in new row", async ({ page }) => {
    const grid = "#main-grid";
    // 2x2: focus r0c1
    await focusCell(page, grid, nthCellIndex(0, 1, 2));

    // Insert row below via controller
    await page.evaluate(() => {
      const { BloomGrid } = (window as any).__BG;
      const grid = document.querySelector("#main-grid") as HTMLElement;
      const controller = new BloomGrid(grid);
      const selected = document.querySelector(".cell.cell--selected") as HTMLElement;
      const cells = Array.from(grid.children);
      const idx = cells.indexOf(selected);
      const colCount =
        (grid.getAttribute("data-column-widths") || "").split(",").filter(Boolean).length || 2;
      const row = Math.floor(idx / colCount);
      controller.addRowAt(row + 1);
    });

    // Expect focus on row 1, col 1 (same column) in the newly inserted row
    const expectedIndex = nthCellIndex(1, 1, 2);
    const expectedCell = page.locator(`${grid} .cell`).nth(expectedIndex);
    await expect(expectedCell.locator("[contenteditable]")).toBeFocused();
  });

  test("Add column right focuses same row in new column", async ({ page }) => {
    const grid = "#main-grid";
    // 2x2: focus r1c0
    await focusCell(page, grid, nthCellIndex(1, 0, 2));

    await page.evaluate(() => {
      const { BloomGrid } = (window as any).__BG;
      const grid = document.querySelector("#main-grid") as HTMLElement;
      const controller = new BloomGrid(grid);
      const selected = document.querySelector(".cell.cell--selected") as HTMLElement;
      const cells = Array.from(grid.children);
      const idx = cells.indexOf(selected);
      const colCount =
        (grid.getAttribute("data-column-widths") || "").split(",").filter(Boolean).length || 2;
      const col = idx % colCount;
      controller.addColumnAt(col + 1);
    });

    // Now 3 columns; focused at row 1, new column index 1
    const expectedIndex = nthCellIndex(1, 1, 3);
    const expectedCell = page.locator(`${grid} .cell`).nth(expectedIndex);
    await expect(expectedCell.locator("[contenteditable]")).toBeFocused();
  });
});
