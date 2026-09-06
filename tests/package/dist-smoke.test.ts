import { describe, it, expect, beforeAll } from "vite-plus/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

// What Bloom installs is dist/, not src/. These tests import the built bundle
// the way a consumer does, so a broken entry point, a missing stylesheet, a
// bundled copy of a peer dependency or a dropped export fails here rather than
// in the host. `pnpm build` has to run first, so this file is its own project
// (`pnpm test:package`) and no part of `pnpm test`.

const kDist = path.resolve(__dirname, "..", "..", "dist");
const kBundle = path.join(kDist, "bloom-table.mjs");
const kTypes = path.join(kDist, "bloom-table.d.mts");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let library: any;

beforeAll(async () => {
  if (!fs.existsSync(kBundle)) {
    throw new Error(`No build to test: ${kBundle} is missing. Run "pnpm build" first.`);
  }
  // A bare Windows path is not a valid ESM specifier: Node reads "D:" as a URL
  // scheme. The file URL is.
  library = await import(pathToFileURL(kBundle).href);
});

const aTable = (): HTMLElement => {
  document.body.innerHTML = `
    <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
      <div class="bloom-cell" data-content-type="text"><div contenteditable="true">a</div></div>
      <div class="bloom-cell" data-content-type="text"><div contenteditable="true">b</div></div>
      <div class="bloom-cell" data-content-type="text"><div contenteditable="true">c</div></div>
      <div class="bloom-cell" data-content-type="text"><div contenteditable="true">d</div></div>
    </div>`;
  return document.querySelector(".bloom-table") as HTMLElement;
};

const cellCount = (table: HTMLElement) =>
  Array.from(table.children).filter((c) => c.classList.contains("bloom-cell")).length;

describe("the built bundle as a consumer imports it", () => {
  it("attaches a table, adds a row, and undoes the row", () => {
    const table = aTable();
    library.attachTable(table);

    new library.BloomTable(table).addRowAt(1);
    expect(cellCount(table)).toBe(6);

    expect(library.tableHistoryManager.undo(table)).toBe(true);
    expect(cellCount(table)).toBe(4);

    library.detachTable(table);
    library.tableHistoryManager.reset();
  });

  it("ships the three stylesheets the package.json points hosts at", () => {
    for (const name of ["bloom-table.css", "bloom-table-edit.css", "table-menu.css"]) {
      expect(fs.existsSync(path.join(kDist, name)), name).toBe(true);
      expect(fs.statSync(path.join(kDist, name)).size).toBeGreaterThan(0);
    }
  });

  it("keeps React, MUI and Emotion external instead of bundling a copy", () => {
    const bundle = fs.readFileSync(kBundle, "utf8");

    // A peer dependency must arrive as an import, never as inlined source.
    const imported = Array.from(bundle.matchAll(/from\s*"([^"]+)"/g)).map((m) => m[1]);
    expect(imported).toContain("react");
    expect(imported).toContain("react-dom");
    expect(imported.some((s) => s.startsWith("@mui/"))).toBe(true);

    // Strings that only a copy of the libraries' own source carries.
    for (const marker of [
      "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED",
      "Minified React error",
      "react.production",
      "@emotion/sheet",
    ]) {
      expect(bundle.includes(marker), marker).toBe(false);
    }
  });

  it("exports the same names as the last time this test was updated", () => {
    const types = fs.readFileSync(kTypes, "utf8");
    const last = types.lastIndexOf("export {");
    expect(last, "no export list in bloom-table.d.mts").toBeGreaterThan(-1);

    const names = types
      .slice(types.indexOf("{", last) + 1, types.indexOf("}", last))
      .split(",")
      .map((n) => n.trim().replace(/^type\s+/, ""))
      .filter(Boolean)
      .sort();

    expect(names).toMatchSnapshot();
  });

  it("every runtime export is named in the type file", () => {
    const types = fs.readFileSync(kTypes, "utf8");
    const last = types.lastIndexOf("export {");
    const declared = new Set(
      types
        .slice(types.indexOf("{", last) + 1, types.indexOf("}", last))
        .split(",")
        .map((n) => n.trim().replace(/^type\s+/, "")),
    );

    const undeclared = Object.keys(library).filter((n) => !declared.has(n));
    expect(undeclared).toEqual([]);
  });
});
