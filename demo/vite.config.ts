import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import path from "path";
import { getExamples, handleSaveExampleRequest } from "./api";

// NOTE: The canonical dev/build config is the repo-root vite.config.ts (run via
// `pnpm dev`). This demo-local config is kept in sync with it so that starting a
// dev server against this file (e.g. `vp dev` from the demo/ directory) still
// serves the example API. Without the middleware below, /api/examples returns
// the SPA's index.html, ExampleBar's response.json() throws, the sidebar shows
// no examples, no table renders, and the toolbar/edge-drag appear "unresponsive".
export default defineConfig({
  root: __dirname,
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: false,
  },
});
