// Proves each sample is reproducible through the real demo toolbar UI.
//
// For each sample: drive the editor harness with its recipe (clicking real toolbar buttons),
// extract the built table's canonical model, and assert it deep-equals the model of the
// validated tests/samples/NN.html. A screenshot of the built table is saved to
// tests/samples/output/ui/NN.png for human review.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import { UiInterpreter } from "../samples/ui/interpreter";
import { extractTableModelInPage } from "../samples/ui/extract-model";
import type { Command } from "../samples/ui/dsl";
import recipe01 from "../samples/01.recipe";
import recipe02 from "../samples/02.recipe";
import recipe05 from "../samples/05.recipe";
import recipe06 from "../samples/06.recipe";
import recipe07 from "../samples/07.recipe";
import recipe10 from "../samples/10.recipe";
import recipe95 from "../samples/95.recipe";

// Playwright runs from the repo root.
const OUT_DIR = join(process.cwd(), "tests", "samples", "output", "ui");

const SAMPLES: { name: string; recipe: Command[] }[] = [
  { name: "01", recipe: recipe01 },
  { name: "02", recipe: recipe02 },
  { name: "05", recipe: recipe05 },
  { name: "06", recipe: recipe06 },
  { name: "07", recipe: recipe07 },
  { name: "10", recipe: recipe10 },
  { name: "95", recipe: recipe95 },
];

test.describe("UI build → matches validated NN.html", () => {
  for (const sample of SAMPLES) {
    test(`sample ${sample.name}`, async ({ page, context }) => {
      // 1. Build it through the toolbar UI on the editor harness.
      await page.goto("/demo/ui-harness.html", { waitUntil: "load" });
      await page.waitForSelector("#attempt-container > .bloom-table .bloom-cell");
      await new UiInterpreter(page).run(sample.recipe);
      await page.waitForTimeout(150);

      const built = await page.evaluate(extractTableModelInPage, "#attempt-container > .bloom-table");

      // Clean up edit-mode artifacts so the review screenshot looks like the finished design
      // (drop overlay buttons, selection classes, hint borders, and the edit stylesheet).
      await page.evaluate(() => {
        document
          .querySelectorAll("[data-overlay-group],[data-btable-corner-handle],[data-table-overlay]")
          .forEach((e) => e.remove());
        document.querySelectorAll(".cell--selected").forEach((e) => e.classList.remove("cell--selected"));
        document.querySelectorAll(".table--selected").forEach((e) => e.classList.remove("table--selected"));
        document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
          if ((l as HTMLLinkElement).href.includes("bloom-table-edit"))
            (l as HTMLLinkElement).disabled = true;
        });
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(60);

      // Save a screenshot of the built table for human review.
      mkdirSync(OUT_DIR, { recursive: true });
      await page
        .locator("#attempt-container > .bloom-table")
        .screenshot({ path: join(OUT_DIR, `${sample.name}.png`) })
        .catch(() => {});

      // 2. Extract the model of the validated NN.html via the render harness.
      const ref = await context.newPage();
      await ref.goto(`/tests/samples/_harness.html?name=${sample.name}`, { waitUntil: "load" });
      await ref.waitForSelector("#page[data-ready='1']", { timeout: 10000 });
      const reference = await ref.evaluate(extractTableModelInPage, "#page > .bloom-table");
      await ref.close();

      // 3. Equivalence is the oracle.
      expect(built).toEqual(reference);
    });
  }
});
