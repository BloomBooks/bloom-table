import { test, expect } from "./utils/strict-page";

// The popup menu often opens on top of the very cells its commands affect.
// The grip strip at its top edge lets the user drag the whole popup aside;
// after the drag it stays put and still closes on an outside click.
test.describe("dragging the popup menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/ui-harness.html", { waitUntil: "load" });
    await page.waitForSelector("#attempt-container > .bloom-table .bloom-cell");
    await page
      .locator("#attempt-container > .bloom-table > .bloom-cell")
      .first()
      .locator(":scope > [contenteditable]")
      .first()
      .evaluate((el) => (el as HTMLElement).focus());
    // A real right-click, not dispatchEvent("contextmenu"): Playwright builds
    // that one as a generic Event with no clientX/clientY, and the menu opens
    // at the event coordinates. force skips the hover-overlay hit test.
    await page
      .locator("#attempt-container > .bloom-table > .bloom-cell")
      .first()
      .click({ button: "right", force: true });
    await expect(page.locator("[data-btable-menu]")).toBeVisible();
  });

  test("the grip strip moves the popup and the popup stays open", async ({ page }) => {
    const popup = page.locator("[data-btable-menu]");
    const handle = page.locator("[data-btable-menu-handle]");
    await expect(handle).toBeVisible();

    const before = (await popup.boundingBox())!;
    const grip = (await handle.boundingBox())!;
    const fromX = grip.x + grip.width / 2;
    const fromY = grip.y + grip.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + 120, fromY + 60, { steps: 8 });
    await page.mouse.up();

    await expect(popup).toBeVisible();
    const after = (await popup.boundingBox())!;
    expect(Math.abs(after.x - (before.x + 120))).toBeLessThanOrEqual(2);
    expect(Math.abs(after.y - (before.y + 60))).toBeLessThanOrEqual(2);

    // A click outside the popup and the table still closes it.
    await page.mouse.click(760, 560);
    await expect(popup).toHaveCount(0);
  });

  test("the drag is clamped to the window", async ({ page }) => {
    const popup = page.locator("[data-btable-menu]");
    const handle = page.locator("[data-btable-menu-handle]");
    const grip = (await handle.boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    // Far past the top-left corner.
    await page.mouse.move(-500, -500, { steps: 8 });
    await page.mouse.up();

    const box = (await popup.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(4);
    expect(box.y).toBeGreaterThanOrEqual(4);
    await expect(popup).toBeVisible();
  });

  test("the grip stays reachable while a tall menu scrolls", async ({ page }) => {
    const popup = page.locator("[data-btable-menu]");
    await popup.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const hit = await page.locator("[data-btable-menu-handle]").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { sticky: getComputedStyle(el).position, reachable: !!at && (at === el || el.contains(at)) };
    });
    expect(hit.sticky).toBe("sticky");
    expect(hit.reachable).toBe(true);
  });
});
