import { test, expect, Page } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// Only a real browser has a caret and a selection, so what Enter does to the
// markup can be proved here and nowhere else. The library rewrites a plain Enter
// into a paragraph, leaves a modified Enter to the browser, and lets exactly one
// table handle the key when tables nest.

const cell = (page: Page, table: string, index: number) =>
  page.locator(`${table} > .bloom-cell`).nth(index).locator(":scope > [contenteditable]");

const markup = (locator: ReturnType<typeof cell>) => locator.evaluate((el) => el.innerHTML);

// A single click inside a nested table selects its host cell; only a
// double-click moves the caret into the nested cell, and a click afterwards
// collapses the word the double-click selected.
async function caretInNestedCell(page: Page, index: number) {
  const editable = cell(page, "#nested-table", index);
  await editable.dblclick();
  await editable.click();
  await page.keyboard.press("End");
}

async function open(page: Page, fixture: string) {
  await page.goto(`/demo/ui-harness.html?fixture=${fixture}`, {
    waitUntil: "load",
  });
  await page.waitForSelector(".bloom-table .bloom-cell");
  await waitForTestHooks(page);
}

test.describe("typing in a cell", () => {
  test("the typed text lands in the cell the user clicked, and nowhere else", async ({ page }) => {
    await open(page, "basic-table");

    await cell(page, "#main-table", 1).click();
    await page.keyboard.type("Hello");

    await expect(cell(page, "#main-table", 1)).toHaveText("Hello");
    await expect(cell(page, "#main-table", 0)).toHaveText("");
    await expect(cell(page, "#main-table", 2)).toHaveText("");
    await expect(cell(page, "#main-table", 3)).toHaveText("");
  });

  test("Enter starts a new paragraph rather than the browser's own div", async ({ page }) => {
    await open(page, "basic-table");

    await cell(page, "#main-table", 0).click();
    await page.keyboard.type("First");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second");

    const html = await markup(cell(page, "#main-table", 0));
    expect(html).toContain("<p>");
    expect(html).not.toContain("<div>");
    await expect(cell(page, "#main-table", 0).locator("p")).toHaveCount(1);
    await expect(cell(page, "#main-table", 0)).toContainText("First");
    await expect(cell(page, "#main-table", 0)).toContainText("Second");
  });

  test("two Enters make two paragraphs", async ({ page }) => {
    await open(page, "basic-table");

    await cell(page, "#main-table", 0).click();
    await page.keyboard.type("One");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Two");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Three");

    await expect(cell(page, "#main-table", 0).locator("p")).toHaveCount(2);
  });

  test("Shift+Enter breaks the line without starting a paragraph", async ({ page }) => {
    await open(page, "basic-table");

    await cell(page, "#main-table", 0).click();
    await page.keyboard.type("Top");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Bottom");

    const html = await markup(cell(page, "#main-table", 0));
    expect(html).toContain("<br>");
    await expect(cell(page, "#main-table", 0).locator("p")).toHaveCount(0);
    await expect(cell(page, "#main-table", 0)).toContainText("Top");
    await expect(cell(page, "#main-table", 0)).toContainText("Bottom");
  });

  test("the text survives a click into another cell and back", async ({ page }) => {
    await open(page, "basic-table");

    await cell(page, "#main-table", 0).click();
    await page.keyboard.type("Keep me");
    await cell(page, "#main-table", 3).click();
    await page.keyboard.type("Other");
    await cell(page, "#main-table", 0).click();

    await expect(cell(page, "#main-table", 0)).toHaveText("Keep me");
    await expect(cell(page, "#main-table", 3)).toHaveText("Other");
  });
});

test.describe("typing in a nested cell", () => {
  test("the typed text lands in the nested cell, and the outer cells keep theirs", async ({
    page,
  }) => {
    await open(page, "nested-tables");

    await caretInNestedCell(page, 0);
    await page.keyboard.type("-typed");

    await expect(cell(page, "#nested-table", 0)).toHaveText("N11-typed");
    await expect(cell(page, "#nested-table", 1)).toHaveText("N12");
    await expect(cell(page, "#outer-table", 1)).toHaveText("Outer 2");
  });

  test("Enter in a nested cell inserts one paragraph, not one per table", async ({ page }) => {
    await open(page, "nested-tables");

    await caretInNestedCell(page, 0);
    await page.keyboard.press("Enter");
    await page.keyboard.type("Next line");

    const nested = cell(page, "#nested-table", 0);
    await expect(nested.locator("p")).toHaveCount(1);
    await expect(nested.locator("p p")).toHaveCount(0);
    await expect(nested).toContainText("N11");
    await expect(nested).toContainText("Next line");
  });

  test("Shift+Enter in a nested cell starts no paragraph", async ({ page }) => {
    await open(page, "nested-tables");

    await caretInNestedCell(page, 3);
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("more");

    const nested = cell(page, "#nested-table", 3);
    expect(await markup(nested)).toContain("<br>");
    await expect(nested.locator("p")).toHaveCount(0);
  });

  test("Enter in an outer cell leaves the nested table's text alone", async ({ page }) => {
    await open(page, "nested-tables");

    await cell(page, "#outer-table", 1).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("second line");

    await expect(cell(page, "#outer-table", 1).locator("p")).toHaveCount(1);
    await expect(cell(page, "#nested-table", 0)).toHaveText("N11");
    await expect(cell(page, "#nested-table", 3)).toHaveText("N22");
  });
});
