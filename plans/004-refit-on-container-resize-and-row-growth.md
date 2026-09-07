# 004 — Re-fit a table when its container narrows, and lock in row growth

Priority P2 · Effort M · Depends on: none

Source: an audit of the manual test plan on BL-16818
(https://issues.bloomlibrary.org/youtrack/issue/BL-16818) against both this repo's tests and
BloomDesktop's e2e suite. Two behaviours belong to this library but are currently watched only
from inside BloomDesktop, where a check costs about two minutes of running the whole app.

## Item 1 — a table does not re-fit when its container is made narrower (bug) — DONE

**What happens.** Cells keep the widths they had before the container changed, so they overflow
the table's own box and the right-hand column is clipped by the edge of the container. Measured
in BloomDesktop: a two-column table 132 px wide sitting in a table box that had been left 127 px
wide. Nothing re-fits the table to the space it has.

**How it is seen today.** BloomDesktop's `src/BloomE2E/tests/tables-extended.spec.ts` carries a
`test.fixme("re-fits the table to a section that has been made narrower")`, reached by splitting a
Change Layout section in two so the table's half gets narrower. That test asserts only
`expectCellsTile(page)` — that every cell still tiles the grid. It is marked `fixme` rather than
weakened because a table that does not fit its section is what a person actually sees.

**Why it belongs here.** Nothing in that scenario is Bloom-specific. The trigger is "the element
hosting the table got smaller"; the response — re-fitting column widths to the available space —
is this library's layout logic. Bloom only supplies the resize.

**What to do.**

- Reproduce it in the demo: render a table with resolved px column widths (drag a boundary, which
  is what turns `fill` into a px measure), then shrink the host element and assert the cells still
  tile and the table's content box does not exceed its container.
- Decide and document the intended rule. The open question is which widths are authoritative when
  space is removed: proportionally scale the px widths back down, or fall back to `fill` past some
  threshold. `data-column-widths` already distinguishes `fill` / `hug` / `fit` / a px measure
  (`src/structure.ts`, `src/table-renderer.ts`), so the rule should be stated in terms of those.
- Cover it at both levels: a unit test over the width-resolution code, and a Playwright test in
  `tests/e2e/` that shrinks the host and asserts the tiling, alongside
  `resize-rows-and-columns.spec.ts`.
- **STOP** and ask the maintainer before changing the resolution rule if the fix would alter what
  a *widening* container does — `tables-extended.spec.ts` has a passing test ("re-tiles the cells
  when the whole table is made wider") that must keep passing.

### What was done

The rule chosen, on the maintainer's behalf, is **scale the pixel widths down proportionally**:
a column given a width in pixels keeps that width while it fits, and past that every pixel column
shrinks by the same proportion, so the ratios a person set by dragging boundaries survive. The
alternative considered and rejected was falling back to `fill`, which throws those widths away.

A second cause turned up alongside it, and was the one BloomDesktop's `fixme` actually hit: a
`fill` or `hug` column carries a floor of `MIN_COLUMN_WIDTH` (60px), so N of them need N*60px
however little the table has. That floor now drops to an equal share of the table's own width when
60px each will not fit. Nested tables are unchanged: they already take a zero floor, because the
host cell owns the space.

Both rules are written into the grid template as CSS `min()` against the table's own width
(`buildColumnTemplate` in `src/table-renderer.ts`), so a table re-fits whenever its container
changes with nothing to observe and nothing to recompute. Widening is untouched: while the space
is there, every track resolves to exactly what it did before.

Covered by three cases in `src/table-renderer.test.ts` and by
`tests/e2e/refit-when-host-narrows.spec.ts` with the `narrow-host` fixture. The STOP condition
holds: BloomDesktop's "re-tiles the cells when the whole table is made wider" still passes.

## Item 2 — a row grows to fit the text typed into it (missing coverage)

**What is missing.** No test in this repo asserts that a row whose height is `hug` grows as its
cell's content grows. The behaviour is presumably there; nothing pins it.

**How it is seen today.** BloomDesktop's manual test plan asks a person to check it, in the
Change Layout case ("a table fills that section, and its rows grow to fit what you type").
BloomDesktop covers only the opposite case, on a canvas page, where the table must *not* grow
("marks text that does not fit a cell, without growing the table" — the cell shows an overflow
marker instead).

**Why it splits across the two repos.** The growth mechanic is this library's: a `hug` row
resizing to its content. Which mode a table is in — `hug` rows in a Change Layout section, fixed
rows on a canvas page — is BloomDesktop's wiring, and is being covered separately in the
BloomDesktop e2e suite.

**What to do.**

- Add tests for row growth as content grows and shrinks again, with the height modes named
  explicitly, so the contract BloomDesktop relies on is written down here.
- Include the negative: a row that is *not* `hug` keeps its height when its cell's content
  overflows.

## Notes

- Everything else on the BL-16818 manual list that touches this library — merging and splitting
  cells, fill and border colours, alignment and padding, the row/column menu command set,
  entering and leaving a nested table, undo, drag-to-resize — is already covered here and has
  been struck from that manual list on the strength of these tests.
- The remaining BL-16818 gaps are genuine BloomDesktop seams (Talking Book audio in a cell, ePUB
  output, the subscription gate, page navigation, the app's shutdown path) and are being added to
  BloomDesktop's e2e suite, not here.
