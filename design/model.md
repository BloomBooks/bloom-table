# Bloom Grid DOM Model

This document defines the current DOM data-\* model used by Bloom Grid, the goals it satisfies, and how it renders at runtime.

## 1) Requirements (goals and constraints)

- Single source of truth in `data-*` attributes (grid + cells).
- Deterministic, testable renderer that derives inline styles from the model.
- Clear, minimal public API for manipulating structure and styling.
- No visual conflicts: with zero gap between cells, at most one visible stroke is painted per shared edge (deterministic tie-breaks favor left/top).
- Support gaps/indents: when a positive gap exists between tracks, each side can draw independently.
- Perimeter borders: outer edges (top/right/bottom/left) set directly on the grid perimeter.
- Defaults: optional grid-level default edge used when an edge is unspecified.
- Spans: cell spans suppress internal edges and apply border segments at the span’s outer perimeter.
- Be concise. For example, don't require us list out specs for each edge when the are all the same. Another example: don't list color:"black" if you know that black is the default. This makes the html much easier to read an reason about.
  - UI must not compute defaults on its own. It should query centralized helpers that build upon the renderer (e.g., `border-state.ts`) to present current state.

## Approach

- Single source of truth for borders: edges belong to the parent grid, not cells.
- When gap between cells is 0, no conflict are possible because we specify every edge.
- When gap > 0, now we have multiple "borders" per "edge". At that point we have to specify east/west or north/south to define each border.
- Grid and cell state lives in `data-*` attributes only. No UI writes to `style` or CSS vars directly.
- Inline styles are render outputs, never inputs.

## Rendering Borders vs Outlines

- CSS borders have curved outsides but right-angle insides and look ugly. However, CSS Outlines are not a total replacement, because we cannot specify different sides to have different outlines, the way we can with borders. Perhaps in the future we will have a hybrid system, but for now, we are going to only use css borders, no outlines, for content borders.

Selection highlighting (non-model):

- For usability, we add purely presentational classes when focus enters a cell:
  - `cell--selected` on the active `.bloom-cell` (styled with a blue CSS `outline`)
  - `grid--selected` on the containing `.grid` (styled with a purple `outline`)
- These do not affect the data-\* model and are applied by a global listener installed at attach time. The outlines avoid layout shifts and are distinct from renderer-managed borders.

## 2) Data-\* schema

Terminology:

Grid sizing:

Cell sizing and content:

- `data-span-x`, `data-span-y`: integers ≥ 1 (default 1) indicating column/row span for a cell
- `data-content-type`: `text | image | grid` (existing)

- Spans: internal edges under a spanning cell are suppressed; only the span’s perimeter edges render. Covered cells retain DOM presence with class `bloom-skip`; the renderer avoids painting borders for `bloom-skip` cells and attributes the shared edges to the spanning owner.

Corners:

- Grid corners: `data-corners` on the grid is a JSON object, e.g., `{ "radius": number }`, that applies to the four outer grid corners.
- Cell corners (optional): cells may have `data-corners` as JSON `{ radius?: number }`. Outer corner radii of perimeter cells are forced to match the grid’s corner radius. Inner cell corners remain unrounded (0) unless future rules specify otherwise.

Nested grids:

- Where a nested grid sits inside a parent cell, the parent grid’s perimeter takes precedence over the nested grid’s perimeter where they coincide (the parent cell defines the visual outer boundary).
- Initial behavior: a nested grid renders with no outer perimeter by default. Its interior edges still render normally.
- Author control: if you explicitly set perimeter entries in `data-edges-h`/`data-edges-v` for the nested grid, those perimeters are honored. When nested, perimeter sides do not fall back to `data-border-default` or CSS defaults; only explicitly provided perimeter entries render. This avoids accidental double borders while still allowing deliberate outer borders on embedded grids.

- `data-gap-x`: comma list or single CSS length for column gaps (C-1 entries if list)
- `data-gap-y`: comma list or single CSS length for row gaps (R-1 entries if list)

Unified edges (no separate outer object):

- `data-edges-h`: JSON 2D array describing horizontal boundaries. Preferred full shape is (R+1)×C; row 0 is the top perimeter, row R is the bottom perimeter; interior rows are boundaries between r and r+1.
- `data-edges-v`: JSON 2D array describing vertical boundaries. Preferred full shape is R×(C+1); col 0 is the left perimeter, col C is the right perimeter; interior cols are boundaries between c and c+1.

Authoring forms per entry (applies to both H and V arrays):

1. Shorthand single edge: `BorderSpec | null` (applies to both sides when gap is zero; `null` = unspecified)
2. Sided object for gaps/asymmetry:
   - Horizontal: `{ north?: BorderSpec|null, south?: BorderSpec|null }`
   - Vertical: `{ west?: BorderSpec|null, east?: BorderSpec|null }`

Concise interior-only form:

- For convenience, you may omit perimeters and provide only interior boundaries:
  - `data-edges-h`: shape (R-1)×C
  - `data-edges-v`: shape R×(C-1)
- You may also use a single interior row/col (length 1) in degenerate cases, e.g., a 1×2 grid.
- Perimeter edges are treated as absent unless explicitly provided (no implicit defaults beyond `data-border-default`).

Defaults:

- `data-border-default`: `BorderSpec | null`
  - If present, this is the default border spec the renderer uses when an edge side is unspecified.
  - If absent, the renderer reads CSS custom properties from the grid element (themeable):
    - `--edge-default-weight` (number, px)
    - `--edge-default-style` (solid|dashed|dotted|double|none)
    - `--edge-default-color` (CSS color)
  - These CSS vars can be defined globally (e.g., in :root) or overridden per-grid.

Null semantics (vs. explicit none):

- `null` means "unspecified" — the model provides no instruction for that boundary. It does not force absence; it simply omits a value.
  - Interior edges, zero gap: if both sides are unspecified, the default applies (from data-border-default or CSS vars). Conflicts choose a single stroke (none > weight > style; ties favor left/top).
  - Interior edges, positive gap: each side paints independently. If a side is unspecified, the default applies to that side; explicit `style:"none"` continues to suppress.
  - Perimeter edges: when unspecified, the default applies to the outer cell sides.
- `{ "style": "none" }` is an explicit instruction to render no border. It always suppresses defaults and participates in conflict resolution ("none" wins).
- Summary: use `style: "none"` to force no stroke; use `null` to say nothing.

Examples:

- 1×2 with a red divider, no perimeter (concise interior-only V):
  - `data-edges-h='[[null,null]]'` <!-- (R-1)×C = 0×2 effectively omitted -->
  - `data-edges-v='[[{"weight":1,"style":"solid","color":"red"}]]'` <!-- R×(C-1) = 1×1 -->
- 2×2 with only an outer 1px solid black border (full H/V with perimeters):
  - `data-edges-h='[[{"weight":1,"style":"solid","color":"#000"},{"weight":1,"style":"solid","color":"#000"}],[null,null],[{"weight":1,"style":"solid","color":"#000"},{"weight":1,"style":"solid","color":"#000"}]]'`
  - `data-edges-v='[[{"weight":1,"style":"solid","color":"#000"},null,{"weight":1,"style":"solid","color":"#000"}],[{"weight":1,"style":"solid","color":"#000"},null,{"weight":1,"style":"solid","color":"#000"}]]'`
- 2×2 with no inner borders (concise interior-only):
  - `data-edges-h='[[{"style":"none"},{"style":"none"}]]'` <!-- (R-1)×C = 1×2 -->
  - `data-edges-v='[[{"style":"none"}],[{"style":"none"}]]'` <!-- R×(C-1) = 2×1 -->
- 2×2 with inner red lines (shorthand):
  - `data-edges-v='[[{"color":"red"}],[{"color":"red"}]]'` <!-- R×(C-1) = 2×1; defaults: 1 solid -->
  - `data-edges-h='[[{"color":"red"},{"color":"red"}]]'` <!-- (R-1)×C = 1×2; defaults: 1 solid -->

CSS default example (no data-border-default provided):

```css
:root {
  --edge-default-weight: 1;
  --edge-default-style: solid;
  --edge-default-color: #000;
}
```

With the above, a 2×2 grid with no edges specified will render with 1px solid black on all inner edges and perimeters.

Behavior notes:

- Zero gap: each shared edge yields a single visible stroke by conflict resolution (none > weight > style precedence; ties favor left/top). Sided entries are reconciled; shorthand applies identically to both sides.
- Positive gap: both sides may render independently; sided entries allow asymmetric styling.
- Spans: internal edges under a spanning cell are suppressed; only the span’s perimeter edges render.
- Double style minimum width (render-time only): when an edge resolves to style "double" with a positive weight, the renderer clamps the painted width to at least 4px so the double lines are visible. If the edge is explicitly style "none" or weight 0, it remains invisible (no clamping). The data-\* model is not changed by this rule; only the rendered CSS width is affected.

## 3) Rendering at runtime

At runtime, the renderer reads the above data-\* attributes, builds a per-cell border model, and sets standard CSS properties (e.g., `borderTopWidth/Style/Color`) on each cell. No structural mutations occur, and the grid template (columns/rows) is applied via CSS grid.
