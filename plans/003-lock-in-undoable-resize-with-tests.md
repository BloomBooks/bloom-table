# Plan 003: Lock in undoable row/column resize with tests, and un-skip the e2e

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a6732ed..HEAD -- src/drag-to-resize.ts src/history.ts tests/e2e/resize-rows-and-columns.spec.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (mostly adding tests; one stale comment / skip removal)
- **Depends on**: none (independent of 001 and 002)
- **Category**: tests + correctness (verification of existing behavior)
- **Planned at**: commit `a6732ed`, 2026-06-12

## Why this matters

Undo for row/column resize **is already implemented** — `handleGlobalMouseUp`
calls `commitResizeOperation`, which registers a `tableHistoryManager` entry with
a custom `undoOperation` that restores the pre-drag width/height
(`src/drag-to-resize.ts:217-336`). But the only test that would cover it,
`tests/e2e/resize-rows-and-columns.spec.ts:339`, is `test.skip(...)` with the
now-false comment "for now we don't support undoing resize operations." So a
working feature is both untested and documented as missing. There are also
**zero unit tests** for `drag-to-resize.ts` (785 lines, high churn, the file the
latest commit calls "still broken") — its undo logic, unit conversions, and
attach/detach lifecycle are unverified.

After this plan: unit tests assert that a resize commits exactly one history
entry and that undo restores the original column width and row height; the
e2e test is either un-skipped (if it passes against the real app) or replaced by
a reliable equivalent; and the stale comment is corrected. If undo turns out to
be genuinely broken in some case, the tests surface it (TDD-style) rather than
hiding it behind a skip.

## Current state

### Resize undo is wired up

`src/drag-to-resize.ts:217-232` — mouseup commits through history:

```ts
private handleGlobalMouseUp = (): void => {
  if (this.dragState.isDragging && this.dragState.hasStartedOperation) {
    this.commitResizeOperation();
  }
  // ... clears data-ui-active-row-index, resetDragState, cursor ...
};
```

`src/drag-to-resize.ts:233-336` — `commitResizeOperation` builds a description,
a `performOperation`, and a custom `undoOperation`, then calls
`tableHistoryManager.addHistoryEntry(grid, description, performOperation, undoOperation)`.
For a **column** the undo closure restores `data-column-widths[index]` to
`capturedOriginalValue`; for a **row** it restores `data-row-heights[index]` to
`capturedOriginalValue`. `capturedOriginalValue` is captured from
`this.dragState.originalValue`, which is set at mousedown from
`resizeInfo.currentValue` (`src/drag-to-resize.ts:145-162`) — i.e. the value
_before_ the drag. The row `performOperation` is intentionally a no-op because
the height was already written during the live preview
(`updateRowHeightPreview`, `src/drag-to-resize.ts:376-428`).

> Subtlety worth knowing (do not "fix" it — it's correct): the history entry's
> generic `state` snapshot is captured _inside_ `addHistoryEntry` (history.ts:68),
> which runs after the preview already mutated the grid. Undo does NOT rely on
> that snapshot here — it uses the per-entry `undoOperation` closure, which
> restores `capturedOriginalValue`. So undo restoring the _original_ (pre-drag)
> size depends on the closure, and that's what the tests must assert.

`src/history.ts:43-103` — `addHistoryEntry(grid, description, performOperation, undoOperation?)`
runs `performOperation`, pushes an entry, and dispatches `gridHistoryUpdated`.
`src/history.ts:104-153` — `undo(grid)` pops the last entry and runs its
`undoOperation(topLevelGrid, entry.state)`. `reset()` exists for tests
(`src/history.ts:20-24`).

### The skipped, stale-commented e2e test

`tests/e2e/resize-rows-and-columns.spec.ts:338-339`:

```ts
// for now we don't support undoing resize operations
test.skip("reverts row height on undo", async ({ page }) => {
  await page.goto("/demo/exercises/new-table.html");
  await page.waitForSelector(".grid");
  await attachTablesToPage(page);
  const grid = page.locator("#main-grid");
  // ... performs a drag, then expects undo to revert row height ...
```

E2E note: `playwright.config.ts` has **no `webServer`**, so e2e requires a
manually started dev server (`pnpm dev`, port 5173). Do not assume CI can run
it. This plan's primary deliverable is the **unit** coverage; the e2e change is
secondary and gated (see Step 3).

### Test conventions

- vitest globals + happy-dom (`vitest.config.ts`). Unit tests in `src/*.test.ts`.
- Closest exemplar for driving resize via synthetic mouse events and asserting a
  single history entry: `src/table-corner-handle.test.ts` (uses `attachTable`,
  dispatches `mousedown`/`mousemove`/`mouseup`, checks history). Reuse its
  `dispatchMouse` helper and `beforeEach` reset.
- The resize handlers read element geometry (`getBoundingClientRect`,
  `getComputedStyle` for `gridTemplateColumns/Rows`). happy-dom returns zeros
  for layout, so unit tests must **mock geometry** like
  `ProximityDiv.test.ts:5-18` does (`mockRect`) and/or drive the public data
  attributes directly. Prefer asserting on `data-column-widths` /
  `data-row-heights` and history behavior rather than pixel math.

## Commands you will need

| Purpose       | Command                                       | Expected on success           |
| ------------- | --------------------------------------------- | ----------------------------- |
| Typecheck     | `pnpm typecheck`                              | exit 0                        |
| Unit tests    | `pnpm test`                                   | all pass (≥110)               |
| One unit file | `pnpm exec vitest run src/drag-to-resize.test.ts`  | the new file passes           |
| Dev server    | `pnpm dev` (port 5173, background terminal)   | serves demo                   |
| E2E (gated)   | `npx playwright test resize-rows-and-columns` | passes against running server |

## Scope

**In scope** (the only files you should modify/create):

- `src/drag-to-resize.test.ts` (create — first unit tests for the module)
- `tests/e2e/resize-rows-and-columns.spec.ts` (un-skip / fix the one test, and
  correct the stale comment) — **only** if Step 3's gate passes
- `src/drag-to-resize.ts` — **only** if a test proves a real bug; otherwise do
  not modify it (this plan assumes the logic is correct and is locking it in)

**Out of scope** (do NOT touch):

- `src/history.ts` — the history manager is shared and correct; do not modify.
- `src/table-size-buttons.ts` corner-drag resize (a different code path with its
  own test, `table-corner-handle.test.ts`).
- Adding _redo_ — not part of the current design; out of scope.
- The unit-conversion constants/format (`PX_TO_MM`, `formatMm`) — you may _test_
  them but do not change them.

## Git workflow

- Branch: `advisor/003-lock-in-undoable-resize-with-tests`
- Commit per logical unit (unit tests; e2e un-skip; any bugfix separately).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write unit tests for resize commit + undo (column and row)

Create `src/drag-to-resize.test.ts`, modeled on `src/table-corner-handle.test.ts`
(import `attachTable`/`detachTable` from `./attach`, `tableHistoryManager` from
`./history`; `beforeEach` resets history and `document.body.innerHTML`). Use a
`dispatchMouse` helper like the one in `table-corner-handle.test.ts:6-9`.

Because happy-dom has no layout, the robust approach is:

1. Build a grid with explicit pixel widths/heights so the data attributes are
   the source of truth, e.g.
   `data-column-widths="100px,100px" data-row-heights="20px,20px"`.
2. `attachTable(grid)` (this calls `dragToResize.attach`).
3. Drive a resize by dispatching `mousedown` on the resize edge, then
   `mousemove` past the 3px threshold (`hasStartedOperation` flips at
   `src/drag-to-resize.ts:183`), then `mouseup`.
4. To make the edge-detection deterministic without real layout, mock the
   relevant element geometry (follow `ProximityDiv.test.ts:5-18`'s `mockRect`)
   OR, if edge detection proves too layout-dependent in happy-dom, drive the
   commit path more directly by setting up `dragState` through the public flow
   you _can_ trigger and asserting on outcomes. If neither yields a stable test,
   see the STOP condition about happy-dom geometry.

Write these test cases:

- **"commits exactly one history entry on column resize"**: after the drag,
  `tableHistoryManager.canUndo()` is `true` and the last label
  (`getLastOperationLabel()`) matches `/Resize Column/`.
- **"undo restores the original column width"**: capture
  `data-column-widths` before the drag; after drag the target column differs;
  after `tableHistoryManager.undo(grid)` the target column equals the original
  value. (This directly exercises the `undoOperation` closure at
  `src/drag-to-resize.ts:282-297`.)
- **"undo restores the original row height"**: same shape for
  `data-row-heights` and the row undo closure
  (`src/drag-to-resize.ts:311-323`). This is the unit-level mirror of the
  skipped e2e.
- **"a click without movement commits no history entry"**: `mousedown` then
  `mouseup` with <3px movement leaves `canUndo()` false (guards the
  `hasStartedOperation` threshold).

Also add focused tests for the pure helpers if you expose them or test them
indirectly:

- Resizing a row stores the height in mm (`formatMm`) — assert the committed
  `data-row-heights` entry matches `/\d+\.\d+mm/`.

**Verify**: `pnpm exec vitest run src/drag-to-resize.test.ts` → all new tests pass.
If the "undo restores original" tests FAIL, you have found a real bug — do NOT
delete or weaken the test. Capture the failure and go to Step 2.

### Step 2: Only if a test exposed a real undo bug — fix it (else skip)

If and only if Step 1 proved undo does not restore the original size:

- The likely culprit is `capturedOriginalValue` not reflecting the pre-drag
  value, or the row/column index off by the array length. Read
  `src/drag-to-resize.ts:250-336` and the mousedown capture at lines 145-162.
- Make the minimal fix so the undo closure restores the pre-drag value. Keep the
  test from Step 1 as the regression guard.

If Step 1 passed (the expected case), do nothing here and record "undo verified
correct; no code change needed" in your report.

**Verify**: `pnpm test` → all pass.

### Step 3: Un-skip the e2e test (gated on a running dev server)

This step requires the demo dev server. If you cannot start it in this
environment, SKIP this step, leave the e2e as-is, and note it in your report —
the unit tests from Step 1 are the binding coverage.

If you can run it:

1. Start the server in a background terminal: `pnpm dev` (serves on
   `http://localhost:5173`; confirm with a request to
   `http://localhost:5173/demo/exercises/new-table.html`).
2. In `tests/e2e/resize-rows-and-columns.spec.ts`, change `test.skip(` to
   `test(` for "reverts row height on undo" and delete the stale comment
   `// for now we don't support undoing resize operations` (line 338).
3. Run `npx playwright test resize-rows-and-columns`.
   - If it passes: keep the un-skip. Done.
   - If it fails because the test body's drag coordinates / undo trigger are out
     of date (the test was written long ago), and the unit tests in Step 1
     already prove undo works, then: either repair the e2e body to perform a
     valid drag + trigger undo (matching how undo is invoked in the app — find
     it via `grep -rn "tableHistoryManager.undo\|\.undo(" src demo`), or, if the
     repair balloons in scope, revert the un-skip, leave a corrected comment
     ("undo for resize is covered by src/drag-to-resize.test.ts; this e2e is
     pending a reliable drag harness"), and report. Do NOT leave a failing,
     un-skipped e2e committed.

**Verify**: `npx playwright test resize-rows-and-columns` → passes, OR the test
remains skipped with a corrected comment and a note in your report.

### Step 4: Correct the stale comment regardless of Step 3 outcome

If Step 3 was skipped (no server), still fix the misleading comment at
`tests/e2e/resize-rows-and-columns.spec.ts:338`. Replace
`// for now we don't support undoing resize operations` with
`// undo for resize is implemented (see commitResizeOperation in src/drag-to-resize.ts)
// and unit-tested in src/drag-to-resize.test.ts; this e2e is <skipped pending a
// reliable drag harness | enabled>.` Match the wording to the actual final state.

**Verify**: `pnpm typecheck` → exit 0 (the spec file is typechecked? confirm
with `pnpm typecheck`; if e2e specs are excluded from the tsconfig, this is a
no-op and that's fine).

## Test plan

- New `src/drag-to-resize.test.ts`: one-entry commit on column resize; undo
  restores original column width; undo restores original row height; no-op click
  commits nothing; row height stored in mm. Patterned on
  `src/table-corner-handle.test.ts` (+`mockRect` from `ProximityDiv.test.ts`).
- E2E `tests/e2e/resize-rows-and-columns.spec.ts`: the "reverts row height on
  undo" test un-skipped and passing, OR skipped with a corrected, accurate
  comment.
- Verification: `pnpm test` → all pass (report count delta from 110);
  `npx playwright test resize-rows-and-columns` → pass (if server available).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; `src/drag-to-resize.test.ts` exists with ≥4 passing
      tests including "undo restores the original column width" and "undo
      restores the original row height"
- [ ] The stale comment at `tests/e2e/resize-rows-and-columns.spec.ts:338` no
      longer claims resize undo is unsupported
      (`grep -n "we don't support undoing resize" tests/e2e/resize-rows-and-columns.spec.ts`
      returns nothing)
- [ ] If the dev server was available: the e2e test is un-skipped and
      `npx playwright test resize-rows-and-columns` passes
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `src/drag-to-resize.ts`, `src/history.ts`, or the e2e
  spec changed since `a6732ed` and the excerpts no longer match.
- happy-dom's lack of layout makes it impossible to drive the resize edge
  detection reliably AND no stable alternative path produces the
  `commit`/`undo` flow. Report this with what you tried; the fallback is to keep
  the e2e (Step 3) as the coverage and document the unit-test limitation.
- Step 1's undo tests fail AND the fix in Step 2 appears to require changing
  `src/history.ts` or touching the corner-drag path (both out of scope) — report
  the root cause instead of expanding scope.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The row `performOperation` is deliberately a no-op (the preview already wrote
  the height); undo correctness rests entirely on the `undoOperation` closure
  capturing the pre-drag value. A reviewer changing the preview/commit split must
  re-run `src/drag-to-resize.test.ts`.
- If _redo_ is added later, these tests need companions for the redo direction,
  and `history.ts` would need a redo stack (currently absent).
- The e2e suite has no `webServer` in `playwright.config.ts`; if a future plan
  adds one (so CI can run e2e unattended), the un-skipped test here becomes a
  CI gate — make sure the demo route `/demo/exercises/new-table.html` stays valid.
- Reviewer should scrutinize: that no production code was changed unless a test
  proved a bug (this is a lock-in plan), and that the e2e is never left failing
  and un-skipped.
