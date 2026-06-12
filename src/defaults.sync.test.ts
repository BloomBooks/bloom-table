import { describe, it, expect } from "vite-plus/test";
import { EDGE_DEFAULT } from "./defaults";

// Simple parser to extract CSS custom properties from src/bloom-table.css
function readCssFile(): string {
  // Vitest runs in Node; use fs to read repo file
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  const file = path.resolve(__dirname, "./bloom-table.css");
  return fs.readFileSync(file, "utf8");
}

function extractVar(css: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`);
  const m = css.match(re);
  return m ? m[1].trim() : null;
}

describe("CSS defaults match TS defaults", () => {
  it("--edge-default-* vars match EDGE_DEFAULT", () => {
    const css = readCssFile();
    const w = extractVar(css, "--edge-default-weight");
    const s = extractVar(css, "--edge-default-style");
    const c = extractVar(css, "--edge-default-color");
    expect(w).toBe(String(EDGE_DEFAULT.weight));
    expect(s).toBe(String(EDGE_DEFAULT.style));
    expect(c).toBe(String(EDGE_DEFAULT.color));
  });
});
