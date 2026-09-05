import { Page } from "@playwright/test";

export interface ClipboardFlavours {
  text: string;
  html: string;
}

// Both flavours of what the page last wrote to the clipboard.
//
// Reading text/plain back on Windows turns every newline the page wrote into a
// carriage return and a newline, so this normalises the line endings. Without
// that step a regex anchored with `$`, or a comparison of parsed lines, fails in
// a way that names the wrong culprit: it reads as "the feature wrote nothing"
// rather than "every line has one more character than it should".
export async function readClipboard(page: Page): Promise<ClipboardFlavours> {
  const raw = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    let text = "";
    let html = "";
    for (const item of items) {
      if (item.types.includes("text/plain")) text = await (await item.getType("text/plain")).text();
      if (item.types.includes("text/html")) html = await (await item.getType("text/html")).text();
    }
    return { text, html };
  });
  return {
    text: raw.text.replace(/\r\n/g, "\n"),
    html: raw.html.replace(/\r\n/g, "\n"),
  };
}
