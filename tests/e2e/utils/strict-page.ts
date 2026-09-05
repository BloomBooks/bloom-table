import { test as base, expect } from "@playwright/test";

export { expect };
export type { Page, Locator } from "@playwright/test";

// Messages the app writes on purpose, which must not fail a test. Keep this
// list empty unless a message is a deliberate part of the app's behaviour, and
// say here why the message is expected.
const ALLOWED_CONSOLE_ERRORS: RegExp[] = [];

function isAllowed(text: string): boolean {
  return ALLOWED_CONSOLE_ERRORS.some((pattern) => pattern.test(text));
}

// A test that fails when the page throws or logs an error.
//
// Without this a thrown exception inside the library is invisible: the browser
// swallows it, the assertions still pass on the state that happened to survive,
// and the spec goes green. Every spec imports `test` and `expect` from here.
export const test = base.extend<{ page: import("@playwright/test").Page }>({
  page: async ({ page }, use, testInfo) => {
    const problems: string[] = [];

    page.on("pageerror", (error) => {
      problems.push(`pageerror: ${error.message}`);
    });

    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (isAllowed(text)) return;
      problems.push(`console.error: ${text}`);
    });

    await use(page);

    // A test that already failed reports its own reason. Adding these on top
    // hides it.
    if (testInfo.status !== testInfo.expectedStatus) return;

    expect(problems, "the page reported errors").toEqual([]);
  },
});
