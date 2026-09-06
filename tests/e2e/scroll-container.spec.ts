import { test, expect, Page } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// The pills and the other overlays live on <body>, outside the table, so
// nothing in the layout keeps them on their cells. A scroll of the page or of
// an ancestor with overflow moves the cells and must move the overlays with
// them. A `scroll` event does not bubble, so only a real browser can prove the
// capture-phase listener sees an inner container's scroll.

const kCell = "#main-table > .bloom-cell";

async function open(page: Page) {
  await page.goto("/demo/ui-harness.html?fixture=scroll-container", {
    waitUntil: "load",
  });
  await page.waitForSelector(`${kCell}`);
  await waitForTestHooks(page);
}

type Box = { x: number; y: number };

const boxOf = (page: Page, selector: string): Promise<Box> =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top };
    });

// Where every overlay sits relative to the cell the selection is on. The
// numbers themselves are the library's business; what a scroll must not change
// is the difference.
const offsetsFromTheCell = async (page: Page) => {
  const cell = await boxOf(page, `${kCell}:nth-child(3)`);
  const overlays = await page.locator("[data-table-overlay]").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.getAttribute("data-table-overlay")!,
        x: r.left,
        y: r.top,
      };
    }),
  );
  return overlays.map((o) => ({
    tag: o.tag,
    dx: Math.round(o.x - cell.x),
    dy: Math.round(o.y - cell.y),
  }));
};

// The selection has to be on a cell before any pill exists.
async function selectTheMiddleLeftCell(page: Page) {
  await page.locator(`${kCell}:nth-child(3)`).click();
  await expect(page.locator('[data-btable-menu-pill="row"]')).toBeVisible();
  await expect(page.locator('[data-btable-menu-pill="column"]')).toBeVisible();
}

const scrollTheContainer = (page: Page, by: number) =>
  page.locator("#scroller").evaluate((el, amount) => {
    el.scrollTop += amount;
  }, by);

test.describe("a table inside a scrolling container", () => {
  test("the container scrolls the table under a fixed viewport", async ({ page }) => {
    await open(page);
    const before = await boxOf(page, `${kCell}:nth-child(1)`);

    await scrollTheContainer(page, 60);

    const after = await boxOf(page, `${kCell}:nth-child(1)`);
    expect(Math.round(before.y - after.y)).toBe(60);
  });

  test("the pills keep their place on the cell when the container scrolls", async ({ page }) => {
    await open(page);
    await selectTheMiddleLeftCell(page);
    const before = await offsetsFromTheCell(page);

    await scrollTheContainer(page, 60);

    await expect.poll(() => offsetsFromTheCell(page)).toEqual(before);
  });

  test("the pills keep their place on the cell when the window scrolls", async ({ page }) => {
    await open(page);
    await selectTheMiddleLeftCell(page);
    const before = await offsetsFromTheCell(page);

    await page.evaluate(() => window.scrollBy(0, 200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200);

    await expect.poll(() => offsetsFromTheCell(page)).toEqual(before);
  });

  test("the pills keep their place after both scrolls together", async ({ page }) => {
    await open(page);
    await selectTheMiddleLeftCell(page);
    const before = await offsetsFromTheCell(page);

    await page.evaluate(() => window.scrollBy(0, 150));
    await scrollTheContainer(page, 40);

    await expect.poll(() => offsetsFromTheCell(page)).toEqual(before);
  });

  test("the pills still work after a scroll: the row menu opens on the scrolled cell", async ({
    page,
  }) => {
    await open(page);
    await selectTheMiddleLeftCell(page);
    await scrollTheContainer(page, 60);

    await page.locator('[data-btable-menu-pill="row"]').click();

    await expect(page.locator("[data-btable-menu]")).toBeVisible();
    await page.locator('[data-btable-menu] [aria-label="Add Row Below"]').click();
    await expect(page.locator(kCell)).toHaveCount(8);
  });

  test("the column edge is still where the pointer finds it after a scroll", async ({ page }) => {
    await open(page);
    await selectTheMiddleLeftCell(page);
    await scrollTheContainer(page, 60);

    // The boundary between the two columns, read after the scroll moved it. The
    // drag handle is a couple of pixels wide, so the press lands just inside it.
    const edge = await page.locator(`${kCell}:nth-child(1)`).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.right - 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(edge.x, edge.y);
    await page.mouse.down();
    await page.mouse.move(edge.x + 40, edge.y, { steps: 8 });
    await page.mouse.up();

    const widths = await page.locator("#main-table").getAttribute("data-column-widths");
    const first = Number(widths!.split(",")[0].replace("px", ""));
    expect(first).toBeGreaterThan(180);
  });
});
