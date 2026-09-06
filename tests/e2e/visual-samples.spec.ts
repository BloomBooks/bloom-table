import * as fs from "fs";
import * as path from "path";
import { test, expect } from "./utils/strict-page";

// The renderer and the stylesheet decide what a table looks like, and no unit
// test can see that. Every sample and every fixture is rendered read-state
// through tests/samples/_harness.html and compared with a stored image, so a
// change to either shows up as a picture rather than as a broken expectation.

const kViewport = { width: 1000, height: 800 };

const htmlFilesIn = (dir: string) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".html") && !f.startsWith("_"))
    .map((f) => path.basename(f, ".html"))
    .sort();

const samples = htmlFilesIn(path.join(__dirname, "..", "samples"));
const fixtures = htmlFilesIn(path.join(__dirname, "fixtures"));

async function renderReadState(
  page: import("@playwright/test").Page,
  name: string,
  from: "samples" | "fixtures",
) {
  await page.setViewportSize(kViewport);
  await page.goto(`/tests/samples/_harness.html?name=${name}&from=${from}`, {
    waitUntil: "load",
  });
  await page.waitForSelector("#page[data-ready='1']");
}

test.describe("every sample renders as its stored picture", () => {
  for (const name of samples) {
    test(`sample ${name}`, async ({ page }) => {
      await renderReadState(page, name, "samples");

      await expect(page.locator("#page")).toHaveScreenshot(`sample-${name}.png`, {
        maxDiffPixelRatio: 0.03,
      });
    });
  }
});

test.describe("every e2e fixture renders as its stored picture", () => {
  for (const name of fixtures) {
    test(`fixture ${name}`, async ({ page }) => {
      await renderReadState(page, name, "fixtures");

      await expect(page.locator("#page")).toHaveScreenshot(`fixture-${name}.png`, {
        maxDiffPixelRatio: 0.03,
      });
    });
  }
});
