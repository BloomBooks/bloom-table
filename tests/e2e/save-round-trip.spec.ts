import { test, expect, Page } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";
import { extractTableModelInPage } from "../samples/ui/extract-model";

// What a host saves is the editor's own container, stripped of edit-time
// chrome. The saved markup has to carry the whole model: mounting it in a fresh
// session must give back the table the user built, and it must carry none of the
// session's own furniture, whose anchor names and overlays belong to the
// session that minted them.

const kTable = "#attempt-container > .bloom-table";

async function open(page: Page) {
  await page.goto("/demo/ui-harness.html", { waitUntil: "load" });
  await page.waitForSelector(`${kTable} .bloom-cell`);
  await waitForTestHooks(page);
}

const editable = (page: Page, index: number) =>
  page.locator(`${kTable} > .bloom-cell`).nth(index).locator(":scope > [contenteditable]");

// Build something with text, an extra row, and a border the user chose, so the
// comparison has more than the default table to talk about.
async function buildATable(page: Page) {
  await editable(page, 0).click();
  await page.keyboard.type("Hello");
  await editable(page, 1).click();
  await page.keyboard.type("World");

  await editable(page, 0).click();
  await page.locator('[data-btable-menu-pill="row"]').click();
  await page.locator('[data-btable-menu] [aria-label="Add Row Below"]').click();
  await expect.poll(() => page.locator(`${kTable} > .bloom-cell`).count()).toBe(6);

  await editable(page, 0).click();
  await page.locator('[data-btable-menu-pill="table"]').click();
  await page.locator('[data-btable-menu] [aria-label="Dashed"]').click();
  await expect
    .poll(() => page.locator(kTable).getAttribute("data-border-default"))
    .toContain("dashed");
  // A border choice leaves the menu open, so the user can try another.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-btable-menu]")).toHaveCount(0);
}

// The container's markup as a save would write it.
const saveTheDocument = (page: Page) =>
  page.evaluate(() => {
    window.bloomTableTestHooks!.removeTableEditingArtifacts(document);
    return document.querySelector("#attempt-container")!.innerHTML;
  });

test.describe("saving a table and reading it back", () => {
  test("mounting the saved markup in a fresh session gives back the same model", async ({
    page,
  }) => {
    await open(page);
    await buildATable(page);

    const built = await page.evaluate(extractTableModelInPage, kTable);
    const saved = await saveTheDocument(page);

    // A fresh page, so nothing of the first session can survive into the second.
    await open(page);
    await page.evaluate((html) => window.bloomTableTestHooks!.setContent(html), saved);
    await expect(page.locator(`${kTable} > .bloom-cell`)).toHaveCount(6);

    const reopened = await page.evaluate(extractTableModelInPage, kTable);
    expect(reopened).toEqual(built);
  });

  test("the saved markup keeps the text and the shape the user built", async ({ page }) => {
    await open(page);
    await buildATable(page);

    const saved = await saveTheDocument(page);

    expect(saved).toContain("Hello");
    expect(saved).toContain("World");
    expect(saved).toContain('data-row-heights="hug,hug,hug"');
  });

  test("the saved markup carries none of the session's edit-time furniture", async ({ page }) => {
    await open(page);
    await buildATable(page);
    // Leave a selection and an open menu standing, which is the state a save is
    // most likely to catch the editor in.
    await editable(page, 0).click();
    await page.locator('[data-btable-menu-pill="row"]').click();
    await expect(page.locator("[data-btable-menu]")).toBeVisible();

    const saved = await saveTheDocument(page);

    expect(saved).not.toContain("cell--selected");
    expect(saved).not.toContain("table--selected");
    expect(saved).not.toContain("bloom-current-table");
    expect(saved).not.toContain("data-btable-anchor-name");
    expect(saved).not.toContain("anchor-name");
    expect(saved).not.toContain("data-table-overlay");
    expect(saved).not.toContain("<style");
  });

  test("the whole page keeps no overlay of its own once the save has run", async ({ page }) => {
    await open(page);
    await buildATable(page);
    await editable(page, 0).click();
    await page.locator('[data-btable-menu-pill="row"]').click();
    await expect(page.locator("[data-btable-menu]")).toBeVisible();

    await saveTheDocument(page);

    // The pills and the popup live on <body>, outside the container, so the
    // container's own markup says nothing about them.
    await expect(page.locator("[data-table-overlay]")).toHaveCount(0);
    await expect(page.locator("[data-btable-menu]")).toHaveCount(0);
  });

  test("a saved nested table comes back nested, with the outer table's model intact", async ({
    page,
  }) => {
    await page.goto("/demo/ui-harness.html?fixture=nested-tables", { waitUntil: "load" });
    await page.waitForSelector("#nested-table .bloom-cell");
    await waitForTestHooks(page);

    const built = await page.evaluate(extractTableModelInPage, kTable);
    const saved = await saveTheDocument(page);

    await open(page);
    await page.evaluate((html) => window.bloomTableTestHooks!.setContent(html), saved);
    await page.waitForSelector("#nested-table .bloom-cell");

    expect(await page.evaluate(extractTableModelInPage, kTable)).toEqual(built);
  });
});
