import { test, expect, type Page } from "@playwright/test";

// A table that fills a page to its edges has its pills and "+" buttons outside
// the page: the row pill and the column "+" to the right, the table pill and the
// row "+" below. They are position: fixed, so on their own they add nothing to
// how far the document scrolls, and in a window smaller than the page they could
// never be scrolled into view. These tests scroll as far as the document goes
// and check that each one is then fully inside the window.

// Smaller than the 600 x 800 page in the fixture, in both directions.
const kViewport = { width: 450, height: 500 };

async function scrollToEnd(page: Page) {
  await page.evaluate(() => window.scrollTo(1e6, 1e6));
  // Wait for the scroll to have landed, rather than for a fixed time.
  await page.waitForFunction(
    () =>
      Math.abs(window.scrollX + window.innerWidth - document.documentElement.scrollWidth) <= 1 &&
      Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 1,
  );
}

async function expectInsideWindow(page: Page, selector: string, what: string) {
  const el = page.locator(selector);
  await expect(el, `${what} should be showing`).toBeVisible();
  const box = (await el.boundingBox())!;
  const inside =
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= kViewport.width &&
    box.y + box.height <= kViewport.height;
  expect(
    inside,
    `${what} is at (${Math.round(box.x)}, ${Math.round(box.y)}) to ` +
      `(${Math.round(box.x + box.width)}, ${Math.round(box.y + box.height)}), ` +
      `but the window is ${kViewport.width} x ${kViewport.height}.`,
  ).toBe(true);
}

test.describe("pills outside a page that fills the window can be scrolled to", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(kViewport);
    await page.goto("/demo/ui-harness.html?fixture=page-edge");
    await page.waitForSelector("#edge-table");
    // The fixture's page really is bigger than the window.
    const pageBox = (await page.locator("#edge-page").boundingBox())!;
    expect(pageBox.width).toBeGreaterThan(kViewport.width);
    expect(pageBox.height).toBeGreaterThan(kViewport.height);
  });

  test("the row pill and table pill of the bottom-right cell", async ({ page }) => {
    // The last cell: its row pill is right of the page, the table pill below it.
    await page.locator("#edge-table > .bloom-cell:nth-child(4) [contenteditable]").click();
    await expect(page.locator('[data-btable-menu-pill="row"]')).toBeVisible();

    await scrollToEnd(page);
    await expectInsideWindow(page, '[data-btable-menu-pill="row"]', "The row pill");
    await expectInsideWindow(page, '[data-btable-menu-pill="table"]', "The table pill");
  });
});
