# 005: Test coverage that replaces manual testing

Written 2026-09-05 at commit `1962fcd` (branch `more-e2e-tests`). Status: TODO.

## Context

bloom-table is feature complete and ships inside Bloom next. The goal is that no release
needs a manual pass over the library. This plan records what the automated tests cover today,
where the gaps are, and the work that closes them. Bloom's own integration tests
(`src/BloomE2E/tests/tables-*.spec.ts` in the Bloom repository) cover the host side: page
round trips, subscription gating, audio in cells, publishing. This plan covers the library
only, and does not repeat those.

## 1. What runs today

| Suite | Files | Tests | Result at `1962fcd` | Time |
| --- | --- | --- | --- | --- |
| Unit (`pnpm test`, vitest + happy-dom) | 37 | 532 | 532 pass | 5.7 s |
| Playwright (`pnpm e2e`, chromium only) | 19 specs | 68 | 67 pass, 1 skipped | 46 s |
| Screenshot snapshots | 4 PNG files | | all match | |

Nothing runs either suite automatically. There is no `.github/workflows/` directory, no
coverage provider installed (`@vitest/coverage-v8` is absent, so the `coverage` block in
`vite.config.ts` is dead config), and no lint step. A release today depends on someone
remembering to run three commands.

### Coverage baseline

Measured by `pnpm test:coverage` over `src/**`, with the test files, `src/test-support/`
and the `.d.ts` files excluded. The demo and the e2e suite are outside `src/`, so
`coverage.include` names `src/**` rather than excluding them: an exclude pattern is matched
against the absolute path, and a checkout directory whose own name ends in `tests` makes
`tests/**` exclude the whole tree, which reports 0 of 0.

| Metric | Baseline | Threshold in `vite.config.ts` |
| --- | --- | --- |
| Statements | 83.52% (4431/5305) | 82 |
| Branches | 72.56% (2587/3565) | 71 |
| Functions | 81.89% (760/928) | 80 |
| Lines | 86.52% (4014/4639) | 85 |

After Phase 1, with 744 unit tests in 49 files:

| Metric | After Phase 1 | Threshold in `vite.config.ts` |
| --- | --- | --- |
| Statements | 84.42% (4479/5305) | 83 |
| Branches | 73.54% (2622/3565) | 72 |
| Functions | 83.51% (775/928) | 82 |
| Lines | 87.32% (4051/4639) | 86 |

After Phase 2, with 955 unit tests in 50 files:

| Metric | After Phase 2 | Threshold in `vite.config.ts` |
| --- | --- | --- |
| Statements | 87.23% (4628/5305) | 86 |
| Branches | 75.51% (2692/3565) | 74 |
| Functions | 87.71% (814/928) | 86 |
| Lines | 90.36% (4192/4639) | 89 |

After Phase 3, with 1028 unit tests in 54 files:

| Metric | After Phase 3 | Threshold in `vite.config.ts` |
| --- | --- | --- |
| Statements | 89.71% (4782/5330) | 88 |
| Branches | 78.84% (2828/3587) | 77 |
| Functions | 91.22% (852/934) | 90 |
| Lines | 92.87% (4327/4659) | 91 |

### Unit coverage by module

Well covered (behaviour tests with clear names, edge cases, undo):

- `structure.ts` (add, remove, move, duplicate, spans, edge-array alignment, nested
  hug-to-fill conversion, history detail)
- `history.ts` (per-table undo and redo, pruning on detach, caps, nested routing,
  reentrancy, re-attach of restored nested tables)
- `table-renderer.ts` (borders, gaps, corners, merged cells, nested perimeter, tie-breaks)
- `border-state.ts`, `edge-utils.ts`, `formatting-commands.ts` (scopes, last-write-wins,
  tri-state inheritance, copy and paste properties, history detail)
- `paint-format.ts`, `drag-to-resize.ts`, `current-table.ts`, `selection-highlight.ts`,
  `pulse-highlight.ts`, `cell-contents.ts`, `attach.ts`, `prepare-for-save.ts`,
  `text-editing.ts`, `ProximityDiv.ts`, `color-utils.ts`, `table-model.ts`
- `table-size-buttons.ts` host hooks: chrome gate, item filter, open handler, `openCellMenu`,
  the Cell menu as data, Delete Table, Copy and Cut Table, disabled Delete Row and Column
- `CellMenuItems.tsx`, `Slider.tsx`, `BorderControl/logic/*`, `demo/utils/actionJournal.ts`

Partly covered:

- `table-size-buttons.ts` (2384 lines, the largest module). Tested: reset and teardown,
  perimeter `+` buttons, pill open and close, Delete Row and Column, Add Row Below, merge and
  split from the context menu, one hover preview, one scroll reposition. Not tested: Move Row
  Up and Down, Move Column Left and Right, Duplicate Row and Column from the menu, the Size
  control (Grow, Hug, Fixed in mm, including the rounded label), the two gap sliders, the
  Add preview geometry for all four positions, anchor positioning of the pills, the menu's
  own position at a pill and at a point, and every menu action performed on a nested table.
- `TableMenu.tsx` (484 lines) has 6 tests. `RowSection.tsx`, `ColumnSection.tsx` and
  `CellSection.tsx` (623 lines together) have none of their own.
- `BorderControl.tsx` has 2 tests. `BorderSelector.tsx` (329 lines) and `BorderMenu.tsx`
  (157 lines) are exercised only by two e2e specs.
- `drag-to-resize.ts` has good unit tests. The e2e side is one column-undo spec plus a
  weak row spec (see the Playwright section).

Not covered at all:

- `menu-widgets.ts` (520 lines): every DOM widget of the pill menus, including the slider
  row, the colour pair row, the toggles and the sample swatches.
- `TableApiContext.tsx`: `defaultTableApi` and the injection Bloom uses to run operations in
  the page frame's realm. This is the path Bloom's toolbox depends on.
- `ColorPickerContext.tsx`: `DefaultColorPicker` and the injected picker Bloom supplies.
- `RadioGroup.tsx`, `IconButton.tsx`, `useClearPulseOnUnmount.ts`.
- `grid.ts` (`buildGrid`, `cellsOf`), `edge-entries.ts`, `operation-detail.ts`,
  `structural-chrome.ts`, `cell-menu-host.ts` as units (they are reached only through
  other modules' tests).
- `migrate.ts`.
- The three stylesheets, except the one test that checks `--edge-default-*` against
  `EDGE_DEFAULT`.
- The built package. Nothing imports `dist/` and attaches a table.

### Playwright coverage

Strong specs: `nested-tables`, `pill-target-preview`, `paint-format`, `menu-scroll`,
`menu-drag`, `debug-info-snapshot`, `table-menu`, `embedded-tables`, `ui-build` (7 sample
tables built through the real toolbar and compared to validated HTML).

Weak or misleading specs:

- `resize-rows-and-columns.spec.ts`: 26 `console.log` calls. The first test asserts only
  that the table is a grid. The third passes whether or not the drag works. The fourth,
  "documents the drag resize fix implementation", asserts on a literal object and tests
  nothing. The undo test is `test.skip` with the comment "we don't support undoing resize",
  which is no longer true: `drag-to-resize.test.ts` and `undo-resize-column.spec.ts` both
  prove undo works.
- `borders-changing.spec.ts`: both titles end in "(BUG)" and the header comment says the
  spec "intentionally fails". Both tests pass. The titles now mislead.
- `table-menu.spec.ts`: 26 `waitForTimeout` calls. It passes, but each fixed wait is a
  future flake.
- `table-border-visual.spec.ts`: sound assertions, plus 3 debug logs.

Flows that no e2e spec drives with a real pointer or keyboard:

- A row drag and a column drag with `page.mouse`, then undo, on a top-level table and on a
  nested table. A double-click on an edge to return a track to hug.
- The right-click Cell menu end to end: open, change content type to image, to table, to
  video, and back to text; merge and split; Format rows; close on Escape and on outside click.
- The Row, Column and Table pill menus item by item: Move, Duplicate, Size (Grow, Hug,
  Fixed), gaps, Copy Table, Cut Table, Paste properties.
- Typing into a cell, Enter making one paragraph, Shift+Enter, then save and reload.
- A save round trip: edit, run `removeTableEditingArtifacts`, re-attach the saved HTML, and
  compare the rendered model with the pre-save model.
- The table inside a scrolling container: pills and edge overlays follow a scroll of the
  container and of the window.
- The React `TableMenu` with an injected `tableApi` and an injected `colorPicker`.
- A window resize while a menu is open.
- Three levels of nesting.
- A `hug` row growing as text is typed into a cell, and shrinking when the text is deleted.
  A row with a fixed height keeping that height when its content overflows. Bloom's Change
  Layout tables depend on the first, and its canvas-page tables on the second. No test here
  pins either. (Plan 004, item 2.)
- A table whose container is made narrower. Plan 004, item 1, records this as a bug: px
  column widths keep their size and the right column is clipped. The e2e test for it waits on
  the width rule that plan decides.

## 2. The plan

Work in the order below. Each phase is one branch and one `/preflight`. Phase 0 comes
first, because every later phase is only worth doing when something runs it.

### Phase 0: a gate that runs by itself

1. Add `.github/workflows/ci.yml`: on push and pull request, run `pnpm install`,
   `pnpm typecheck`, `pnpm test`, `npx playwright install --with-deps chromium` and
   `pnpm e2e`. Upload `playwright-report/` and `test-results/` as artifacts on failure.
   Snapshots are `-win32` today; commit `-linux` snapshots on the first CI run, or set
   `snapshotPathTemplate` so one file serves both, and keep `maxDiffPixelRatio` at 0.03.
2. Install `@vitest/coverage-v8`. Add `pnpm test:coverage`. Record the baseline in this
   file. Set `coverage.thresholds` at the baseline minus 1 point so it can only rise, and
   raise it at the end of each phase.
3. Add a Playwright fixture in `tests/e2e/utils/` that fails a test on any `pageerror` or
   `console.error`. Every spec uses it. This turns a silent exception into a red test.
4. Repair the misleading specs: delete the "documents the fix" test, replace the two
   log-only resize tests with one real row drag (see Phase 4), un-skip and fix the undo test,
   drop "(BUG)" from `borders-changing.spec.ts` and its header comment, and remove the
   `console.log` calls. Replace the `waitForTimeout` calls in `table-menu.spec.ts` with
   `expect.poll` or a locator wait.
5. Set `retries: 1` locally as well, so a flake is reported as flaky instead of as a failure.

### Phase 1: unit tests for the modules with none

Put each test beside its module, in the style of the existing files (one behaviour per `it`,
sentence titles).

- `menu-widgets.test.ts`: `makeSliderRow` emits on input and shows the unit; the colour
  pair row calls each `onInput` with a hex value and shows the current value; toggles
  reflect `setToggleActive`; `makeBorderStyleToggle`, `makeBorderWeightToggle` and
  `makeCornerToggle` render the sample they claim; `makeMenuItem` disabled state.
- `TableApiContext.test.tsx`: `defaultTableApi` maps every method to the `structure` and
  `formatting-commands` function it wraps; a `TableMenu` given a stub `tableApi` calls the
  stub and never the default (this is Bloom's cross-realm path).
- `ColorPickerContext.test.tsx`: `DefaultColorPicker` round-trips a value; a `TableMenu`
  given an injected picker renders it in place of the default and receives its `onChange`.
- `RadioGroup.test.tsx`, `IconButton.test.tsx`, `useClearPulseOnUnmount.test.tsx`.
- `grid.test.ts`: `buildGrid` on a table with spans, skips and a nested table; the cover
  map; `cellsOf` returns only the table's own cells, not a nested table's.
- `edge-entries.test.ts`: `entryAtH`, `entryAtV`, `splitH`, `splitV`, `hasPositiveGap`
  on shorthand, sided and concise interior-only arrays.
- `operation-detail.test.ts`, `structural-chrome.test.ts`, `cell-menu-host.test.ts`,
  `migrate.test.ts`: small, one file each.

### Phase 2: every menu item, once, as a table

Add `table-size-buttons.menu-items.test.ts`. One data table lists each item of the Row,
Column and Table pill menus with: the label, the fixture, the expected model change, the
disabled condition. One `it.each` opens the pill, clicks the item, asserts the change,
asserts the history has one new entry, undoes, and asserts the original model. Then run
the same table on a nested-table fixture, where the change must land on the nested table
and the outer table must be unchanged. This covers Move, Duplicate, Size, gaps, Copy and
Cut and Paste properties in one pass. It stays complete when an item is added, because an
item missing from the data table fails a count assertion against the rendered popup.

Add to `table-size-buttons.test.ts`: the Add preview box for above, below, left and right;
pill anchor positions against `getBoundingClientRect` of the selected cell; menu position at
a point that would overflow the viewport.

### Phase 3: the React panel

- `RowSection.test.tsx`, `ColumnSection.test.tsx`, `CellSection.test.tsx`: each button
  calls the right `TableApi` method with the selected cell's indices; disabled states at
  the first and last row or column; the Size control shows the current mode.
- `BorderSelector.test.tsx`: clicking an outer edge toggles it; clicking the inner plus
  toggles both inner axes; the selection drives which edges `BorderControl` writes; mixed
  state shows no value. Move the two existing e2e checks in `cell-borders-ui.spec.ts` and
  `borders-changing.spec.ts` to unit level where they only read a title attribute, and keep
  in e2e only the part that needs computed CSS.
- `TableMenu.test.tsx`: add hide and show on focus change, and the undo and redo buttons
  tracking `canUndo` and `canRedo` for the selected table only.

### Phase 4: Playwright flows that need a real browser

New specs, each on the harness with a fixture, each taking library objects from
`window.bloomTableTestHooks`:

- `drag-resize.spec.ts`: row drag, column drag, undo of each, double-click to hug, on the
  top-level and on a nested table. Replaces the weak tests in
  `resize-rows-and-columns.spec.ts`, which is then deleted.
- `cell-menu.spec.ts`: right-click flow through every content type and back, merge and
  split, Format rows, Escape and outside click, and the menu on a nested cell.
- `pill-menus.spec.ts`: one real click on every Row, Column and Table item; asserts the
  model and one undo step. Phase 2 covers the logic in happy-dom; this proves the popup
  is clickable where it renders.
- `save-round-trip.spec.ts`: build a table through the UI, type text, run
  `removeTableEditingArtifacts`, reload the harness with the saved HTML as the fixture,
  and assert `extractTableModelInPage` is equal before and after. Also assert the saved
  HTML has no edit-time class, no anchor name, no overlay and no `<style>` the library
  injected.
- `text-editing.spec.ts`: type, Enter, Shift+Enter, in a top-level cell and a nested cell.
- `scroll-container.spec.ts`: the table inside an `overflow: auto` div; scroll the div and
  the window; pills and edge overlays stay on their cells.
- `host-injection.spec.ts`: a harness page variant that mounts `TableMenu` with a stub
  `tableApi` and a stub `colorPicker`, and proves each is used.
- `row-growth.spec.ts`: on a fixture with one `hug` row and one `40px` row, type five
  lines into a cell of each. Assert the `hug` row's rendered height grew and the table's
  height grew with it; assert the fixed row kept its height. Delete the text and assert the
  `hug` row shrank back. Repeat on a nested table, where the host cell must grow too. This
  needs a real layout engine, so it is e2e and not happy-dom.
- `container-narrowing.spec.ts`: drag a column boundary so the widths become px, then
  shrink the host element with `element.style.width` and assert every cell still tiles the
  grid and the table's bounding box stays inside the host. Write this test after plan 004
  fixes the bug and states the width rule; until then mark it `test.fixme` with the plan's
  name in the reason, so the gap is visible in every report.
- Visual snapshots: one `toHaveScreenshot` per sample in `tests/samples/*.html` and per
  fixture in `tests/e2e/fixtures/`, rendered through `_harness.html` in read state at a
  fixed viewport. This is the regression net for `table-renderer.ts` and the CSS, which
  unit tests cannot see.

### Phase 5: the package as Bloom receives it

`tests/package/dist-smoke.test.ts`, run after `pnpm build` in CI: import
`dist/bloom-table.mjs`, attach a table, add a row, undo, and check the three CSS files
exist. Assert the bundle does not contain a copy of React or MUI (peer dependencies must
stay external). Snapshot the list of exported names from `dist/bloom-table.d.mts`, so a
removed export fails the build.

### Phase 6 (optional): invariants under random operation sequences

Add `fast-check`. One property test applies 1 to 30 random structural operations to a
random table and after each step asserts: cell count equals rows times columns, every
non-skip cell has a span that stays inside the grid, `data-edges-h` is (R+1) by C and
`data-edges-v` is R by (C+1) after `ensureEdgesArrays`, and undoing every step restores the
original HTML. This finds the interaction bugs that hand-written cases miss.

## 3. Verification

After each phase:

```
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm e2e
```

CI must be green on the pull request. Record the new coverage figure in this file.

## 4. Related work not in this plan

Plan 004 (`plans/004-refit-on-container-resize-and-row-growth.md`, filed 2026-09-05 from an
audit of the BL-16818 manual test plan) owns the container-narrowing fix and the width rule.
This plan only adds the tests that pin the result, in Phase 4. Do not run plan 004 and
Phase 4 of this plan on the same tree at the same time; both add specs beside
`resize-rows-and-columns.spec.ts`.

The same audit found six checks that only BloomDesktop can exercise: page round trip, the
Change Layout row mode, no selection markup after closing Bloom with a cell selected, audio
in a cell above and below Pro, language tag and format gear below Pro, and ePUB output. Those
belong to Bloom's `src/BloomE2E` suite and are not part of this repository's work.

## 5. Open debt

Linux screenshot baselines are still to be captured. Every file in a `*-snapshots/` directory
is `-chromium-win32`, and this machine cannot render the Linux equivalents, so
`playwright.config.ts` sets `ignoreSnapshots` when `CI` is set and the CI run compares no
screenshots at all. Take the images from a CI run's `playwright-report` artifact, commit them
as `-chromium-linux`, and delete `ignoreSnapshots`.
