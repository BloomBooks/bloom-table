# Bloom Grid — Architecture & Process

This document explains the major parts of Bloom Grid, how they interact, and the contracts between layers. It reflects the current code over any older design notes.

## High-level goals

- Single source of truth in `data-*` attributes on the DOM. Renderer reads these; it never writes them.
- Deterministic, testable rendering. Conflict rules produce a single, stable visual result.
- Clear public surface for UI and features via `BloomTable` plus focused helpers.

## Key modules

- `table-model.ts` — Data accessors & validation for the DOM model
  - Track sizing: `data-column-widths`, `data-row-heights` with helpers `get/setColumnWidths`, `get/setRowHeights`.
  - Spans: per-cell `data-span-x`, `data-span-y` via `getSpan` / `setSpan`.
  - Gaps: `data-gap-x`, `data-gap-y` lists or single values via `get/setGapX`, `get/setGapY`.
  - Edges (borders): unified edge arrays via `get/setEdgesH` and `get/setEdgesV`.
    - Horizontal `data-edges-h`: full (R+1)×C or interior-only (R-1)×C.
    - Vertical `data-edges-v`: full R×(C+1) or interior-only R×(C-1).
    - Entries can be a single `BorderSpec` or sided objects: `{north|south}` for H, `{west|east}` for V.
  - Defaults: `data-border-default` used only when an interior edge entry is entirely unspecified and there is zero gap.
  - Corners: `data-corners` JSON on grid and (optionally) cells via `get/setGridCorners`, `get/setCellCorners`.
  - Types: `BorderSpec`, `SpanSpec`, sided-edge entry types, with runtime JSON parsing and assertions.

- `table-renderer.ts` — Pure rendering of model to CSS styles
  - Reads model attributes and computes:
    - Templates: `grid-template-columns/rows` from track tokens (supporting `hug` and `fill`).
    - Spans: reads `data-span-x/y` on cells and sets CSS vars `--span-x/--span-y` used by CSS.
    - Edges: per-cell, per-side border resolution from H/V edges + defaults.
    - Corners: applies outer grid corner radius to the four perimeter cells and resets others to 0.
  - Conflict rules:
    - Zero gap: reconcile sided entries to a single visible stroke for the shared edge.
    - Positive gap: each side paints independently.
    - Determinism: 'none' beats any other style; else weight (px); else style precedence (double > solid > dashed > dotted); ties favor left/top.
  - Does not mutate `data-*` and never changes DOM structure.

- `border-state.ts` — Derived UI-facing state helpers
  - Provides read-only helpers for UI components to reflect current border state without duplicating renderer logic.
  - Example: `getGridOuterBorderValueMap(grid)` derives the outer (table) border control values by building the render model and sampling perimeter cell sides. It honors `data-border-default` and CSS custom properties (`--edge-default-*`).
  - Keeps defaults centralized and out of UI code; UI reads from these helpers instead of inferring from the raw DOM.

- `table-renderer.ts` — Pure rendering function from DOM data to visual styles
  - Pure function: reads `data-*` from DOM → writes inline CSS styles.
  - Capabilities:
    - Templates: `grid-template-columns/rows` from track tokens (supporting `hug` and `fill`).
    - Spans: reads `data-span-x/y` on cells and sets CSS vars `--span-x/--span-y` used by CSS.
    - Edges: per-cell, per-side border resolution from H/V edges + defaults.
    - Corners: applies outer grid corner radius to the four perimeter cells and resets others to 0.
  - Conflict rules:
    - Zero gap: reconcile sided entries to a single visible stroke for the shared edge.
    - Positive gap: each side paints independently.
    - Determinism: 'none' beats any other style; else weight (px); else style precedence (double > solid > dashed > dotted); ties favor left/top.
  - Does not mutate `data-*` and never changes DOM structure.

- `BloomTable.ts` — Controller for high-level operations
  - Wraps structural and model updates and then renders immediately.
  - Structure: `addRow`, `removeLastRow`, `addColumn`, `removeLastColumn`, and positioned variants (via `structure.ts`).
  - Sizing: `setColumnWidth`, `setRowHeight` using `table-model` helpers.
  - Borders & corners: `setGridBorder`/`setCellBorder` (present placeholders), `setGridCorners`.
  - Spans: `setSpan(cell, x, y)` writes data attributes and calls `structure.setCellSpan()` to maintain skip semantics today.
  - History: Every operation creates a history entry via `tableHistoryManager`.

- `structure.ts` — DOM structure operations
  - Grid cell management and track strings; default size token is `hug` for both rows and columns.
  - Spanning behavior: when a cell spans, covered cells remain in the DOM and are marked with class `skip`.
  - Provides helpers for adding/removing rows/columns and setting spans while keeping correct insertion order.

- `history.ts` — Operation history (undo)
  - Captures grid `innerHTML` and attributes before an operation, then adds a history entry.
  - Provides `undo` and events (`gridHistoryUpdated`) when history changes.
  - Tracks top-level grids to ensure consistent undo scope.

## Data flow and lifecycle

1. UI or caller invokes a `BloomTable` method (e.g., `addColumn()`, `setRowHeight(i, '120px')`, `setSpan(cell, 2, 1)`).
2. Method updates DOM attributes and/or structure via `table-model` and `structure` and records history.
3. Method calls `render(grid)` directly to apply visual changes immediately.
4. Renderer reads `data-*` and current DOM (cells), computes per-cell styles, and writes inline CSS only.

## Contracts and invariants

- Model is authoritative:
  - `data-column-widths` length equals number of columns; `data-row-heights` equals number of rows.
  - Edge arrays match either full shapes or interior-only shapes described above.
  - Spans are integers ≥ 1; a span covers a rectangular region; covered cells have class `skip`.
- Renderer constraints:
  - No `data-*` writes; no structural mutations; only inline style updates.
  - Apply corner radii only to the four outer grid corners to match grid `data-corners`.
- Error handling:
  - Accessors validate and throw on invalid inputs (bad JSON, invalid spans, etc.).
  - Renderer tolerates missing entries (treats as unspecified) and applies defaults only under the documented conditions.

## Edge modeling guidance

- Use unified edges to describe both interior boundaries and perimeters in a single structure.
- Prefer interior-only authoring when perimeters are absent to keep markup concise.
- Use sided objects when there are gaps between tracks and each side must paint independently.
- Use `{ style: 'none' }` explicitly to suppress a stroke (beats any weight/style in conflicts). Use `null` for "unspecified".

## Testing notes

- `buildRenderModel()` provides a pure data structure for unit tests, capturing template strings, spans, and resolved borders.
- Snapshot tests verify style outputs for canonical layouts; functional tests cover skip/span behavior, edge conflicts, and corners.

## Future considerations (tracked separately)

- Deprecation cleanup: remove placeholder per-cell/grid border APIs once migration to unified edge model is complete.
- Nested grids: renderer’s current behavior applies corners on the outer grid. Parent grid perimeters visually dominate nested grid perimeters; additional nested-grid styling rules can be added as needed.
