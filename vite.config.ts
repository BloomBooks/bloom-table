import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { getExamples, handleSaveExampleRequest } from "./demo/api";

// Unified Vite+ config. One dev server (`vp dev`) serves the demo and gives HMR
// for both the demo and the library source (the demo imports straight from ../src).
// `vp pack` builds the publishable library; `vp test` runs the unit tests.
export default defineConfig({
  plugins: [
    react(),
    {
      name: "save-example-api",
      configureServer(server) {
        server.middlewares.use("/api/save-example", handleSaveExampleRequest);
      },
    },
    {
      name: "demo-api-server",
      configureServer(server) {
        server.middlewares.use("/api/examples", getExamples);
      },
    },
  ],

  // `vp dev` serves the repo root and opens the demo in a browser tab.
  server: {
    open: "/demo/index.html",
  },

  // `vp pack` builds the library (replaces the old `vite build` lib config and
  // the vite-plugin-dts / copy-css-file plugins).
  pack: {
    entry: { "bloom-table": "src/index.tsx" },
    format: ["esm", "umd"],
    globalName: "BloomTable",
    platform: "browser",
    // React, MUI, and Emotion are all peer dependencies, so they are external:
    // the host app (e.g. Bloom) provides a single shared copy. The core attach
    // path is framework-free; only the optional TableMenu React components pull
    // these in, and consumers that don't import them never load them.
    deps: {
      neverBundle: [
        "react",
        "react-dom",
        /^react-dom\//,
        /^react\//,
        /^@mui\//,
        /^@emotion\//,
      ],
    },
    // Inline the icon SVGs as data-URL strings so the published bundle is
    // self-contained (matches the old Vite lib build's asset inlining).
    loader: { ".svg": "dataurl" },
    dts: true,
    // Ship the stylesheets next to the bundle (was the copy-css-file plugin).
    // bloom-table.css holds the structural/read-time rules; bloom-table-edit.css
    // holds the edit-only selection/hint rules; table-menu.css holds the React
    // panel's utility styles for hosts that don't ship Tailwind.
    copy: ["src/bloom-table.css", "src/bloom-table-edit.css", "src/table-menu.css"],
    outputOptions(options, format) {
      if (format === "umd") {
        options.globals = {
          react: "React",
          "react-dom": "ReactDOM",
          "react-dom/server": "ReactDOMServer",
        };
      }
      return options;
    },
  },

  // `vp fmt` / `vp check`. The demo exercise & test HTML files are data
  // fixtures (rewritten by the save-example API via JSDOM), not source to
  // auto-format — and some contain deliberately loose markup oxfmt rejects.
  fmt: {
    ignorePatterns: ["demo/exercises/**", "demo/tests/**"],
  },

  // `vp test` config (merged from the old vitest.config.ts).
  test: {
    globals: true,
    environment: "happy-dom",
    // The demo has its own unit tests now (the debug snapshot's action
    // journal), so the glob covers demo/ as well as the library.
    include: [
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "demo/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Only the library counts. `include` names src/ rather than excluding
      // "demo/**" and "tests/**": an exclude pattern is matched against the
      // absolute path, and this repo is checked out in directories whose own
      // name ends in "tests", so "tests/**" excludes the whole tree and the
      // report comes back 0/0.
      include: ["src/**"],
      exclude: ["**/*.test.*", "src/test-support/**", "**/*.d.ts"],
      // The measured coverage at the end of the last phase, minus one point
      // each. The gate can only move up; raise it at the end of every phase.
      thresholds: {
        statements: 83,
        branches: 72,
        functions: 82,
        lines: 86,
      },
    },
  },
});
