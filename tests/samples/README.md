# Design-implementation loop

A visual loop for driving bloom-table development from real designs. Numbered target
images (`01.png … 95.png`, roughly by difficulty) are implemented with the library,
rendered, screenshotted, and compared by eye. When a design exposes something the library
can't express, the library itself gets fixed.

## Rules

- **Each sample is ONE table.** Every `NN.html` must have a single root `.bloom-table` element —
  no sibling tables, no flex/grid wrapper composing several tables. When a design needs
  sub-structure (a block beside another, boxes within a layout, a title above a grid),
  express it with **embedded/nested tables**: a cell with `data-content-type="table"` whose
  child is another `.bloom-table`. The renderer suppresses a nested table's perimeter so the shared
  boundary is a single stroke. Non-table text (titles, captions) goes in cells of the
  outer/nested table, not in bare divs alongside it.

- **No cheating — only what a real user can do.** A sample must be reproducible by an end
  user driving *this library's UI*: the toolbar/menu buttons (add/remove rows & columns,
  set borders/edges, corners, gaps, spans, cell content type), typing text into cells, and
  inserting images. That means an `NN.html` may contain **only**:
  - the structural classes `.bloom-table` / `.bloom-cell`,
  - the author-level `data-*` attributes the library's own operations set
    (`data-column-widths`, `data-row-heights`, `data-edges-h` / `-v`, `data-border-default`,
    `data-corners`, `data-gap-x` / `-y`, `data-span-x` / `-y`, `data-content-type`),
  - typed text content, and `<img>` in image cells.

  **NOT allowed:** arbitrary inline `style=` (padding, `justify-content`, font, color, size),
  `<style>` blocks, flex/grid wrappers, hand-drawn SVG, custom fonts. (Renderer-written inline
  styles like `border-width` are fine — but the *author* never types those; `attachTable`
  writes them.) If a design needs something the library's UI can't produce (e.g. per-cell text
  alignment), that's a **real gap**: implement it in the library, or file the sample under
  `ai-gaveup` with the gap recorded in `NOTES.md`. Don't paper over it with raw CSS.

## Files

- `NN.png` — target design (input). The thing we're trying to reproduce.
- `NN.html` — the attempt: a self-contained HTML fragment with one or more `.bloom-table`
  elements **plus** any surrounding markup (titles, rules, captions). **No `<script>`
  tags** — the harness attaches the tables.
- `_harness.html` — render page. Open `?name=NN`; it fetches `NN.html`, injects it into a
  clean white `#page` wrapper, loads only the structural CSS, and calls `attachTable()` on
  every table (clean read state, no editor overlays).
- `capture.mjs` — screenshots the render to `output/NN.png`.
- `output/` (git-ignored) — rendered screenshots, triaged into:
  - `ai-success/NN.png` — judged a faithful match.
  - `ai-gaveup/NN.png` — best attempt; couldn't fully match (see `NOTES.md`).
  - `user-reject/NN.png` — **you** move `ai-success` images here when you disagree; they
    become open work on the next pass.
- `NOTES.md` — running log of library gaps found and changes made.

## Running the loop

1. Start the dev server once (leave it running):
   ```
   pnpm dev
   ```
2. Author / edit `NN.html` using the library's data-attribute API (`data-column-widths`,
   `data-row-heights`, `data-edges-h` / `-v`, `data-border-default`, `data-span-x` / `-y`,
   `data-corners`, `data-gap-x` / `-y`, `data-content-type`). See `../../src/table-model.ts`
   and `../../design/model.md`.
3. Capture:
   ```
   pnpm capture NN      # one sample
   pnpm capture         # every NN.html present
   ```
4. Compare `output/NN.png` against `NN.png`.
5. If the mismatch is in the markup, fix `NN.html` and re-capture. If it's a library
   limitation, fix `src/` and re-capture. Log gaps + changes in `NOTES.md`.
6. File the result: move `output/NN.png` into `output/ai-success/` or `output/ai-gaveup/`.

Manual harness check (in a browser): `http://localhost:5173/tests/samples/_harness.html?name=NN`.

## UI recipes (Phase 2 — build it through the toolbar)

Phase 1 proves a sample is expressible as HTML. Phase 2 proves a real user can build it through
the demo's toolbar UI. Each sample gets a `NN.recipe.ts` (beside `NN.png` / `NN.html`) — a list
of DSL commands describing the user's clicks/typing. A Playwright interpreter replays them
against `demo/ui-harness.html` and the `tests/e2e/ui-build.spec.ts` test asserts the built
table's model deep-equals the validated `NN.html` (a built-table screenshot is saved to
`output/ui/NN.png`).

- DSL command reference + how to author/run a recipe: [`ui/DSL.md`](ui/DSL.md).
- Run: `pnpm e2e ui-build` (needs `pnpm dev`).
