import { test, expect, Page } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// A host such as Bloom mounts the panel with its own table api and its own
// color picker. The harness does the same under ?stubs=1: the api records the
// name of every member the panel calls, and the picker renders a button of its
// own that answers with #abcdef. So a spec can prove the panel goes through
// what the host handed it, rather than reaching for the library's defaults.

const kCell = "#main-table > .bloom-cell";

async function open(page: Page, query: string) {
  await page.goto(`/demo/ui-harness.html?fixture=basic-table${query}`, {
    waitUntil: "load",
  });
  await page.waitForSelector(kCell);
  await waitForTestHooks(page);
}

const apiCalls = (page: Page) => page.evaluate(() => window.bloomTableTestHooks!.stubApiCalls);

const selectFirstCell = async (page: Page) => {
  await page.locator(kCell).first().click();
  await expect(page.locator('h2:text-is("Cell")')).toBeVisible();
};

// The panel's own buttons, which are not the pill menu's.
const panelButton = (page: Page, label: string) =>
  page.locator(`#controls-panel [aria-label="${label}"]`).first();

test.describe("the panel driven through a host's own table api", () => {
  test("a command the user runs from the panel works on the host's api", async ({ page }) => {
    await open(page, "&stubs=1");
    await selectFirstCell(page);
    const before = await apiCalls(page);

    await panelButton(page, "Insert Row Below").click();

    await expect(page.locator(kCell)).toHaveCount(6);
    const after = await apiCalls(page);
    expect(after.length).toBeGreaterThan(before.length);
  });

  test("the host's api sees the panel's reads as well as its commands", async ({ page }) => {
    await open(page, "&stubs=1");

    await selectFirstCell(page);

    // Drawing the Cell section asks the api what the cell currently looks like.
    await expect.poll(() => apiCalls(page).then((c) => c.length)).toBeGreaterThan(0);
  });

  test("without the stubs, the panel touches the host api not at all", async ({ page }) => {
    await open(page, "");
    await selectFirstCell(page);

    await panelButton(page, "Insert Row Below").click();
    await expect(page.locator(kCell)).toHaveCount(6);

    expect(await apiCalls(page)).toEqual([]);
  });
});

test.describe("the panel driven through a host's own color picker", () => {
  test("the host's picker replaces the built-in one wherever a color is chosen", async ({
    page,
  }) => {
    await open(page, "&stubs=1");
    await selectFirstCell(page);

    const labels = await page
      .locator("[data-stub-color-picker]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-stub-color-picker")!));

    expect(labels).toContain("Cell fill");
    expect(labels).toContain("Cell border color");
  });

  test("choosing a color in the host's picker fills the cell", async ({ page }) => {
    await open(page, "&stubs=1");
    await selectFirstCell(page);

    await page.locator('[data-stub-color-picker="Cell fill"]').click();

    await expect.poll(() => page.locator(kCell).first().getAttribute("data-bg")).toBe("#abcdef");
    const calls = await apiCalls(page);
    expect(calls).toContain("setCellBackground");
    expect(calls).toContain("render");
  });

  test("the fill the host's picker chose reaches the rendered cell", async ({ page }) => {
    await open(page, "&stubs=1");
    await selectFirstCell(page);

    await page.locator('[data-stub-color-picker="Cell fill"]').click();
    await expect.poll(() => page.locator(kCell).first().getAttribute("data-bg")).toBe("#abcdef");

    const background = await page
      .locator(kCell)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).toBe("rgb(171, 205, 239)");
  });

  test("choosing a border color in the host's picker colors the cell's borders", async ({
    page,
  }) => {
    await open(page, "&stubs=1");
    await selectFirstCell(page);

    await page.locator('[data-stub-color-picker="Cell border color"]').click();

    // A border color is written into the table's edge arrays, not onto the cell.
    await expect
      .poll(() =>
        page
          .locator("#main-table")
          .evaluate((el) =>
            `${el.getAttribute("data-edges-h")}${el.getAttribute("data-edges-v")}`.toLowerCase(),
          ),
      )
      .toContain("abcdef");
  });

  test("the built-in picker is the one on show when the host supplies none", async ({ page }) => {
    await open(page, "");
    await selectFirstCell(page);

    await expect(page.locator("[data-stub-color-picker]")).toHaveCount(0);
    await expect(page.locator('#controls-panel input[type="color"]').first()).toBeAttached();
  });
});
