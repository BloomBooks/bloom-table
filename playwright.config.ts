import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // The screenshot baselines in *-snapshots/ are all "-chromium-win32". Linux
  // renders different fonts, and no Linux baseline exists yet, so a CI run
  // compares nothing rather than failing on every snapshot.
  ignoreSnapshots: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  // Use html reporter but never auto-open UI to avoid hanging
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:5173",
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
  //  - the url and baseURL name 127.0.0.1, not localhost: localhost resolves to
  //    ::1 first, and another checkout's dev server bound to ::1 answers 404
  //    there while this repo's server holds the IPv4 address.
  webServer: {
    command: "pnpm dev --host",
    url: "http://127.0.0.1:5173/demo/ui-harness.html",
    reuseExistingServer: true,
  },
});
