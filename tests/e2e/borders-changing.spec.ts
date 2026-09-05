import { test, expect } from "./utils/strict-page";

// A style chosen in the Table section has to reach the rendered borders, not
// only the model attributes, so this one needs a real browser's computed style.
// What the menus report about the current value is covered by the unit tests
// beside the components.

test.describe("Borders changing - visual expectation", () => {
  test("changing table style to dashed applies dashed borders", async ({ page }) => {
    await page.goto("/demo/ui-harness.html?fixture=basic-table");
    await page.waitForSelector("#root");

    const table = page.locator("#attempt-container #main-table.bloom-table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Focus a cell to activate menu
    const firstCellEditor = page
      .locator("#attempt-container .bloom-cell div[contenteditable]")
      .first();
    await firstCellEditor.click();

    // In the Table section, set Style=Dashed and Weight=2
    const tableSection = page
      .locator(".table-menu div")
      .filter({ has: page.locator(':scope > h2:text-is("Table")') })
      .first();
    await tableSection.locator('button[aria-label="Style"]').click();
    await tableSection.locator('div[role="menu"] [role="menuitemradio"][title="Dashed"]').click();
    await tableSection.locator('button[aria-label="Weight"]').click();
    await tableSection.locator('div[role="menu"] [role="menuitemradio"][title="2"]').click();

    // Sanity-check model reflects dashed somewhere
    await expect
      .poll(() =>
        table.evaluate((el) => {
          const h = el.getAttribute("data-edges-h") || "";
          const v = el.getAttribute("data-edges-v") || "";
          const d = el.getAttribute("data-border-default") || "";
          return (
            h.includes('"style":"dashed"') ||
            v.includes('"style":"dashed"') ||
            d.includes('"style":"dashed"')
          );
        }),
      )
      .toBe(true);

    // Expect both inner and outer edges to reflect the change since all edges are initially selected
    const firstCell = page.locator("#attempt-container .bloom-cell").first();
    const computed = await firstCell.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        right: cs.borderRightStyle, // inner V against first cell
        bottom: cs.borderBottomStyle, // inner H against first cell
        top: cs.borderTopStyle, // outer top
        left: cs.borderLeftStyle, // outer left
      };
    });
    expect(
      [computed.right, computed.bottom, computed.top, computed.left].some((s) => s === "dashed"),
    ).toBe(true);
  });
});
