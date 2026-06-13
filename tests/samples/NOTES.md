# Loop notes — library gaps & changes

Running log of what the design samples expose about the library, and what was changed to
address it. One section per sample; record gaps even when worked around.

> **Important framing (from the user):** a sample must be reproducible by a real end user
> using ONLY this library's UI (toolbar buttons + typing text + inserting images). No raw
> CSS/HTML, no inline `style=`, no flex/grid wrappers, no hand-drawn SVG. When the UI can't
> produce a design, that's a *real gap to implement in the library* (or file under
> `ai-gaveup`). See `README.md`.

## Systemic gaps found (block multiple samples) + fixes

These came out of redoing the samples *honestly* (only author-level `data-*` + text + images):

1. **No text alignment.** Cells were always centered (`.cell { justify-content:center }`); no
   control or attribute for left/right/center. Blocked left-aligned columns in **02**/**10**.
   ✅ **FIXED:** added a per-cell `data-align` (`start`/`center`/`end`) — model
   `getCellAlign`/`setCellAlign` (`table-model.ts`), renderer maps it to `justify-content` +
   `text-align` (`table-renderer.ts`), and a "Text alignment" Left/Center/Right control in the
   Cell menu (`components/CellSection.tsx`). Tests added.

2. **Gaps didn't render, no gap UI.** `data-gap-x`/`-y` existed and the renderer read them, but
   *only* for border sided-painting — they never set the CSS grid `gap` (verified computed
   `gap` stayed `0px`). Blocked separated boxes/grids in **05**, **06**, **07**, composites.
   ✅ **FIXED:** renderer now sets `column-gap`/`row-gap` from `data-gap-x`/`-y`
   (`table-renderer.ts`; uniform per axis — per-boundary variation still only affects borders).
   Confirmed against the user's feedback (`output/user-feedback.md`) for 05 and 06. *(Still
   open: a toolbar control to set spacing — the wiring works, the UI button doesn't exist yet.)*

3. **Per-cell rounded corners not rendered.** `getCellCorners`/`setCellCorners` existed but the
   renderer only rounded the four *table* corners.
   ✅ **FIXED:** renderer now applies `data-corners` on individual cells (`table-renderer.ts`).
   Test added.

## 01 — irregular column split

✅ ai-success. No library changes. 2×2 border-only grid; full-width top + mid divider, right
cell closed into a short box, bottom-left boxed. Pure `data-edges-*` + empty cells. Fully
user-reproducible.

## 02 — interior-only vertical rules (no outer frame)

⛔ ai-gaveup (blocked on **gap #1: text alignment**). Structure is correct and user-buildable:
3×4, `data-border-default` none, concise `data-edges-v` for the two interior rules. But the
target's columns 1 & 2 are left-aligned and column 3 centered — the library centers
everything and offers no alignment control. Needs alignment feature to pass.

## 05 — `double` border style, stacked boxes

⛔ ai-gaveup (blocked on **gap #2: visual gaps**). The `double` border works (renderer clamps
to ≥4px). But the three boxes need vertical *space* between them; `data-gap-y` doesn't produce
a visual gap and there's no UI for spacing, so the boxes render touching. Font is also serif in
the target vs the library's default — not user-controllable, treated as cosmetic.

## 06 — two independent grids side by side

⛔ ai-gaveup (blocked on **gap #2: visual gaps**). Built honestly as ONE table: outer 1×2 with
borders off, each cell a nested grid (explicit solid edges, since nested perimeters are
suppressed by default). Renders correctly *except* there's no space between the two grids
(`data-gap-x` has no visual effect), so their adjacent perimeters touch and double up. Needs
gap rendering to pass.

## 07 — gap-separated cells, rounded corners, text + image

✅ ai-success (after fixes #2 gap render + #3 per-cell corners). Single nested table: outer 3×2
of "groups", each group a 1×2 table [rounded letter box | inserted image]. Group spacing vs.
box↔image spacing differ — expressed by nested `data-gap-x` at the two levels. Box is a nested
1×1 table with `data-corners` (rounded) + explicit perimeter edges (nested perimeters are
suppressed unless explicit). Image is a real image cell with an inserted (placeholder) picture.

## 10 — composite: title + 3-col block + double-bordered boxes

✅ ai-success (after fixes #1 align + #2 gap). One nested table: outer 1×2 → left cell stacks a
centered title above the ruled 3-column block (alignment: cols 1–2 `start`, col 3 default
center); right cell is the double-box stack (explicit double perimeter edges + `data-gap-y`).

## 95 — composite: title, box, divider, thick rule, two grids, caption rows

✅ ai-success (after fixes #1 + #2). One nested table, vertical stack of section rows:
(0) header = `[pad | title | "Y y" box]` so the title centers at page-center; (1) word block
(4 cols `[pad,word,word,pad]`) with a centered vertical divider that runs the word rows and
**joins the first horizontal rule**, plus a spacer row producing **two separated full-width
lines** (h-edges at the row-4 and row-5 boundaries); (2) two bordered grids (4×3 + 2×3); (3)
left-aligned caption rows sized to match the grids.
Revised per user feedback (`output/user-feedback.md`): title now sits over the divider, the
divider joins the upper line, and the two rules are separated by a spacer row. Header column
widths `[96,100,96]` and block divider position are both centered (=146px) so they coincide.

## Phase 2 — reproduced through the demo UI (all 7 ✅)

Each sample now has a `NN.recipe.ts` that builds it through the *real* toolbar (Playwright
interpreter in `ui/interpreter.ts`); `tests/e2e/ui-build.spec.ts` asserts the built table's
model deep-equals the validated `NN.html`. **All 7 pass** (`pnpm e2e ui-build`). Built-table
screenshots in `output/ui/NN.png`. Reference + how-to: `ui/DSL.md`.

To make every sample UI-buildable, four toolbar controls were added (matching existing section
styling), wired to model setters + `render()`:
- **Gap (X/Y)** inputs → `setGapX`/`setGapY` (`TableSection.tsx`).
- **Per-cell padding** input → `setCellPadding`, and **per-cell Corners** menu → `setCellCorners`
  (`CellSection.tsx`).
- **Fixed-dimension** inputs for column width / row height (`ColumnSection.tsx`,`RowSection.tsx`).
- Added a missing `<title>` to the border selector's bottom edge (`BorderSelector.tsx`) so it's
  selectable/testable like the others.

Findings from driving the real UI (see also the harness comments):
1. The 19 failing e2e UI tests are **stale `#example-container` selectors** (post grid→table
   rename), not the API. The new `demo/ui-harness.html` sidesteps the example flow.
2. **Tailwind `.table { display:table }` collided with bloom-table's `.table { display:grid }`.**
   ✅ **RESOLVED:** all page-content structural classes are now `bloom-`prefixed
   (`.bloom-table` / `.bloom-cell` / `.bloom-skip`), so Tailwind's `.table` utility no longer
   collides. (UI/editor classes — `table-menu`, `cell--selected`, `table--selected` — are
   intentionally left unprefixed; the prefix is only for what ends up in the saved book page.)
3. The table border control couples innerH+innerV; **vertical-only** interior rules are set
   per-cell instead. Nested tables default to `fill,fill`, so recipes set `hug` explicitly where
   the design wants content sizing.
4. Edge-overlay buttons sit over cells, so the interpreter focuses cells via `.focus()`.

## Library changes made this session (all tested; `pnpm test` green, `pnpm typecheck` clean)

- `src/table-renderer.ts`: wire `data-gap-x`/`-y` → CSS `column-gap`/`row-gap`; apply per-cell
  `data-corners`; apply per-cell `data-align` → `justify-content` + `text-align`.
- `src/table-model.ts`: add `CellAlign` + `getCellAlign`/`setCellAlign`; add
  `getCellPadding`/`setCellPadding` (`data-pad`).
- `src/table-renderer.ts`: apply per-cell `data-pad` as inline padding (absent => default).
- `src/components/CellSection.tsx`: add a "Text alignment" Left/Center/Right control.
- `src/table-renderer.test.ts`: tests for gap, per-cell corners, alignment, padding.

Per-cell **padding** added (user feedback on 95): a 4th systemic capability — cells were stuck
on the global `--cell-padding`, so text hugged interior dividers. `data-pad` overrides per cell
(e.g. word cells in 95 use `"6px 16px"` for divider breathing room). *(Follow-up: a toolbar
padding control, like the gap control, still TODO.)*

### Still-open follow-ups (not blocking any sample)
- No toolbar control to set **gaps/spacing** yet (the model+render wiring works; a button is
  needed for full user-reproducibility).
- Per-boundary (non-uniform) visual gaps aren't expressible via CSS grid gap — only uniform
  per-axis. Worked around with nested tables where two different gaps are needed (07).
- No vertical (cross-axis) cell alignment control; rows center content vertically.
