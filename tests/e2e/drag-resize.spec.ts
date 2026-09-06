import { test, expect, Page, Locator } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// Dragging a boundary has to move the model and the rendered grid together,
// while the pointer is still down, and one drag has to be one undo step. A
// double-click on the same boundary returns the track to hugging its contents.
// None of this can be seen without a layout engine, so it lives here.

const readTracks = (table: Locator) =>
  table.evaluate((el) => ({
    columns: el.getAttribute("data-column-widths"),
    rows: el.getAttribute("data-row-heights"),
    templateColumns: getComputedStyle(el).gridTemplateColumns,
    templateRows: getComputedStyle(el).gridTemplateRows,
  }));

const lastOperation = (page: Page) =>
  page.evaluate(() => window.bloomTableTestHooks!.tableHistoryManager.getLastOperationLabel());

const undo = (table: Locator) =>
  table.evaluate((el) => window.bloomTableTestHooks!.tableHistoryManager.undo(el as HTMLElement));

// The boundary a cell shares with the track after it. The handle is a couple of
// pixels wide, so the press lands just inside the cell's own edge.
async function edgeOf(cell: Locator, side: "right" | "bottom") {
  const box = (await cell.boundingBox())!;
  return side === "right"
    ? { x: box.x + box.width - 2, y: box.y + box.height / 2 }
    : { x: box.x + box.width / 2, y: box.y + box.height - 2 };
}

async function dragEdge(page: Page, cell: Locator, side: "right" | "bottom", by: number) {
  const start = await edgeOf(cell, side);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = side === "right" ? { x: start.x + by, y: start.y } : { x: start.x, y: start.y + by };
  await page.mouse.move(end.x, end.y, { steps: 5 });
  return async () => {
    await page.mouse.up();
  };
}

async function open(page: Page, fixture: string) {
  await page.goto(`/demo/ui-harness.html?fixture=${fixture}`, { waitUntil: "load" });
  await page.waitForSelector(".bloom-table .bloom-cell");
  await waitForTestHooks(page);
}

test.describe("dragging a boundary of the top-level table", () => {
  test("widens the column while the pointer is still down, and keeps the width when it comes up", async ({
    page,
  }) => {
    await open(page, "basic-table");
    const table = page.locator("#main-table");
    const before = await readTracks(table);

    const release = await dragEdge(page, table.locator(".bloom-cell").first(), "right", 60);

    // Mid-drag: the model and the rendered grid have both moved.
    await expect.poll(() => table.getAttribute("data-column-widths")).not.toBe(before.columns);
    const during = await readTracks(table);
    expect(during.templateColumns).not.toBe(before.templateColumns);

    await release();

    const after = await readTracks(table);
    expect(after.templateColumns).toBe(during.templateColumns);
    // The drag turns the first column from "hug" into a fixed size, in pixels.
    expect(after.columns).toMatch(/^[0-9.]+px,/);
    expect(parseFloat(after.templateColumns)).toBeGreaterThan(
      parseFloat(before.templateColumns),
    );
  });

  test("grows the row while the pointer is still down, and keeps the height when it comes up", async ({
    page,
  }) => {
    await open(page, "basic-table");
    const table = page.locator("#main-table");
    const before = await readTracks(table);

    const release = await dragEdge(page, table.locator(".bloom-cell").first(), "bottom", 50);

    await expect.poll(() => table.getAttribute("data-row-heights")).not.toBe(before.rows);
    const during = await readTracks(table);
    expect(during.templateRows).not.toBe(before.templateRows);

    await release();

    const after = await readTracks(table);
    expect(after.templateRows).toBe(during.templateRows);
    expect(after.rows).toMatch(/^[0-9.]+mm,/);
    expect(parseFloat(after.templateRows)).toBeGreaterThan(parseFloat(before.templateRows));
  });

  test("undoes a column drag in one step, in the model and on the screen", async ({ page }) => {
    await open(page, "basic-table");
    const table = page.locator("#main-table");
    const before = await readTracks(table);

    await (await dragEdge(page, table.locator(".bloom-cell").first(), "right", 60))();
    expect((await readTracks(table)).columns).not.toBe(before.columns);
    expect(await lastOperation(page)).toMatch(/Resize Column/i);

    expect(await undo(table)).toBe(true);

    await expect.poll(() => table.getAttribute("data-column-widths")).toBe(before.columns);
    // The attribute alone proved nothing once: an earlier undo reverted it and
    // never re-rendered, so the table on screen kept the dragged width.
    expect((await readTracks(table)).templateColumns).toBe(before.templateColumns);
  });

  test("undoes a row drag in one step, in the model and on the screen", async ({ page }) => {
    await open(page, "basic-table");
    const table = page.locator("#main-table");
    const before = await readTracks(table);

    await (await dragEdge(page, table.locator(".bloom-cell").first(), "bottom", 40))();
    expect((await readTracks(table)).rows).not.toBe(before.rows);
    expect(await lastOperation(page)).toMatch(/Resize Row/i);

    expect(await undo(table)).toBe(true);

    await expect.poll(() => table.getAttribute("data-row-heights")).toBe(before.rows);
    expect((await readTracks(table)).templateRows).toBe(before.templateRows);
  });

  test("returns a dragged column to hugging its contents on a double-click", async ({ page }) => {
    await open(page, "basic-table");
    const table = page.locator("#main-table");
    const cell = table.locator(".bloom-cell").first();

    await (await dragEdge(page, cell, "right", 60))();
    expect((await readTracks(table)).columns).toMatch(/^[0-9.]+px,/);

    const edge = await edgeOf(cell, "right");
    await page.mouse.dblclick(edge.x, edge.y);

    await expect.poll(() => table.getAttribute("data-column-widths")).toMatch(/^hug,/);
    expect(await lastOperation(page)).toMatch(/Auto-size Column/i);
  });

  test("returns a dragged row to hugging its contents on a double-click", async ({ page }) => {
    await open(page, "basic-table");
    const table = page.locator("#main-table");
    const cell = table.locator(".bloom-cell").first();

    await (await dragEdge(page, cell, "bottom", 50))();
    expect((await readTracks(table)).rows).toMatch(/^[0-9.]+mm,/);

    const edge = await edgeOf(cell, "bottom");
    await page.mouse.dblclick(edge.x, edge.y);

    await expect.poll(() => table.getAttribute("data-row-heights")).toMatch(/^hug,/);
    expect(await lastOperation(page)).toMatch(/Auto-size Row/i);
  });
});

test.describe("dragging a boundary of a nested table", () => {
  test("resizes the nested table's own column and leaves the outer table alone", async ({
    page,
  }) => {
    await open(page, "nested-tables");
    const outer = page.locator("#outer-table");
    const nested = page.locator("#nested-table");
    const outerBefore = await readTracks(outer);
    const nestedBefore = await readTracks(nested);

    await (await dragEdge(page, nested.locator(".bloom-cell").first(), "right", 40))();

    const nestedAfter = await readTracks(nested);
    expect(nestedAfter.columns).not.toBe(nestedBefore.columns);
    expect(nestedAfter.templateColumns).not.toBe(nestedBefore.templateColumns);
    expect((await readTracks(outer)).columns).toBe(outerBefore.columns);
  });

  test("undoes a nested column drag in one step", async ({ page }) => {
    await open(page, "nested-tables");
    const nested = page.locator("#nested-table");
    const before = await readTracks(nested);

    await (await dragEdge(page, nested.locator(".bloom-cell").first(), "right", 40))();
    expect((await readTracks(nested)).columns).not.toBe(before.columns);

    // Every entry belongs to the top-level table, which is the one that owns
    // the snapshot, so the undo goes through the outer table.
    expect(await undo(page.locator("#outer-table"))).toBe(true);

    await expect.poll(() => nested.getAttribute("data-column-widths")).toBe(before.columns);
    expect((await readTracks(nested)).templateColumns).toBe(before.templateColumns);
  });

  test("resizes the nested table's own row and leaves the outer table alone", async ({ page }) => {
    await open(page, "nested-tables");
    const outer = page.locator("#outer-table");
    const nested = page.locator("#nested-table");
    const outerBefore = await readTracks(outer);
    const nestedBefore = await readTracks(nested);

    await (await dragEdge(page, nested.locator(".bloom-cell").first(), "bottom", 30))();

    expect((await readTracks(nested)).rows).not.toBe(nestedBefore.rows);
    expect((await readTracks(outer)).rows).toBe(outerBefore.rows);
  });

  test("returns a nested column to hugging its contents on a double-click", async ({ page }) => {
    await open(page, "nested-tables");
    const nested = page.locator("#nested-table");
    const cell = nested.locator(".bloom-cell").first();

    const edge = await edgeOf(cell, "right");
    await page.mouse.dblclick(edge.x, edge.y);

    await expect.poll(() => nested.getAttribute("data-column-widths")).toMatch(/^hug,/);
  });
});
