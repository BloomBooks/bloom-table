import { test, expect, type Page } from "@playwright/test";

// A table that fills a page to its edges has its pills and "+" buttons outside
// the page: the row pill and the column "+" to the right, the table pill and the
// row "+" below. They are position: fixed, so on their own they add nothing to
// how far the document scrolls, and in a window smaller than the page they could
// never be scrolled into view.

// The UI harness's body hides its overflow. Bloom's page frame scrolls, so let
// this one scroll the same way.
async function letTheWindowScroll(page: Page) {
  await page.evaluate(() => {
    document.body.style.overflow = "visible";
    document.body.style.height = "auto";
  });
}

async function expectInsideWindow(page: Page, selector: string, what: string) {
  const viewport = page.viewportSize()!;
  const el = page.locator(selector);
  await expect(el, `${what} should be showing`).toBeVisible();
  const box = (await el.boundingBox())!;
  const inside =
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height;
  expect(
    inside,
    `${what} is at (${Math.round(box.x)}, ${Math.round(box.y)}) to ` +
      `(${Math.round(box.x + box.width)}, ${Math.round(box.y + box.height)}), ` +
      `but the window is ${viewport.width} x ${viewport.height}.`,
  ).toBe(true);
}

test.describe("pills outside a page that fills the window can be scrolled to", () => {
  // Smaller than the 600 x 800 page in the fixture, in both directions.
  const kViewport = { width: 450, height: 500 };

  test("the row pill and table pill of the bottom-right cell", async ({ page }) => {
    await page.setViewportSize(kViewport);
    await page.goto("/demo/ui-harness.html?fixture=page-edge");
    await page.waitForSelector("#edge-table");
    await letTheWindowScroll(page);
    const pageBox = (await page.locator("#edge-page").boundingBox())!;
    expect(pageBox.width, "the page should be wider than the window").toBeGreaterThan(kViewport.width);
    expect(pageBox.height, "the page should be taller than the window").toBeGreaterThan(kViewport.height);

    // The last cell: its row pill is right of the page, the table pill below it.
    await page.locator("#edge-table > .bloom-cell:nth-child(4) [contenteditable]").click();
    await expect(page.locator('[data-btable-menu-pill="row"]')).toBeVisible();

    // Scroll as a person does, with the wheel, as far as the document goes.
    await page.mouse.move(kViewport.width / 2, kViewport.height / 2);
    await page.mouse.wheel(5000, 5000);
    await page.waitForFunction(
      () =>
        Math.abs(window.scrollX + window.innerWidth - document.documentElement.scrollWidth) <= 1 &&
        Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 1,
    );

    await expectInsideWindow(page, '[data-btable-menu-pill="row"]', "The row pill");
    await expectInsideWindow(page, '[data-btable-menu-pill="table"]', "The table pill");
  });
});

test.describe("pills beside a row that runs past the page", () => {
  test("the row pill stays beside the visible part of the row, and opens its menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto("/demo/ui-harness.html?fixture=overflowing-cell");
    await page.waitForSelector("#clip-table");
    const pageBox = (await page.locator("#clip-page").boundingBox())!;
    const pageBottom = pageBox.y + pageBox.height;
    const lastCellOfRow = page.locator("#clip-table > .bloom-cell:nth-child(4)");
    const cellBox = (await lastCellOfRow.boundingBox())!;
    expect(
      cellBox.y + cellBox.height / 2,
      "the second row's middle should be below the page",
    ).toBeGreaterThan(pageBottom);

    // Select the row's first cell without scrolling the page element. Focusing a
    // cell normally scrolls the page's content (overflow: hidden can still be
    // scrolled by code) to show it; Bloom showed such a page unscrolled.
    await page.evaluate(() =>
      (
        document.querySelector("#clip-table > .bloom-cell:nth-child(3) [contenteditable]") as HTMLElement
      ).focus({ preventScroll: true }),
    );
    const pill = page.locator('[data-btable-menu-pill="row"]');
    await expect(pill).toBeVisible();
    expect(
      (await lastCellOfRow.boundingBox())!.y,
      "selecting the cell should not have scrolled the page's content",
    ).toBe(cellBox.y);

    const pillBox = (await pill.boundingBox())!;
    expect(
      pillBox.y + pillBox.height / 2,
      `the row pill's middle should be no lower than the page's bottom edge (${Math.round(pageBottom)})`,
    ).toBeLessThanOrEqual(pageBottom + 1);

    // Moving the pointer onto the pill must not hide it before the click lands.
    await pill.click();
    await expect(page.locator('[data-btable-menu="row"]')).toBeVisible();
  });
});
