import { describe, it, expect } from "vite-plus/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The dev server's dependency pre-bundler splits the MUI styles barrel into a
// chunk that calls Emotion's lazy init function without importing it, so the
// demo dies at load with `init_emotion_react_browser_development_esm is not
// defined`. That error names Emotion, and reads as a broken install, so this
// test names the real cause instead. Import each MUI component from its own
// path, and take `styled` from nowhere: the `sx` prop covers what we need.
const forbidden = /["']@mui\/material\/styles["']/;

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

describe("MUI imports", () => {
  it("nobody imports the @mui/material/styles barrel", () => {
    const offenders = [...sourceFiles("src"), ...sourceFiles("demo")].filter((path) =>
      forbidden.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
