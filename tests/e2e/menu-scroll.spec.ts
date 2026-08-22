import { test, expect } from "@playwright/test";

// A window too short for the whole panel: the panel must bound itself against the
// viewport and scroll its own content, rather than running off the bottom.
test.describe("TableMenu in a short window", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 400 });
    await page.goto("/demo/ui-harness.html", { waitUntil: "load" });
    await page.waitForSelector("#attempt-container > .bloom-table .bloom-cell");
    await page
      .locator("#attempt-container > .bloom-table > .bloom-cell")
      .first()
      .locator(":scope > [contenteditable]")
      .first()
      .evaluate((el) => (el as HTMLElement).focus());
  });

  test("the panel stays inside the window and scrolls its own content", async ({ page }) => {
    const box = await page.locator(".table-menu").evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        bottom: el.getBoundingClientRect().bottom,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowY: cs.overflowY,
        winHeight: window.innerHeight,
      };
    });
    expect(box.bottom).toBeLessThanOrEqual(box.winHeight);
    expect(box.overflowY).toBe("auto");
    // There is more panel than window, so it has something to scroll.
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    // Horizontal behavior is unchanged: no sideways scrollbar.
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);

    // The panel scrolls; the page does not move with it.
    const menu = page.locator(".table-menu");
    await menu.evaluate((el) => el.scrollTo(0, 1000));
    expect(await menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("the right-click cell menu stays inside a short window and scrolls", async ({ page }) => {
    // Shorter still, so this menu is guaranteed to be taller than the window.
    await page.setViewportSize({ width: 800, height: 250 });
    // A real right-click, not dispatchEvent("contextmenu"): Playwright builds
    // that one as a generic Event with no clientX/clientY, and the menu opens
    // at the event coordinates. force skips the hover-overlay hit test.
    await page
      .locator("#attempt-container > .bloom-table > .bloom-cell")
      .first()
      .click({ button: "right", force: true });

    const popup = page.locator("[data-btable-menu]");
    await expect(popup).toBeVisible();
    const box = await popup.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: r.top,
        bottom: r.bottom,
        overflowY: cs.overflowY,
        maxHeight: cs.maxHeight,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        winHeight: window.innerHeight,
      };
    });
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom, JSON.stringify(box)).toBeLessThanOrEqual(box.winHeight);
    expect(box.overflowY).toBe("auto");
    // There is more menu than window, so it has something to scroll.
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    // No sideways scrollbar.
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);

    // The last item is reachable by scrolling inside the menu.
    await popup.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await popup.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test("a dropdown near the panel's bottom edge opens fully in view", async ({ page }) => {
    const section = page
      .locator(".table-menu div")
      .filter({ has: page.locator(`:scope > h2:text-is("Table")`) })
      .first();
    const button = section.locator('button[aria-label="Corners"]').first();
    await button.scrollIntoViewIfNeeded();
    await button.click();

    const option = page.locator('[role="menuitemradio"][title="8"]').first();
    const hit = await option.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        top: r.top,
        bottom: r.bottom,
        winHeight: window.innerHeight,
        // The popup is position:fixed inside the panel, so the panel's overflow
        // must not clip it: the point at its middle has to hit the popup itself.
        reachable: !!at && (at === el || el.contains(at)),
      };
    });
    expect(hit.top).toBeGreaterThanOrEqual(0);
    expect(hit.bottom).toBeLessThanOrEqual(hit.winHeight);
    expect(hit.reachable).toBe(true);
    await option.click();
  });
});
