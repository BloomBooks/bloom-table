import { test, expect } from "@playwright/test";

// Helper to focus a specific cell by index (focuses its contenteditable child)
async function focusCell(page, gridSelector: string, index: number) {
  const cell = page.locator(`${gridSelector} .bloom-cell`).nth(index);
  const editable = cell.locator("[contenteditable]");
  await editable.click();
  await expect(editable).toBeFocused();
}

function nthCellIndex(row: number, col: number, cols: number) {
  return row * cols + col;
}

test.describe("Focus after insert", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/ui-harness.html?fixture=basic-table");
    // The harness attaches table behavior itself; just wait for the table,
    // then expose the controller class for the evaluate() calls below.
    await expect(page.locator("#main-table")).toBeVisible();
    await page.addScriptTag({
      type: "module",
      content: `
        import { BloomTable } from '/src/index.tsx';
        window.__BG = { BloomTable };
      `,
    });
  });

  test("Add row below focuses same column in new row", async ({ page }) => {
    const table = "#main-table";
    // 2x2: focus r0c1
    await focusCell(page, table, nthCellIndex(0, 1, 2));

    // Insert row below via controller
    await page.evaluate(() => {
      const { BloomTable } = (window as any).__BG;
      const table = document.querySelector("#main-table") as HTMLElement;
      const controller = new BloomTable(table);
      const selected = document.querySelector(".bloom-cell.cell--selected") as HTMLElement;
      const cells = Array.from(table.children);
      const idx = cells.indexOf(selected);
      const colCount =
        (table.getAttribute("data-column-widths") || "").split(",").filter(Boolean).length || 2;
      const row = Math.floor(idx / colCount);
      controller.addRowAt(row + 1);
    });

    // Expect focus on row 1, col 1 (same column) in the newly inserted row
    const expectedIndex = nthCellIndex(1, 1, 2);
    const expectedCell = page.locator(`${table} .bloom-cell`).nth(expectedIndex);
    await expect(expectedCell.locator("[contenteditable]")).toBeFocused();
  });

  test("Add column right focuses same row in new column", async ({ page }) => {
    const table = "#main-table";
    // 2x2: focus r1c0
    await focusCell(page, table, nthCellIndex(1, 0, 2));

    await page.evaluate(() => {
      const { BloomTable } = (window as any).__BG;
      const table = document.querySelector("#main-table") as HTMLElement;
      const controller = new BloomTable(table);
      const selected = document.querySelector(".bloom-cell.cell--selected") as HTMLElement;
      const cells = Array.from(table.children);
      const idx = cells.indexOf(selected);
      const colCount =
        (table.getAttribute("data-column-widths") || "").split(",").filter(Boolean).length || 2;
      const col = idx % colCount;
      controller.addColumnAt(col + 1);
    });

    // Now 3 columns; focused at row 1, new column index 1
    const expectedIndex = nthCellIndex(1, 1, 3);
    const expectedCell = page.locator(`${table} .bloom-cell`).nth(expectedIndex);
    await expect(expectedCell.locator("[contenteditable]")).toBeFocused();
  });
});
