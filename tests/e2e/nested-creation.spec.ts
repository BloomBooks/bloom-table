import { test, expect } from "./utils/strict-page";

// The full user journey for creating and growing a nested table, exactly as a
// user does it — no fixture pre-builds the nested table:
// 1) start from the blank table  2) click a cell  3) right-click and switch the
// cell's content type to Table  4) double-click a nested cell to enter
// 5) click the "+" at the right edge.
// Regression context: with the top-level 60px track minimum, a nested table in
// a small hug-sized cell was over-constrained; the absolute box shifted left
// and the growth was invisible (or the table vanished from its cell entirely).
test("a nested table created via the menu can be grown with the + buttons", async ({ page }) => {
  await page.goto("/demo/ui-harness.html", { waitUntil: "load" });
  await page.waitForSelector("#attempt-container > .bloom-table .bloom-cell");
  const outer = page.locator("#attempt-container > .bloom-table");
  const cell00 = outer.locator(":scope > .bloom-cell").first();

  // Click in a cell, then right-click and set its content type to Table.
  await cell00
    .locator(":scope > [contenteditable]")
    .first()
    .evaluate((el) => (el as HTMLElement).focus());
  await cell00.click({ button: "right", force: true });
  const popup = page.locator("[data-btable-menu]");
  await expect(popup).toBeVisible();
  await popup.locator('button[title="Table"], button[aria-label="Table"]').first().click();

  const nested = cell00.locator(":scope > .bloom-table");
  await expect(nested).toHaveAttribute("data-column-widths", "fill,fill");
  await expect(nested).toHaveAttribute("data-row-heights", "fill,fill");

  // Enter the nested table, add a column and a row with the on-canvas "+".
  await nested.locator(":scope > .bloom-cell").first().dblclick({ force: true });
  await expect(nested).toHaveClass(/bloom-current-table/);
  await page.locator('button[aria-label="Add column at the right edge"]').click({ force: true });
  await expect(nested).toHaveAttribute("data-column-widths", "fill,fill,fill");
  await page.locator('button[aria-label="Add row at the bottom edge"]').click({ force: true });
  await expect(nested).toHaveAttribute("data-row-heights", "fill,fill,fill");

  await expect(nested).toHaveCount(1);
  expect(await nested.locator(":scope > .bloom-cell").count()).toBe(9);
  // The outer table is untouched.
  await expect(outer).toHaveAttribute("data-column-widths", "hug,hug");
  expect(await outer.locator(":scope > .bloom-cell").count()).toBe(4);

  // The growth is genuinely visible: the nested table is flush with its host
  // cell on every side. Regression context: focusing the new cell used to
  // scroll the overflow:hidden host cell, and the stuck scrollTop shifted the
  // nested table upward, leaving a gap between the interior grid lines and the
  // host cell's bottom border (overflow:clip forbids that scroll now).
  const geometry = await nested.evaluate((t) => {
    const host = (t as HTMLElement).parentElement!;
    return {
      table: (t as HTMLElement).getBoundingClientRect().toJSON(),
      host: host.getBoundingClientRect().toJSON(),
      hostScrollTop: host.scrollTop,
    };
  });
  expect(geometry.hostScrollTop).toBe(0);
  expect(geometry.table.left).toBeGreaterThanOrEqual(geometry.host.left - 1);
  expect(geometry.table.right).toBeLessThanOrEqual(geometry.host.right + 1);
  expect(geometry.table.top).toBeGreaterThanOrEqual(geometry.host.top - 1);
  expect(geometry.table.bottom).toBeLessThanOrEqual(geometry.host.bottom + 1);
  expect(geometry.table.bottom).toBeGreaterThan(geometry.host.bottom - 3);
  expect(geometry.table.width).toBeGreaterThan(geometry.host.width * 0.9);
  expect(geometry.table.height).toBeGreaterThan(geometry.host.height * 0.9);

  // Visual check, with the chrome put to rest first: leave the nested table
  // and park the pointer away from every table.
  await page.keyboard.press("Escape");
  await page.mouse.move(2, 2);
  await page.waitForTimeout(200);
  await expect(page.locator("#editor")).toHaveScreenshot("nested-created-and-grown.png");
});
