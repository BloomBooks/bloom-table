import { test, expect, Page } from "@playwright/test";

// "Copy Debug Info" on the demo page (/demo/index.html, not the ui-harness the
// rest of the suite uses, because the button lives next to the user's attempt).
// Two things are under test: the "Actions since start" journal, which must hold
// every operation the user performed even after "Start Over" throws the work
// away, and the screenshot, which rides along on the clipboard's text/html
// flavour as a PNG data URI.

interface Clipboard {
  text: string;
  html: string;
  // Whether the button reports that the screenshot was included.
  outcome: string;
  // What the button's label said at that moment.
  label: string;
}

// Both flavours of what the button just wrote.
async function readClipboard(page: Page): Promise<Omit<Clipboard, "label" | "outcome">> {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    let text = "";
    let html = "";
    for (const item of items) {
      if (item.types.includes("text/plain")) text = await (await item.getType("text/plain")).text();
      if (item.types.includes("text/html")) html = await (await item.getType("text/html")).text();
    }
    return { text, html };
  });
}

// The lines of the "## Actions since start" section, without their timestamps.
function journalActions(text: string): string[] {
  // Reading text/plain back off the Windows clipboard turns every newline into
  // a carriage return and a newline.
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.startsWith("## Actions since start"));
  expect(start, "the snapshot has an 'Actions since start' section").toBeGreaterThanOrEqual(0);
  const actions: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const numbered = /^\d+\. (.+) — \d\d:\d\d:\d\d\.\d\d\d$/.exec(line);
    if (numbered) actions.push(numbered[1]);
  }
  return actions;
}

// A cold dev server compiles the demo on the first request, so the first two
// waits are given longer than the 5s default.
const kFirstLoadTimeout = 30000;

async function waitForAttemptTable(page: Page) {
  await expect(
    page.locator("#attempt-container #page > .bloom-table .bloom-cell").first(),
  ).toBeVisible({ timeout: kFirstLoadTimeout });
}

// Only an exercise has an attempt area, and the demo opens on whichever example
// it saved last, so name the exercise in localStorage before the page loads.
// Clicking it in the sidebar instead is unreliable: React's StrictMode runs the
// example-list fetch twice, and the second one re-selects the saved example, so
// it can undo a click that landed between the two.
async function openAlphabetExercise(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("bloom-table.activeExamplePath", "exercises/alphabet.html");
  });
  await page.goto("/demo/index.html", { waitUntil: "load" });
  await waitForAttemptTable(page);
}

// Grow the attempt table by one column and one row, with the on-canvas "+"
// buttons, exactly as a user does.
async function addColumnAndRow(page: Page) {
  const table = page.locator("#attempt-container #page > .bloom-table");
  const columnsBefore = (await table.getAttribute("data-column-widths"))!.split(",").length;
  const rowsBefore = (await table.getAttribute("data-row-heights"))!.split(",").length;

  await table.locator(".bloom-cell [contenteditable]").first().click();
  await page.locator('button[aria-label="Add column at the right edge"]').click({ force: true });
  await expect(table).toHaveAttribute(
    "data-column-widths",
    new RegExp(`^([^,]+,){${columnsBefore}}[^,]+$`),
  );
  await page.locator('button[aria-label="Add row at the bottom edge"]').click({ force: true });
  await expect(table).toHaveAttribute(
    "data-row-heights",
    new RegExp(`^([^,]+,){${rowsBefore}}[^,]+$`),
  );
}

// Click the button and read back what it copied. The button records the outcome
// of the last copy in data-last-copy, which is also how the test knows the
// capture (which is asynchronous) has finished. Its label says the same thing
// but goes back to "Copy Debug Info" after a few seconds.
async function copyAndRead(page: Page): Promise<Clipboard> {
  const button = page.getByRole("button", { name: /Copy Debug Info/ });
  await button.click();
  const copied = page.locator(
    "button[data-last-copy='with-screenshot'], button[data-last-copy='text-only']",
  );
  await expect(copied).toHaveCount(1, { timeout: 15000 });
  return {
    outcome: (await copied.getAttribute("data-last-copy"))!,
    label: (await copied.textContent()) ?? "",
    ...(await readClipboard(page)),
  };
}

test.describe("Copy Debug Info", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("copies the session's actions and a screenshot of the table", async ({ page }) => {
    await openAlphabetExercise(page);
    await addColumnAndRow(page);

    // An undo is itself an action the journal must report, and the undo stack
    // alone cannot: undoing removes the entry from it.
    const table = page.locator("#attempt-container #page > .bloom-table");
    await page.getByRole("button", { name: "Undo" }).first().click();
    await expect(table).toHaveAttribute("data-row-heights", "hug,hug");

    const clipboard = await copyAndRead(page);
    // The button reports which of the two copies happened.
    expect(clipboard.outcome).toBe("with-screenshot");
    expect(clipboard.label).toBe("Copied, with screenshot!");
    expect(clipboard.text).toContain("# bloom-table debug snapshot");
    // Each line is the operation's label followed by the detail the library
    // now records: which edge the row or column went to.
    expect(journalActions(clipboard.text)).toEqual([
      "Add Column — at the right edge",
      "Add Row — at the bottom edge",
      "Undo of Add Row — at the bottom edge",
    ]);
    expect(clipboard.text).not.toContain("screenshot capture failed");
    // The picture rides on the rich flavour.
    expect(clipboard.html).toContain('<img src="data:image/png');
    expect(clipboard.html).toContain("bloom-table debug snapshot");
  });

  test("Start Over restarts the journal with a marker", async ({ page }) => {
    await openAlphabetExercise(page);
    await addColumnAndRow(page);

    await page.getByRole("button", { name: "Start Over" }).click();
    // Back to the blank 2x2.
    const table = page.locator("#attempt-container #page > .bloom-table");
    await expect(table).toHaveAttribute("data-column-widths", "hug,hug");
    await expect(table).toHaveAttribute("data-row-heights", "hug,hug");

    await table.locator(".bloom-cell [contenteditable]").first().click();
    await page.locator('button[aria-label="Add row at the bottom edge"]').click({ force: true });
    await expect(table).toHaveAttribute("data-row-heights", "hug,hug,hug");

    const clipboard = await copyAndRead(page);
    expect(journalActions(clipboard.text)).toEqual([
      "Start Over",
      "Add Row — at the bottom edge",
    ]);
  });

  test("the journal survives a page reload", async ({ page }) => {
    await openAlphabetExercise(page);
    await addColumnAndRow(page);

    await page.reload({ waitUntil: "load" });
    await waitForAttemptTable(page);

    const clipboard = await copyAndRead(page);
    expect(journalActions(clipboard.text)).toEqual([
      "Add Column — at the right edge",
      "Add Row — at the bottom edge",
    ]);
  });
});
