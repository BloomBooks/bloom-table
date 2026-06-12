# bloom-table

## Demo App

`pnpm dev`

## Notes

- Rendering is explicit and deterministic. The renderer reads data-\* attributes (column widths, row heights, spans, borders, corners) and applies styles.
- Call `attachTable(gridElement)` once after inserting demo HTML; it configures the renderer and triggers an initial render.
