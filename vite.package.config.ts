import { defineConfig } from "vite-plus";

// The dist smoke test is not part of `pnpm test`: it needs `pnpm build` to have
// run, and `pnpm test` has to pass in a fresh checkout with no dist/. So it has
// its own config and its own script, `pnpm test:package`, and the coverage
// report never sees it.
export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/package/**/*.{test,spec}.ts"],
  },
});
