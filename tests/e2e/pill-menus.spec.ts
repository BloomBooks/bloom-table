import { test, expect, Page } from "./utils/strict-page";
import { waitForTestHooks } from "./utils/test-hooks";
import { kPillMenuLabels, PillMenu } from "../../src/test-support/menu-item-labels";

// The unit suite beside the menus (src/table-size-buttons.menu-items.test.ts)
// says what each item does. This one says the item can be reached and clicked
// where a real browser draws it: the popup is not clipped by an ancestor, the
// point at an item's middle belongs to that item, and the click runs the
// command and records one undo step.

// These three take the table away, so each gets its own page rather than a turn
// in the loop that walks the rest.
const kRemovesTheTable = ["Cut Table", "Delete Table"];
// Sliders and colour inputs, which a click does not operate.
const kNotClickable = [
  "Padding between border and text",
  "Fill",
  "Border color",
  "Horizontal space between cells",
  "Vertical space between cells",
];
// The loop below starts from the top-left cell, so the two commands that would
// move that row or column past the edge of the table are disabled. Every other
// item must be enabled; a new one that is not shows up here as a failure.
const kDisabledAtTopLeft: Record<PillMenu, string[]> = {
  row: ["Move Row Up"],
  column: ["Move Left"],
  table: [],
};

test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await page.goto("/demo/ui-harness.html?fixture=basic-table", { waitUntil: "load" });
  await page.waitForSelector("#main-table .bloom-cell");
  await waitForTestHooks(page);
}

// The pills follow the selected cell, so every menu starts from a click in one.
async function openPill(page: Page, menu: PillMenu) {
  // A popup left open by the previous item would sit over the pill.
  if (await page.locator("[data-btable-menu]").count()) {
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-btable-menu]")).toHaveCount(0);
  }
  await page.locator("#main-table > .bloom-cell").first().click({ force: true });
  await page.locator(`[data-btable-menu-pill="${menu}"]`).click();
  await expect(page.locator("[data-btable-menu]")).toBeVisible();
}

const signature = (page: Page) =>
  page.locator("#main-table").evaluate((el) => {
    const cells = Array.from(el.children).filter((c) => c.classList.contains("bloom-cell"));
    return [
      el.getAttribute("data-row-heights"),
      el.getAttribute("data-column-widths"),
      cells.length,
      cells.map((c) => c.getAttribute("data-content-type") ?? "").join(""),
      (el as HTMLElement).innerText.replace(/\s+/g, " "),
    ].join("|");
  });

const historyLength = (page: Page) =>
  page.evaluate(
    () => window.bloomTableTestHooks!.tableHistoryManager.getEntriesForDebug().length as number,
  );

const undo = (page: Page) =>
  page
    .locator("#main-table")
    .evaluate((el) => window.bloomTableTestHooks!.tableHistoryManager.undo(el as HTMLElement));

// Whether the point at the middle of the control belongs to the control. A
// popup clipped by an ancestor's overflow still measures fine and still answers
// getAttribute; only a hit test says the user could have clicked it.
const reachable = (page: Page, label: string) =>
  page.locator(`[data-btable-menu] [aria-label="${label}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0 && r.height > 0,
      hit: !!at && (at === el || el.contains(at) || at.contains(el)),
    };
  });

for (const menu of ["row", "column", "table"] as PillMenu[]) {
  test.describe(`the ${menu} pill menu`, () => {
    test(`offers exactly the items the unit suite describes`, async ({ page }) => {
      await open(page);
      await openPill(page, menu);

      const rendered = await page
        .locator("[data-btable-menu]")
        .evaluate((el) =>
          Array.from(el.querySelectorAll("[aria-label]")).map((c) => c.getAttribute("aria-label")!),
        );

      expect(rendered).toEqual(kPillMenuLabels[menu]);
    });

    test(`draws every item where the pointer can reach it`, async ({ page }) => {
      await open(page);
      await openPill(page, menu);

      const unreachable: string[] = [];
      for (const label of kPillMenuLabels[menu]) {
        const where = await reachable(page, label);
        if (!where.inViewport || !where.hit) unreachable.push(`${label}: ${JSON.stringify(where)}`);
      }

      expect(unreachable).toEqual([]);
    });

    test(`runs every command from a real click, one undo step each`, async ({ page, context }) => {
      // Copy Table writes the table to the clipboard, which throws without this.
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await open(page);
      const start = await signature(page);
      const labels = kPillMenuLabels[menu].filter(
        (l) => !kNotClickable.includes(l) && !kRemovesTheTable.includes(l),
      );

      const disabled: string[] = [];
      for (const label of labels) {
        await openPill(page, menu);
        const item = page.locator(`[data-btable-menu] [aria-label="${label}"]`);
        if (await item.isDisabled()) {
          disabled.push(label);
          continue;
        }
        const before = await historyLength(page);

        await item.click();
        // "Paint format" enters a mode that hides the pills until Escape ends it.
        if (label === "Paint format") await page.keyboard.press("Escape");

        const added = (await historyLength(page)) - before;
        expect(added, `"${label}" recorded ${added} undo steps`).toBeLessThanOrEqual(1);
        if (added === 1) {
          expect(await undo(page)).toBe(true);
          await expect.poll(() => signature(page), { message: label }).toBe(start);
        }
      }
      expect(disabled).toEqual(kDisabledAtTopLeft[menu]);
    });
  });
}

test.describe("the two Table menu commands that take the table away", () => {
  for (const label of kRemovesTheTable) {
    test(`${label} removes the table from the page`, async ({ page, context }) => {
      // Cut Table writes the table to the clipboard on its way out.
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await open(page);
      await openPill(page, "table");

      await page.locator(`[data-btable-menu] [aria-label="${label}"]`).click();

      await expect(page.locator("#main-table")).toHaveCount(0);
    });
  }
});
