import { test, expect, Page, Locator } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// The Cell menu opens on a real right-click, at the pointer, over whatever the
// cell holds. Only a browser delivers a context menu, so the whole flow lives
// here: the content type all the way round and back, merge and split, one
// Format row, and the two ways the menu closes.

const popup = (page: Page) => page.locator("[data-btable-menu]");

async function open(page: Page, fixture: string) {
  await page.goto(`/demo/ui-harness.html?fixture=${fixture}`, { waitUntil: "load" });
  await page.waitForSelector(".bloom-table .bloom-cell");
  await waitForTestHooks(page);
}

// A real right-click, not dispatchEvent("contextmenu"): Playwright builds that
// one as a generic Event with no clientX/clientY, and the menu opens at the
// event coordinates. force skips the hover-overlay hit test.
async function openCellMenu(page: Page, cell: Locator) {
  await cell.click({ button: "right", force: true });
  await expect(popup(page)).toBeVisible();
}

const contentType = (cell: Locator) => cell.getAttribute("data-content-type");

test.describe("the Cell menu on a top-level cell", () => {
  test("walks the content type through image, table and video, and back to text", async ({
    page,
  }) => {
    await open(page, "basic-table");
    const cell = page.locator("#main-table > .bloom-cell").first();
    await openCellMenu(page, cell);

    // Choosing a type leaves the menu open, so the user can try another.
    for (const type of ["image", "table", "video", "text"]) {
      await popup(page).locator(`[data-ct-id="${type}"]`).click();
      await expect.poll(() => contentType(cell)).toBe(type);
    }

    // Back at text, the cell holds an editable again and no nested table.
    await expect(cell.locator(":scope > [contenteditable]")).toHaveCount(1);
    await expect(cell.locator(":scope > .bloom-table")).toHaveCount(0);
  });

  test("builds a nested table inside the cell when the type becomes table", async ({ page }) => {
    await open(page, "basic-table");
    const cell = page.locator("#main-table > .bloom-cell").first();
    await openCellMenu(page, cell);

    await popup(page).locator('[data-ct-id="table"]').click();

    const nested = cell.locator(":scope > .bloom-table");
    await expect(nested).toHaveCount(1);
    expect(await nested.locator(":scope > .bloom-cell").count()).toBeGreaterThan(1);
  });

  test("merges a cell with the one to its right, and splits it again", async ({ page }) => {
    await open(page, "basic-table");
    const cell = page.locator("#main-table > .bloom-cell").first();

    await openCellMenu(page, cell);
    await popup(page).locator('[aria-label="Merge with cell to the right"]').click();
    await expect.poll(() => cell.getAttribute("data-span-x")).toBe("2");

    await openCellMenu(page, cell);
    await popup(page).locator('[aria-label="Split"]').click();
    await expect.poll(() => cell.getAttribute("data-span-x") ?? "1").toBe("1");
  });

  test("offers Split only to a cell that has been merged", async ({ page }) => {
    await open(page, "basic-table");
    const cell = page.locator("#main-table > .bloom-cell").first();

    await openCellMenu(page, cell);
    await expect(popup(page).locator('[aria-label="Split"]')).toBeDisabled();

    await popup(page).locator('[aria-label="Merge with cell to the right"]').click();
    await openCellMenu(page, cell);
    await expect(popup(page).locator('[aria-label="Split"]')).toBeEnabled();
  });

  test("writes the padding a Format row is dragged to", async ({ page }) => {
    await open(page, "basic-table");
    const cell = page.locator("#main-table > .bloom-cell").first();
    await openCellMenu(page, cell);

    const slider = popup(page).locator('[aria-label="Padding between border and text"]');
    await slider.fill("12");

    await expect.poll(() => cell.getAttribute("data-pad")).toBe("12px");
  });

  test("closes on Escape, leaving the cell as it was", async ({ page }) => {
    await open(page, "basic-table");
    const cell = page.locator("#main-table > .bloom-cell").first();
    await openCellMenu(page, cell);

    await page.keyboard.press("Escape");

    await expect(popup(page)).toHaveCount(0);
    expect(await contentType(cell)).toBe("text");
  });

  test("closes on a press outside it", async ({ page }) => {
    await open(page, "basic-table");
    await openCellMenu(page, page.locator("#main-table > .bloom-cell").first());

    await page.mouse.click(5, 5);

    await expect(popup(page)).toHaveCount(0);
  });
});

test.describe("the Cell menu on a nested cell", () => {
  test("changes the nested cell and leaves its host cell's type alone", async ({ page }) => {
    await open(page, "nested-tables");
    const hostCell = page.locator("#outer-table > .bloom-cell").first();
    const nestedCell = page.locator("#nested-table > .bloom-cell").first();

    await openCellMenu(page, nestedCell);
    await popup(page).locator('[data-ct-id="image"]').click();

    await expect.poll(() => contentType(nestedCell)).toBe("image");
    expect(await contentType(hostCell)).toBe("table");
  });

  test("merges a nested cell without touching the outer table's shape", async ({ page }) => {
    await open(page, "nested-tables");
    const outer = page.locator("#outer-table");
    const nestedCell = page.locator("#nested-table > .bloom-cell").first();
    const outerColumns = await outer.getAttribute("data-column-widths");

    await openCellMenu(page, nestedCell);
    await popup(page).locator('[aria-label="Merge with cell to the right"]').click();

    await expect.poll(() => nestedCell.getAttribute("data-span-x")).toBe("2");
    expect(await outer.getAttribute("data-column-widths")).toBe(outerColumns);
  });
});
