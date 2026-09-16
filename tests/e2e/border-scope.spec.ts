import { test, expect, Page } from "@playwright/test";
import { waitForTestHooks } from "./utils/test-hooks";

// The border scope chooser: four folder tabs above the border choosers saying
// which edges a choice writes. All / Outer / Inner apply at once; Border Brush
// loads a brush and waits for the user to click an edge in the table.

const kCell = (n: number) => `#main-table > .bloom-cell:nth-child(${n})`;

const menu = (page: Page) => page.locator("[data-btable-menu]");
const tab = (page: Page, id: string) =>
  menu(page).locator(`[role="tab"][data-scope="${id}"]`);
const styleToggle = (page: Page, style: string) =>
  menu(page).locator(`[role="tabpanel"] [data-style="${style}"]`);
const weightToggle = (page: Page, weight: number) =>
  menu(page).locator(`[role="tabpanel"] [data-weight="${weight}"]`);
const preview = (page: Page) =>
  page.locator('[data-table-overlay="border-brush-preview"]');

// data-edges-h is (rows + 1) x columns, so for the 2x2 fixture entry 0 is the
// table's top, entry 2 its bottom, and entry 1 the boundary between the rows.
async function edges(page: Page, attr: string): Promise<any[][]> {
  const raw = await page
    .locator("#main-table")
    .evaluate((el, a) => el.getAttribute(a), attr);
  return JSON.parse(raw || "[]");
}

const styleOf = (entry: any): string | undefined =>
  entry && typeof entry === "object" ? (entry.style ?? entry.north?.style ?? entry.south?.style) : undefined;
const weightOf = (entry: any): number | undefined =>
  entry && typeof entry === "object"
    ? (entry.weight ?? entry.west?.weight ?? entry.east?.weight)
    : undefined;

// Open the table pill menu for the first cell, then drag the popup clear of the
// table so a later click lands on a cell edge and not on the menu.
async function openTableMenu(page: Page, moveAside = false) {
  await page.goto("/demo/ui-harness.html?fixture=basic-table");
  await waitForTestHooks(page);
  await page.waitForSelector("#main-table");
  // The pills are placed on a requestAnimationFrame; give the first layout a
  // moment so a click is not racing the placement.
  await page.waitForTimeout(200);
  await page.locator(`${kCell(1)} [contenteditable]`).click();
  await page.locator('[data-btable-menu-pill="table"]').click();
  await expect(menu(page)).toBeVisible();
  await expect(tab(page, "all")).toHaveAttribute("aria-selected", "true");
  if (!moveAside) return;
  const grip = (await page.locator("[data-btable-menu-handle]").boundingBox())!;
  const table = (await page.locator("#main-table").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(table.x + table.width + 260, grip.y + 200, { steps: 8 });
  await page.mouse.up();
}

test.describe("the border scope chooser", () => {
  test("Outer writes the table's perimeter and Inner its interior", async ({
    page,
  }) => {
    await openTableMenu(page);
    await expect(menu(page)).toHaveScreenshot("menu-mode-all.png", {
      maxDiffPixelRatio: 0.03,
    });

    await tab(page, "outer").click();
    await styleToggle(page, "dashed").click();

    const h = await edges(page, "data-edges-h");
    expect(styleOf(h[0][0])).toBe("dashed");
    expect(styleOf(h[h.length - 1][0])).toBe("dashed");
    // The boundary between the two rows is interior, and Outer left it alone.
    expect(styleOf(h[1][0])).not.toBe("dashed");

    await tab(page, "inner").click();
    await weightToggle(page, 2).click();

    const v = await edges(page, "data-edges-v");
    // data-edges-v is rows x (columns + 1): entry 1 of each row is the interior
    // boundary, entries 0 and the last are the perimeter.
    expect(weightOf(v[0][1])).toBe(2);
    expect(weightOf(v[0][0])).not.toBe(2);
  });

  test("Border Brush paints one edge per click and leaves on Escape", async ({
    page,
  }) => {
    await openTableMenu(page, true);

    await tab(page, "brush").click();
    await styleToggle(page, "dotted").click();
    await expect(menu(page)).toHaveScreenshot("menu-mode-border-brush.png", {
      maxDiffPixelRatio: 0.03,
    });

    // Nothing is applied by loading the brush.
    const before = await edges(page, "data-edges-h");
    expect(JSON.stringify(before)).not.toContain("dotted");

    // Hover the top band of the last cell (row 1, column 1).
    const box = (await page.locator(kCell(4)).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + 3;
    await page.mouse.move(x, y);

    // The wash strip and the line drawn in the loaded brush.
    await expect(preview(page)).toHaveCount(2);
    const lineStyle = await preview(page)
      .nth(1)
      .evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(lineStyle).toBe("dotted");
    // The menu stays open while the user paints.
    await expect(menu(page)).toBeVisible();

    await page.mouse.click(x, y);

    const after = await edges(page, "data-edges-h");
    // The boundary between the rows, under column 1.
    expect(styleOf(after[1][1])).toBe("dotted");
    const label = await page.evaluate(() =>
      window.bloomTableTestHooks!.tableHistoryManager.getLastOperationLabel(),
    );
    expect(label).toBe("Change Border");

    await page.keyboard.press("Escape");
    await expect(preview(page)).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        document.body.classList.contains("bloom-border-brush"),
      ),
    ).toBe(false);
  });
});
