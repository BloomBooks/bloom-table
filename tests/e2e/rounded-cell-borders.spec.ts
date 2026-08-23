import { test, expect } from "@playwright/test";

// A cell with a corner radius must paint all four of its own borders, so its
// outline is a complete rounded rectangle instead of two side borders that
// curve away from a line the square neighbor draws. The square neighbor keeps
// its own straight border, so both cells stay closed.
test.describe("Rounded cells own their borders", () => {
  test("Corners 8 on the bottom row makes two closed rounded rectangles", async ({ page }) => {
    // No fixture: the harness mounts its blank 2x2 table.
    await page.goto("/demo/ui-harness.html");
    await page.waitForSelector(".bloom-table");
    const table = page.locator("#attempt-container .bloom-table");
    await expect(table).toBeVisible();

    const editors = table.locator(".bloom-cell > div[contenteditable]");
    await expect(editors).toHaveCount(4);

    // Give the cells some text so the hug tracks are large enough to see the
    // corner curves in the screenshot.
    const labels = ["one", "two", "three", "four"];
    for (let i = 0; i < 4; i++) {
      await editors.nth(i).click();
      await page.keyboard.type(labels[i]);
    }

    const cellSection = page
      .locator(".table-menu div")
      .filter({ has: page.locator(':scope > h2:text-is("Cell")') })
      .first();

    // Apply Corners 8 to each bottom cell through the real menu.
    for (const i of [2, 3]) {
      await editors.nth(i).click();
      await cellSection.locator('button[aria-label="Corners"]').click();
      await page.locator('[role="menuitemradio"][title="8"]').click();
      await expect(table.locator(".bloom-cell").nth(i)).toHaveAttribute(
        "data-corners",
        '{"radius":8}',
      );
    }

    const sides = (i: number) =>
      table.locator(".bloom-cell").nth(i).evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          top: cs.borderTopStyle,
          right: cs.borderRightStyle,
          bottom: cs.borderBottomStyle,
          left: cs.borderLeftStyle,
          radius: cs.borderTopLeftRadius,
        };
      });

    // Each rounded cell has a complete outline.
    for (const i of [2, 3]) {
      expect(await sides(i)).toEqual({
        top: "solid",
        right: "solid",
        bottom: "solid",
        left: "solid",
        radius: "8px",
      });
    }
    // The square cells above keep the straight bottom border they had before,
    // so the row above stays closed on all four sides. The rounded cell draws
    // its own curved top alongside it.
    expect(await sides(0)).toEqual({
      top: "solid",
      right: "solid",
      bottom: "solid",
      left: "solid",
      radius: "0px",
    });
    expect(await sides(1)).toEqual({
      top: "solid",
      right: "solid",
      bottom: "solid",
      left: "none",
      radius: "0px",
    });

    // Move the pointer well away from the table: the editing affordances (the
    // add-row/column buttons and the cell highlight) follow the pointer, and a
    // pointer resting on a cell would put them in the snapshot.
    const editorBox = await page.locator("#editor").boundingBox();
    await page.mouse.move(editorBox!.x + editorBox!.width - 5, editorBox!.y + 5);
    await page.waitForTimeout(500);
    await expect(page.locator("#editor")).toHaveScreenshot("rounded-bottom-row.png", {
      maxDiffPixelRatio: 0.03,
    });
  });
});
