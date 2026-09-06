import { test, expect, Page, Locator } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// A row set to "hug" takes its height from the text in it, and a row given a
// fixed height keeps that height whatever the user types. Only a layout engine
// can say what a fifth line of text does to a row, so this belongs here.

const kCell = "#main-table > .bloom-cell";

async function open(page: Page, fixture: string) {
  await page.goto(`/demo/ui-harness.html?fixture=${fixture}`, {
    waitUntil: "load",
  });
  await page.waitForSelector(".bloom-table .bloom-cell");
  await waitForTestHooks(page);
}

const heightOf = (locator: Locator) =>
  locator.evaluate((el) => Math.round(el.getBoundingClientRect().height));

const trackHeights = (table: Locator) =>
  table.evaluate((el) =>
    getComputedStyle(el)
      .gridTemplateRows.split(" ")
      .map((v) => Math.round(parseFloat(v))),
  );

// Five short lines, each its own paragraph, typed where the caret already is.
async function typeFiveLines(page: Page) {
  for (let i = 1; i <= 5; i += 1) {
    await page.keyboard.type(`line ${i}`);
    if (i < 5) await page.keyboard.press("Enter");
  }
}

test.describe("a hug row growing with its text", () => {
  test("five lines make the hug row taller and leave the fixed row at 40px", async ({ page }) => {
    await open(page, "row-growth");
    const table = page.locator("#main-table");
    const before = await trackHeights(table);

    await page.locator(kCell).first().locator(":scope > [contenteditable]").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeFiveLines(page);

    await expect.poll(async () => (await trackHeights(table))[0]).toBeGreaterThan(before[0]);
    const after = await trackHeights(table);
    expect(after[1]).toBe(40);
  });

  test("the table itself grows by what the row gained", async ({ page }) => {
    await open(page, "row-growth");
    const table = page.locator("#main-table");
    const tableBefore = await heightOf(table);
    const rowBefore = (await trackHeights(table))[0];

    await page.locator(kCell).first().locator(":scope > [contenteditable]").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeFiveLines(page);
    await expect.poll(async () => (await trackHeights(table))[0]).toBeGreaterThan(rowBefore);

    const rowGained = (await trackHeights(table))[0] - rowBefore;
    const tableGained = (await heightOf(table)) - tableBefore;
    expect(Math.abs(tableGained - rowGained)).toBeLessThanOrEqual(2);
  });

  test("the fixed row keeps its 40px in the model as well as on the screen", async ({ page }) => {
    await open(page, "row-growth");
    const table = page.locator("#main-table");

    await page.locator(kCell).first().locator(":scope > [contenteditable]").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeFiveLines(page);
    await expect.poll(async () => (await trackHeights(table))[1]).toBe(40);

    expect(await table.getAttribute("data-row-heights")).toBe("hug,40px");
  });

  test("deleting the text again shrinks the row back to where it started", async ({ page }) => {
    await open(page, "row-growth");
    const table = page.locator("#main-table");
    const before = await trackHeights(table);
    const editable = page.locator(kCell).first().locator(":scope > [contenteditable]");

    await editable.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeFiveLines(page);
    await expect.poll(async () => (await trackHeights(table))[0]).toBeGreaterThan(before[0]);

    await editable.evaluate((el) => {
      el.innerHTML = "A1";
    });

    await expect.poll(async () => (await trackHeights(table))[0]).toBe(before[0]);
  });
});

test.describe("a nested table growing inside its host cell", () => {
  // A nested table's hug rows stay at the height the last render measured, so
  // five lines of text overflow a row that never grows. Plan 004, item 2, owns
  // the row-growth rule.
  test.fixme("text in a nested cell grows the nested table, its host cell, and the outer table", async ({
    page,
  }) => {
    await open(page, "nested-row-growth");
    const outer = page.locator("#outer-table");
    const nested = page.locator("#nested-table");
    const hostCell = page.locator("#outer-table > .bloom-cell").first();
    const before = {
      outer: await heightOf(outer),
      nested: await heightOf(nested),
      host: await heightOf(hostCell),
    };

    const editable = nested.locator("> .bloom-cell").first().locator(":scope > [contenteditable]");
    await editable.dblclick();
    await editable.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeFiveLines(page);

    await expect.poll(() => heightOf(nested)).toBeGreaterThan(before.nested);
    expect(await heightOf(hostCell)).toBeGreaterThan(before.host);
    expect(await heightOf(outer)).toBeGreaterThan(before.outer);
  });

  test("the outer table's own row stays a hug row while the nested table grows", async ({
    page,
  }) => {
    await open(page, "nested-row-growth");
    const outer = page.locator("#outer-table");
    const nested = page.locator("#nested-table");

    const editable = nested.locator("> .bloom-cell").first().locator(":scope > [contenteditable]");
    await editable.dblclick();
    await editable.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeFiveLines(page);
    await expect.poll(() => heightOf(nested)).toBeGreaterThan(0);

    expect(await outer.getAttribute("data-row-heights")).toBe("hug");
  });
});
