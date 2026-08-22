import { test, expect, Page } from "@playwright/test";

// The chrome ("+" buttons, row/column/table pills, menus) serves ONE table at a
// time: the table that owns the selected cell. These tests drive the gestures
// that move that ownership between nesting levels, and check that each command
// lands on the level the user is in.

const kHostCell = "#outer-table > .bloom-cell:nth-child(1)";
const kOuterSecondCell = "#outer-table > .bloom-cell:nth-child(2)";

async function open(page: Page) {
  await page.goto("/demo/ui-harness.html?fixture=nested-tables");
  await page.waitForSelector("#nested-table");
  // The pills are placed on a requestAnimationFrame; give the first layout a
  // moment so a click on one is not racing the placement.
  await page.waitForTimeout(200);
}

// Which table owns the selected cell, by id.
function currentTableId(page: Page) {
  return page.evaluate(() => {
    const cell = document.querySelector(".bloom-cell.cell--selected");
    const table = cell?.parentElement?.closest(".bloom-table") as HTMLElement | null;
    return table?.id ?? null;
  });
}

const selectedCellText = (page: Page) =>
  page.evaluate(() => document.querySelector(".bloom-cell.cell--selected")?.textContent?.trim() ?? null);

const widthCount = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => (el.getAttribute("data-column-widths") || "").split(",").length);

const rowCount = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => (el.getAttribute("data-row-heights") || "").split(",").length);

// Click the middle of a cell, away from the 5px edge band drag-to-resize owns.
async function clickCenter(page: Page, selector: string, clickCount = 1) {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount });
}

// The toolbar's Undo button, which runs undo through the app's own history
// manager. Its label carries the operation name ("Undo: Delete Table"), which
// also distinguishes it from the sidebar menu's own plain "Undo" button.
// The on-canvas "+" that appends a column. Its label is its own (the sidebar
// says "Insert Column Right"), and the overlay attribute scopes the lookup.
const columnAddButton = (page: Page) =>
  page.locator('button[data-table-overlay="add-button"][aria-label="Add column at the right edge"]');

const undoButton = (page: Page) => page.locator("#controls-panel button", { hasText: /^Undo: / });

// The on-canvas "+" that appends a row.
const rowAddButton = (page: Page) =>
  page.locator('button[data-table-overlay="add-button"][aria-label="Add row at the bottom edge"]');

const cellCount = (page: Page, id: string) => page.locator(`#${id} > .bloom-cell`).count();

const sizeAttributes = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => ({
    columns: el.getAttribute("data-column-widths"),
    rows: el.getAttribute("data-row-heights"),
  }));

test.describe("nested tables: the current table owns the chrome", () => {
  test("a single click inside a nested table selects the HOST cell", async ({ page }) => {
    await open(page);

    // Aim at the nested table's first cell — its text, so a fall-through would
    // be unmistakable (the caret would land in "N11").
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)");

    expect(await currentTableId(page)).toBe("outer-table");
    await expect(page.locator(kHostCell)).toHaveClass(/cell--selected/);
    // No cell of the nested table is selected, and no caret went into it.
    expect(await page.locator("#nested-table .cell--selected").count()).toBe(0);
    expect(
      await page.evaluate(() => document.activeElement?.closest("#nested-table") !== null),
    ).toBe(false);
  });

  test("a double-click enters the nested table, and its '+' then adds to it", async ({ page }) => {
    await open(page);

    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);
    expect(await currentTableId(page)).toBe("nested-table");
    expect(await selectedCellText(page)).toBe("N11");
    // The entered table is marked so the user can see which level is current.
    await expect(page.locator("#nested-table")).toHaveClass(/bloom-current-table/);
    await expect(page.locator("#outer-table")).not.toHaveClass(/bloom-current-table/);
    // ...and the mark actually paints (the edit-time stylesheet draws an outline).
    expect(
      await page
        .locator("#nested-table")
        .evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)),
    ).toBeGreaterThan(0);

    const nestedColumnsBefore = await widthCount(page, "nested-table");
    const outerColumnsBefore = await widthCount(page, "outer-table");

    await columnAddButton(page).click();
    await page.waitForTimeout(100);

    expect(await widthCount(page, "nested-table")).toBe(nestedColumnsBefore + 1);
    expect(await widthCount(page, "outer-table")).toBe(outerColumnsBefore);
  });

  test("a pill menu opened while inside the nested table acts on the nested table", async ({
    page,
  }) => {
    await open(page);
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);
    expect(await currentTableId(page)).toBe("nested-table");

    const nestedRowsBefore = await rowCount(page, "nested-table");
    const outerRowsBefore = await rowCount(page, "outer-table");

    await page.locator('[data-btable-menu-pill="row"]').click();
    await page.locator('[data-btable-menu] [role="menuitem"]', { hasText: "Add Row Below" }).click();
    await page.waitForTimeout(100);

    expect(await rowCount(page, "nested-table")).toBe(nestedRowsBefore + 1);
    expect(await rowCount(page, "outer-table")).toBe(outerRowsBefore);
  });

  test("clicking a cell of the outer table exits the nested table", async ({ page }) => {
    await open(page);
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);
    expect(await currentTableId(page)).toBe("nested-table");

    await clickCenter(page, kOuterSecondCell);

    expect(await currentTableId(page)).toBe("outer-table");
    expect(await selectedCellText(page)).toBe("Outer 2");
    await expect(page.locator("#nested-table")).not.toHaveClass(/bloom-current-table/);
  });

  test("Escape steps out one level", async ({ page }) => {
    await open(page);
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);
    expect(await currentTableId(page)).toBe("nested-table");

    await page.keyboard.press("Escape");

    expect(await currentTableId(page)).toBe("outer-table");
    await expect(page.locator(kHostCell)).toHaveClass(/cell--selected/);
  });

  test("a double-click on an ordinary text cell still selects a word", async ({ page }) => {
    await open(page);
    // There is no level below this cell, so the double-click must be left to
    // the browser: it selects the word under the pointer.
    await clickCenter(page, kOuterSecondCell, 2);

    expect(await currentTableId(page)).toBe("outer-table");
    expect(await page.evaluate(() => window.getSelection()?.toString())).toMatch(/Outer|2/);
  });

  test("the outer table's '+' and pill menu act on the OUTER table after a visit inside", async ({
    page,
  }) => {
    await open(page);
    // Go into the nested table, then come back out. The chrome that is up now
    // belongs to the outer table; it used to read the document's selected cell
    // and so acted on whichever table held it.
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);
    expect(await currentTableId(page)).toBe("nested-table");
    await clickCenter(page, kOuterSecondCell);
    expect(await currentTableId(page)).toBe("outer-table");

    const outerColumnsBefore = await widthCount(page, "outer-table");
    const nestedColumnsBefore = await widthCount(page, "nested-table");
    await columnAddButton(page).click();
    await page.waitForTimeout(100);
    expect(await widthCount(page, "outer-table")).toBe(outerColumnsBefore + 1);
    expect(await widthCount(page, "nested-table")).toBe(nestedColumnsBefore);

    const outerRowsBefore = await rowCount(page, "outer-table");
    const nestedRowsBefore = await rowCount(page, "nested-table");
    await page.locator('[data-btable-menu-pill="row"]').click();
    await page.locator('[data-btable-menu] [role="menuitem"]', { hasText: "Add Row Below" }).click();
    await page.waitForTimeout(100);
    expect(await rowCount(page, "outer-table")).toBe(outerRowsBefore + 1);
    expect(await rowCount(page, "nested-table")).toBe(nestedRowsBefore);
  });
});

test.describe("nested tables: growing one", () => {
  // Add a column and a row to the nested table through the real on-canvas
  // controls, then check the result in the HTML and on screen.
  async function growTheNestedTable(page: Page) {
    await open(page);
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);
    expect(await currentTableId(page)).toBe("nested-table");

    await columnAddButton(page).click();
    await page.waitForTimeout(100);

    // The new column moves the row "+" button, so put the pointer back on a
    // cell of the nested table before reaching for it.
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(2)");
    await rowAddButton(page).click();
    await page.waitForTimeout(100);
  }

  test("adding a row and a column to a nested table changes only that table", async ({ page }) => {
    await open(page);
    const outerBefore = await sizeAttributes(page, "outer-table");
    const outerCellsBefore = await cellCount(page, "outer-table");

    await growTheNestedTable(page);

    // 2x2 became 3x3, and every track of the nested table is now "fill": a
    // nested table that gains a track shares its host cell out between its
    // tracks instead of overflowing the cell, which cannot grow.
    expect(await sizeAttributes(page, "nested-table")).toEqual({
      columns: "fill,fill,fill",
      rows: "fill,fill,fill",
    });
    expect(await cellCount(page, "nested-table")).toBe(9);

    // The outer table is untouched: same sizes, same cells.
    expect(await sizeAttributes(page, "outer-table")).toEqual(outerBefore);
    expect(await cellCount(page, "outer-table")).toBe(outerCellsBefore);
  });

  // The host cell never grows: bloom-table.css gives a nested table
  // `position: absolute; inset: 0` and the cell hides the overflow. So the
  // added tracks must not add width or height, which is why every track of a
  // grown nested table becomes "fill" (sizesAfterGrowth in structure.ts).
  // Before that rule the 3x3 table measured 240px by 180px inside a 198px by
  // 148px box, and the flex-centred overflow hid the FIRST column.
  test("the grown nested table renders inside its host cell", async ({ page }) => {
    await growTheNestedTable(page);

    // Leave the nested table so its "current table" outline is not in the shot,
    // and take the pointer out of every proximity zone so no chrome is either.
    await page.keyboard.press("Escape");
    await page.mouse.move(2, 2);
    await page.waitForTimeout(200);

    await expect(page.locator("#editor")).toHaveScreenshot("nested-table-grown.png", {
      maxDiffPixelRatio: 0.03,
    });
  });
});

test.describe("nested tables: undo stays on the right table", () => {
  test("undo after resizing a nested column leaves the outer table's widths alone", async ({
    page,
  }) => {
    await open(page);
    // Enter the nested table first: dragging its edge is an edit of that table.
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);

    const outerWidthsBefore = await page.locator("#outer-table").getAttribute("data-column-widths");
    const nestedWidthsBefore = await page.locator("#nested-table").getAttribute("data-column-widths");

    // Drag the right edge of the nested table's first cell.
    const box = (await page.locator("#nested-table > .bloom-cell:nth-child(1)").boundingBox())!;
    const x = box.x + box.width - 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    expect(await page.locator("#nested-table").getAttribute("data-column-widths")).not.toBe(
      nestedWidthsBefore,
    );
    // The outer table was never part of this operation.
    expect(await page.locator("#outer-table").getAttribute("data-column-widths")).toBe(
      outerWidthsBefore,
    );

    await undoButton(page).click();
    await page.waitForTimeout(100);

    // The nested width is back...
    expect(await page.locator("#nested-table").getAttribute("data-column-widths")).toBe(
      nestedWidthsBefore,
    );
    // ...and the outer table's widths are untouched. The undo closure used to
    // write the nested table's value onto the outer table.
    expect(await page.locator("#outer-table").getAttribute("data-column-widths")).toBe(
      outerWidthsBefore,
    );
  });

  test("Delete Table on a nested table is undoable in one step", async ({ page }) => {
    await open(page);
    await clickCenter(page, "#nested-table > .bloom-cell:nth-child(1)", 2);
    expect(await currentTableId(page)).toBe("nested-table");

    await page.locator('[data-btable-menu-pill="table"]').click();
    await page.locator('[data-btable-menu] [role="menuitem"]', { hasText: "Delete Table" }).click();
    await page.waitForTimeout(150);

    // Gone, and the host cell holds ordinary text again.
    expect(await page.locator("#nested-table").count()).toBe(0);
    expect(await page.locator(kHostCell).getAttribute("data-content-type")).toBe("text");
    expect(await page.locator(`${kHostCell} [contenteditable]`).count()).toBe(1);

    await undoButton(page).click();
    await page.waitForTimeout(150);

    // One undo brings back the table AND the host cell's content type.
    await expect(page.locator("#nested-table")).toHaveCount(1);
    expect(await page.locator(kHostCell).getAttribute("data-content-type")).toBe("table");
    expect(
      await page.locator("#nested-table > .bloom-cell").evaluateAll((cells) =>
        cells.map((c) => c.textContent?.trim()),
      ),
    ).toEqual(["N11", "N12", "N21", "N22"]);
  });
});
