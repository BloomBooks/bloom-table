// Renders sample attempts via the dev server and screenshots each one.
//
//   node tests/samples/capture.mjs 07      # one sample
//   node tests/samples/capture.mjs 01 02   # several
//   node tests/samples/capture.mjs         # every NN.html present
//
// Requires the dev server to be running (`pnpm dev`, http://localhost:5173),
// the same assumption the Playwright e2e suite makes.
//
// Output goes to tests/samples/output/NN.png (staging). After judging the
// result, move it into output/ai-success/ or output/ai-gaveup/.

import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readdirSync } from "node:fs";

const samplesDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(samplesDir, "output");
const BASE = process.env.BASE_URL || "http://localhost:5173";

function names() {
  const args = process.argv.slice(2);
  if (args.length) return args.map((a) => a.replace(/\.html$/, ""));
  return readdirSync(samplesDir)
    .filter((f) => /^\d+\.html$/.test(f))
    .map((f) => f.replace(/\.html$/, ""))
    .sort();
}

const targets = names();
if (targets.length === 0) {
  console.error("No samples to capture (no NN.html files and no args given).");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const d of ["ai-success", "ai-gaveup", "user-reject"]) {
  mkdirSync(join(outDir, d), { recursive: true });
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

let failures = 0;
for (const name of targets) {
  const url = `${BASE}/tests/samples/_harness.html?name=${name}`;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 15000 });
    await page.waitForSelector("#page[data-ready='1']", { timeout: 10000 });
    await page.waitForTimeout(150);
    const out = join(outDir, `${name}.png`);
    await page.locator("#page").screenshot({ path: out });
    console.log(`captured ${name} -> ${out}`);
  } catch (err) {
    failures++;
    console.error(`FAILED ${name}: ${err.message}`);
  }
}

await browser.close();
process.exit(failures ? 1 : 0);
