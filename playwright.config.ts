import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Use html reporter but never auto-open UI to avoid hanging
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the dev server when nothing is serving 5173 yet, and reuse the one you
  // already have running. Without this every test fails with
  // ERR_CONNECTION_REFUSED, which reads as a broken app rather than a missing
  // server.
  // Two details make the probe work, and both fail the same way — Playwright
  // starts a SECOND server, which finds 5173 taken, moves to 5174, and never
  // satisfies the probe:
  //  - the url must name a page that exists. "/" is a 404 here, and Playwright
  //    counts a 404 as not-ready.
  //  - --host: a plain `vp dev` binds ::1 only, so the probe's 127.0.0.1 is
  //    refused while a browser is served perfectly well.
  webServer: {
    command: "pnpm dev --host",
    url: "http://localhost:5173/demo/ui-harness.html",
    reuseExistingServer: true,
  },
});
