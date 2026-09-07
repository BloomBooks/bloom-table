import { test, expect } from "@playwright/test";

// A table must fit the space its host gives it, whatever that space becomes. In
// Bloom a person makes the host narrower by splitting a page section in two,
// and the table has to answer that on its own: nothing tells it the host moved.
// The rules live in buildColumnTemplate in src/table-renderer.ts.

async function measure(page: import("@playwright/test").Page, tableId: string) {
  return page.evaluate((id) => {
    const table = document.getElementById(id) as HTMLElement;
    const cells = Array.from(
      table.querySelectorAll(":scope > .bloom-cell"),
    ) as HTMLElement[];
    return {
      table: table.getBoundingClientRect().right,
      widths: cells.map((c) => c.getBoundingClientRect().width),
      rights: cells.map((c) => c.getBoundingClientRect().right),
    };
  }, tableId);
}

async function setHostWidth(
  page: import("@playwright/test").Page,
  hostId: string,
  width: number,
) {
  await page.evaluate(
    ([id, w]) => {
      (document.getElementById(id as string) as HTMLElement).style.width = `${w}px`;
    },
    [hostId, width] as [string, number],
  );
}

test.describe("a table re-fits itself when its host narrows", () => {
  test("fill columns share whatever the host has", async ({ page }) => {
    await page.goto("/demo/ui-harness.html?fixture=narrow-host");
    await page.waitForSelector("#fill-table");

    const wide = await measure(page, "fill-table");
    expect(
      wide.widths[0],
      "Two fill columns should divide a 400px host between them.",
    ).toBeGreaterThan(150);

    // 100px is less than the two 60px column minimums together, which is the
    // case that used to push the right-hand column past the table's own edge.
    await setHostWidth(page, "fill-host", 100);
    const narrow = await measure(page, "fill-table");
    for (const right of narrow.rights)
      expect(
        right,
        `A cell's right edge (${Math.round(right)}) should not be past the table's ` +
          `own (${Math.round(narrow.table)}).`,
      ).toBeLessThanOrEqual(narrow.table + 1);
    expect(
      Math.abs(narrow.widths[0] - narrow.widths[1]),
      "The two fill columns should still be the same width as each other.",
    ).toBeLessThan(2);
  });

  test("pixel columns keep their ratio when they no longer fit", async ({
    page,
  }) => {
    await page.goto("/demo/ui-harness.html?fixture=narrow-host");
    await page.waitForSelector("#pixel-table");

    const wide = await measure(page, "pixel-table");
    expect(
      Math.round(wide.widths[0]),
      "A 200px column should be 200px wide while the host has room for it.",
    ).toBe(200);
    expect(Math.round(wide.widths[1])).toBe(100);

    await setHostWidth(page, "pixel-host", 150);
    const narrow = await measure(page, "pixel-table");
    for (const right of narrow.rights)
      expect(
        right,
        `A cell's right edge (${Math.round(right)}) should not be past the table's ` +
          `own (${Math.round(narrow.table)}).`,
      ).toBeLessThanOrEqual(narrow.table + 1);
    expect(
      narrow.widths[0] / narrow.widths[1],
      "The columns should still be two to one, which is the ratio they were given.",
    ).toBeCloseTo(2, 1);
  });
});
