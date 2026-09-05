import { test, expect, Page } from "@playwright/test";

// Paint format carries a row's height and a column's width, not only the
// per-cell formatting, and it outlines the region the next click would stamp.

const kCell = (n: number) => `#main-table > .bloom-cell:nth-child(${n})`;
const overlay = (page: Page) => page.locator(".bloom-sel-overlay");

async function open(page: Page) {
  await page.goto("/demo/ui-harness.html?fixture=row-heights");
  await page.waitForSelector("#main-table");
  // The pills are placed on a requestAnimationFrame; give the first layout a
  // moment so a click is not racing the placement.
  await page.waitForTimeout(200);
}

async function clickCenter(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function hoverCenter(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

// Open the row or column menu for the selected cell and start Paint format.
async function startPaintFormat(page: Page, kind: "row" | "column") {
  await page.locator(`[data-btable-menu-pill="${kind}"]`).click();
  await page
    .locator('[data-btable-menu] [role="menuitem"]', {
      hasText: "Paint format",
    })
    .click();
  await page.waitForSelector(".bloom-paint-format-badge");
}

const sizes = (page: Page, attr: string) =>
  page.locator("#main-table").evaluate((el, a) => el.getAttribute(a), attr);

test.describe("paint format", () => {
  test("a row's height travels to the row that is painted", async ({
    page,
  }) => {
    await open(page);
    await clickCenter(page, kCell(1)); // a cell of row 0, the 30mm row
    await startPaintFormat(page, "row");

    await clickCenter(page, kCell(3)); // any cell of row 1
    await page.waitForTimeout(200);

    expect(await sizes(page, "data-row-heights")).toBe("30mm,30mm");
    // The column widths are none of a row's business.
    expect(await sizes(page, "data-column-widths")).toBe("30mm,hug");
  });

  test("a column's width travels to the column that is painted", async ({
    page,
  }) => {
    await open(page);
    await clickCenter(page, kCell(1)); // a cell of column 0, the 30mm column
    await startPaintFormat(page, "column");

    await clickCenter(page, kCell(2)); // any cell of column 1
    await page.waitForTimeout(200);

    expect(await sizes(page, "data-column-widths")).toBe("30mm,30mm");
    expect(await sizes(page, "data-row-heights")).toBe("30mm,hug");
  });

  test("hovering outlines the whole row that the next click would paint", async ({
    page,
  }) => {
    await open(page);
    await clickCenter(page, kCell(1));
    await startPaintFormat(page, "row");

    await hoverCenter(page, kCell(3));
    await expect(overlay(page)).toHaveCount(1);

    // The outline covers row 1, so it is as wide as the two cells together and
    // as tall as one of them.
    const box = (await overlay(page).boundingBox())!;
    const left = (await page.locator(kCell(3)).boundingBox())!;
    const right = (await page.locator(kCell(4)).boundingBox())!;
    expect(box.width).toBeGreaterThan(left.width);
    expect(Math.round(box.width)).toBe(
      Math.round(right.x + right.width - left.x),
    );
    expect(Math.round(box.height)).toBe(Math.round(left.height));

    // Leaving the table takes the outline away, and Escape leaves none behind.
    await page.mouse.move(5, 5);
    await expect(overlay(page)).toHaveCount(0);
    await hoverCenter(page, kCell(3));
    await expect(overlay(page)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(overlay(page)).toHaveCount(0);
  });
});
