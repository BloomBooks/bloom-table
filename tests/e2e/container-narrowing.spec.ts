import { test, expect, Page } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";

// A drag turns a column's width into pixels. The host can then make its element
// narrower than the sum of those pixels, and today the table keeps them: the
// right-hand column is clipped instead of refitted.

const kTable = "#main-table";
const kCell = `${kTable} > .bloom-cell`;

async function open(page: Page) {
  await page.goto("/demo/ui-harness.html?fixture=basic-table", {
    waitUntil: "load",
  });
  await page.waitForSelector(kCell);
  await waitForTestHooks(page);
}

// plans/004-refit-on-container-resize-and-row-growth.md, item 1, owns the width
// rule this test has to assert; it is unwritten, so the test cannot run yet.
test.fixme("a narrowed container refits the table instead of clipping it", async ({
  page,
}: {
  page: Page;
}) => {
  await open(page);
  const table = page.locator(kTable);

  // Drag the first column boundary, which writes both widths in pixels.
  const box = (await table.locator(".bloom-cell").first().boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect.poll(() => table.getAttribute("data-column-widths")).toMatch(/px/);

  const full = (await table.boundingBox())!.width;
  await page.locator("#editor").evaluate(
    (el, width) => {
      (el as HTMLElement).style.width = `${width}px`;
    },
    Math.round(full / 2),
  );

  const host = (await page.locator("#editor").boundingBox())!;
  const after = (await table.boundingBox())!;
  expect(after.width).toBeLessThanOrEqual(host.width);

  // Every cell still tiles the grid: none of them sticks out past the table.
  const overflowing = await page.locator(kCell).evaluateAll((cells) => {
    const parent = cells[0].parentElement!.getBoundingClientRect();
    return cells
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.right > parent.right + 1 || r.bottom > parent.bottom + 1).length;
  });
  expect(overflowing).toBe(0);
});
