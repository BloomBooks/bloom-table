import { test, expect, Page } from "./utils/strict-page";

// Hovering a "..." pill outlines what its menu will act on: the selected cell's
// column (full table height), its row (full table width), or the whole current
// table. These tests check the outline's geometry against the real cell rects,
// and that it goes away again.

const kOuterSecondCell = "#outer-table > .bloom-cell:nth-child(2)";
const kNestedFirstCell = "#nested-table > .bloom-cell:nth-child(1)";

const preview = (page: Page) => page.locator('[data-table-overlay="pill-target-preview"]');
const pill = (page: Page, kind: "row" | "column" | "table") =>
  page.locator(`[data-btable-menu-pill="${kind}"]`);

type Rect = { left: number; right: number; top: number; bottom: number };

async function open(page: Page) {
  await page.goto("/demo/ui-harness.html?fixture=nested-tables");
  await page.waitForSelector("#nested-table");
  // The pills are placed on a requestAnimationFrame; give the first layout a
  // moment so a hover is not racing the placement.
  await page.waitForTimeout(200);
}

async function clickCenter(page: Page, selector: string, clickCount = 1) {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount });
}

const rectOf = (page: Page, selector: string): Promise<Rect> =>
  page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });

// The union of a table's own cell rects — what a column outline must span
// vertically, and a row outline horizontally.
const cellUnion = (page: Page, tableId: string): Promise<Rect> =>
  page.locator(`#${tableId}`).evaluate((table) => {
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const child of Array.from(table.children)) {
      if (!child.classList.contains("bloom-cell")) continue;
      const r = child.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return { left, top, right, bottom };
  });

const kTolerance = 2; // px

function expectRectClose(actual: Rect, expected: Rect) {
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(kTolerance);
  expect(Math.abs(actual.right - expected.right)).toBeLessThanOrEqual(kTolerance);
  expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(kTolerance);
  expect(Math.abs(actual.bottom - expected.bottom)).toBeLessThanOrEqual(kTolerance);
}

// Put the pointer on the table (the pills only answer while the chrome is up),
// then move onto the pill so its mouseenter fires.
async function hoverPill(page: Page, kind: "row" | "column" | "table", overSelector: string) {
  const box = (await page.locator(overSelector).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pill(page, kind).hover();
  await page.waitForTimeout(50);
}

test.describe("pill hover previews: the outer table", () => {
  test("the column pill outlines the selected cell's column", async ({ page }) => {
    await open(page);
    await clickCenter(page, kOuterSecondCell);

    await hoverPill(page, "column", kOuterSecondCell);

    await expect(preview(page)).toBeVisible();
    const cell = await rectOf(page, kOuterSecondCell);
    const table = await cellUnion(page, "outer-table");
    const actual = await rectOf(page, '[data-table-overlay="pill-target-preview"]');
    // Left and right come from the column; top and bottom span the table.
    expectRectClose(actual, {
      left: cell.left,
      right: cell.right,
      top: table.top,
      bottom: table.bottom,
    });
    // Not the whole table: the outer table is three columns wide.
    expect(actual.right - actual.left).toBeLessThan((table.right - table.left) / 2);
  });

  test("the row pill outlines the selected cell's row, full table width", async ({ page }) => {
    await open(page);
    await clickCenter(page, kOuterSecondCell);

    await hoverPill(page, "row", kOuterSecondCell);

    await expect(preview(page)).toBeVisible();
    const cell = await rectOf(page, kOuterSecondCell);
    const table = await cellUnion(page, "outer-table");
    expectRectClose(await rectOf(page, '[data-table-overlay="pill-target-preview"]'), {
      left: table.left,
      right: table.right,
      top: cell.top,
      bottom: cell.bottom,
    });
  });

  test("the table pill outlines the whole table", async ({ page }) => {
    await open(page);
    await clickCenter(page, kOuterSecondCell);

    await hoverPill(page, "table", kOuterSecondCell);

    await expect(preview(page)).toBeVisible();
    const table = await cellUnion(page, "outer-table");
    expectRectClose(await rectOf(page, '[data-table-overlay="pill-target-preview"]'), table);
  });

  test("the preview goes away when the pointer leaves the pill", async ({ page }) => {
    await open(page);
    await clickCenter(page, kOuterSecondCell);
    await hoverPill(page, "column", kOuterSecondCell);
    await expect(preview(page)).toBeVisible();

    await page.mouse.move(2, 2);
    await page.waitForTimeout(100);

    await expect(preview(page)).toBeHidden();
  });

  test("the preview goes away when the pill is clicked open", async ({ page }) => {
    await open(page);
    await clickCenter(page, kOuterSecondCell);
    await hoverPill(page, "column", kOuterSecondCell);
    await expect(preview(page)).toBeVisible();

    await pill(page, "column").click();
    await page.waitForTimeout(100);

    await expect(page.locator("[data-btable-menu]")).toBeVisible();
    await expect(preview(page)).toBeHidden();
  });

  test("the preview does not swallow clicks on the table", async ({ page }) => {
    await open(page);
    await clickCenter(page, kOuterSecondCell);
    await hoverPill(page, "table", kOuterSecondCell);
    await expect(preview(page)).toBeVisible();

    // pointer-events: none — the click must reach the cell underneath.
    await clickCenter(page, "#outer-table > .bloom-cell:nth-child(3)");
    expect(
      await page.evaluate(
        () => document.querySelector(".bloom-cell.cell--selected")?.textContent?.trim() ?? null,
      ),
    ).toBe("Outer 3");
  });
});

test.describe("pill hover previews: a nested table", () => {
  // The nested table is 2x2 at 80x60 per cell inside a 200x150 outer cell, so an
  // outline drawn on the outer table instead would be unmistakably too big.
  async function enterNestedTable(page: Page) {
    await open(page);
    await clickCenter(page, kNestedFirstCell, 2);
    expect(
      await page.evaluate(() => {
        const cell = document.querySelector(".bloom-cell.cell--selected");
        return (cell?.parentElement?.closest(".bloom-table") as HTMLElement | null)?.id ?? null;
      }),
    ).toBe("nested-table");
  }

  test("the column pill outlines the NESTED table's column", async ({ page }) => {
    await enterNestedTable(page);

    await hoverPill(page, "column", kNestedFirstCell);

    await expect(preview(page)).toBeVisible();
    const cell = await rectOf(page, kNestedFirstCell);
    const nested = await cellUnion(page, "nested-table");
    const actual = await rectOf(page, '[data-table-overlay="pill-target-preview"]');
    expectRectClose(actual, {
      left: cell.left,
      right: cell.right,
      top: nested.top,
      bottom: nested.bottom,
    });
    // One column of two: narrower than the nested table, and it spans both rows.
    expect(actual.right).toBeLessThan(nested.right - 10);
    expect(actual.bottom).toBeGreaterThan(cell.bottom + 10);
  });

  test("the row pill outlines the NESTED table's row", async ({ page }) => {
    await enterNestedTable(page);

    await hoverPill(page, "row", kNestedFirstCell);

    await expect(preview(page)).toBeVisible();
    const cell = await rectOf(page, kNestedFirstCell);
    const nested = await cellUnion(page, "nested-table");
    const actual = await rectOf(page, '[data-table-overlay="pill-target-preview"]');
    expectRectClose(actual, {
      left: nested.left,
      right: nested.right,
      top: cell.top,
      bottom: cell.bottom,
    });
    expect(actual.bottom).toBeLessThan(nested.bottom - 10);
  });

  test("the table pill outlines the NESTED table, not the outer one", async ({ page }) => {
    await enterNestedTable(page);

    await hoverPill(page, "table", kNestedFirstCell);

    await expect(preview(page)).toBeVisible();
    const nested = await cellUnion(page, "nested-table");
    const outer = await cellUnion(page, "outer-table");
    const actual = await rectOf(page, '[data-table-overlay="pill-target-preview"]');
    expectRectClose(actual, nested);
    expect(actual.right).toBeLessThan(outer.right - 10);
  });
});
