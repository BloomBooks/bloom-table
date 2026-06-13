# UI recipe DSL

A **recipe** is a list of commands describing the user actions that build a sample through the
demo's toolbar UI. The [interpreter](./interpreter.ts) replays each command against the
[editor harness](../../../demo/ui-harness.html) by clicking the *real* toolbar controls; the
[ui-build spec](../../e2e/ui-build.spec.ts) then checks that the built table's model matches the
validated `NN.html`.

## Where recipes live

`tests/samples/NN.recipe.ts`, beside the sample's other artifacts:
- `NN.png` — the target design (input)
- `NN.html` — the validated HTML (Phase 1; the oracle compares against this)
- `NN.recipe.ts` — the UI build script (this DSL)

A recipe default-exports a `Command[]`, built from the constructor functions in
[`dsl.ts`](./dsl.ts):

```ts
import { selectCell, insertColumnRight, cellBorders, align, type } from "./ui/dsl";
const recipe = [
  selectCell(0, 0),
  insertColumnRight(),
  cellBorders(0, 0, ["right"], "solid", 1),
  align(0, 0, "start"),
  type(0, 0, "sinini"),
];
export default recipe;
```

## Running

```
pnpm dev                                   # the harness needs the dev server
pnpm e2e ui-build                          # run all UI-build samples
pnpm e2e ui-build -g "sample 02"           # one sample
```
Each run writes a clean screenshot of the built table to `tests/samples/output/ui/NN.png`.

## Cell addressing & nesting

Cells are addressed by `(row, col)`, zero-based, within the **current table**. The current
table starts as the outer table. `enter(r, c)` descends into the nested table inside cell
`(r, c)` (that cell must already be content-type `table`); `up()` returns to the parent. All
subsequent commands target the current table until you `enter`/`up` again.

## Commands

### Selection / nesting
| Command | UI action |
|---|---|
| `selectCell(r, c)` | Focus the cell so the toolbar targets it. |
| `enter(r, c)` | Make the nested table in cell `(r,c)` the current table. |
| `up()` | Return to the parent table. |

### Structure
| Command | UI action |
|---|---|
| `insertColumnLeft()` / `insertColumnRight()` | Column section → Insert Column Left/Right (relative to the focused cell). |
| `insertRowAbove()` / `insertRowBelow()` | Row section → Insert Row Above/Below. |
| `deleteColumn()` / `deleteRow()` | Column/Row section → Delete. |

### Sizing
| Command | UI action |
|---|---|
| `columnSize(c, "hug"\|"grow")` / `rowSize(r, …)` | Size radio (Hug / Grow). |
| `columnSizeFixed(c, "120px")` / `rowSizeFixed(r, …)` | Fixed size + typed value. |

### Borders
| Command | UI action |
|---|---|
| `clearBorders()` | Table border control → select all edges → Style **None** (wipes the default all-solid borders). |
| `tableBorders(edges, style, weight)` | Table border control. `edges`: any of `"top" "right" "bottom" "left" "inner"`. `"inner"` toggles **both** inner edges together (the control couples innerH+innerV). |
| `cellBorders(r, c, sides, style, weight)` | Cell border control (perimeter only). `sides`: any of `"top" "right" "bottom" "left"`. |

`style`: `none \| solid \| dashed \| dotted \| double`. `weight`: `0 \| 1 \| 2 \| 4`.

### Corners / gaps / padding / alignment
| Command | UI action |
|---|---|
| `tableCorners(radius)` | Table section → Corners (0/2/4/8/16). |
| `cellCorners(r, c, radius)` | Cell section → Corners. |
| `gapX(value)` / `gapY(value)` | Table section → Gap. |
| `pad(r, c, value)` | Cell section → Padding (CSS shorthand, e.g. `"6px 16px"`). |
| `align(r, c, "start"\|"center"\|"end")` | Cell section → Text alignment Left/Center/Right. |

### Content
| Command | UI action |
|---|---|
| `contentType(r, c, "text"\|"image"\|"table")` | Cell section → Content radio. |
| `merge(r, c)` / `split(r, c)` | Cell section → Merge / Split (column span ±1). |
| `type(r, c, text)` | Focus the cell and type. |
| `image(r, c, src)` | Set an image cell's source (the "insert image" affordance). |

## Notes / known UI constraints

- The table border control couples innerH and innerV — to draw **only** vertical interior
  rules (e.g. sample 02), set the right border per cell with `cellBorders(..., ["right"], …)`
  rather than the table inner control.
- Cells are focused programmatically (`focus()`), not clicked, because the table's edge
  add/remove overlay buttons sit over the cells and would intercept a real click. Focus fires
  the same `focusin` the toolbar listens for.
- The harness omits the Tailwind CDN (just to avoid a network dependency in tests; the toolbar
  is functional via `aria-label`s without it). Note: bloom-table's structural classes are now
  `bloom-`prefixed (`.bloom-table` / `.bloom-cell`), so the old collision with Tailwind's
  `.table { display:table }` utility no longer applies.
