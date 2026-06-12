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
    entry: { "bloom-grid": "src/index.tsx" },
    format: ["esm", "umd"],
    globalName: "BloomGrid",
    platform: "browser",
    // Match the old Rollup contract: only React is external; MUI/Emotion are
    // bundled into the library (tsdown otherwise auto-externalizes all deps).
    deps: {
      neverBundle: ["react", "react-dom", /^react-dom\//],
      alwaysBundle: [/^@mui\//, /^@emotion\//],
    },
    // Inline the icon SVGs as data-URL strings so the published bundle is
    // self-contained (matches the old Vite lib build's asset inlining).
    loader: { ".svg": "dataurl" },
    dts: true,
    // Ship the stylesheet next to the bundle (was the copy-css-file plugin).
    copy: ["src/bloom-grid.css"],
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

  // `vp test` config (merged from the old vitest.config.ts).
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
