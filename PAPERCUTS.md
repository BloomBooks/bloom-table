# Papercuts

Small friction points in developing this repo. See the `papercut` skill for the
convention.

Note: when resolving a git merge conflict here, keep both sides' entries unless they merge cleanly.

---

## 2026-09-16 — A hand-authored span needs `bloom-skip` on the cell it covers

- **Cut:** `data-span-x="2"` alone renders as a shifted table. Nothing adds `bloom-skip` at
  attach or render time — only `setSpan`/merge does — and `table-renderer.ts` maps cell index
  to position as `r * cols + c`, so an unmarked covered cell takes a slot and every later cell
  moves one place. The table still renders, so it reads as a sizing mistake.
- **Idea:** either have `attachTable` derive `bloom-skip` from the spans it reads, or say in
  `tests/samples/README.md` and `design/model.md` that a covered cell is authored as
  `class="bloom-cell bloom-skip"`. The README lists `data-span-x` as author-level and says only
  that the covered cell stays in the DOM.
- **Context:** hit while writing `demo/exercises/primer-lesson-story.html`, which has three spans.

## 2026-09-16 — A cell that holds a nested table has no padding, and passes that on

`.bloom-cell[data-content-type="table"]` sets `--this-padding: 0`, and the nested table itself
is `position: absolute; inset: 0; width: 100%; height: 100%`. Two separate cuts follow, and
both show up as text and pictures jammed against the line drawn around them.

- **Cut (the host cell):** nothing can hold the nested table off the border drawn around it.
  `data-pad` on the host cell cannot, because an absolutely positioned child's containing block
  is the padding box. It takes an inline `style="inset: 10px; width: auto; height: auto"` on the
  nested table, and both of the sizes have to go to `auto` or the table keeps its full width and
  spills out to the right, where the cell clips it.
- **Cut (every cell inside):** `--this-padding` is a custom property, so `0` inherits from the
  host cell into the whole nested table, and every cell in it loses its padding. So a nested
  table needs `style="--this-padding: 8px 10px"` — the stylesheet's own value, written out
  again — before any of its cells has padding at all.
- **Idea:** give the host cell's own padding its usual meaning by deriving the nested table's
  `inset` from `data-pad`, and stop the cell's zero reaching its descendants (set `padding: 0`
  on the cell directly, or re-set `--this-padding` on the nested table in CSS).
- **Context:** every one of the four nested tables in
  `demo/exercises/primer-lesson-story.html` carries both workarounds.
