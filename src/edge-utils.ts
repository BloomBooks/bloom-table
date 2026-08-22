import type {
  BorderSpec,
  HVHorizontalEdgeCellSides,
  HVVerticalEdgeCellSides,
  HEdgeEntry,
  VEdgeEntry,
} from "./table-model";
import {
  getColumnWidths,
  getRowHeights,
  getEdgesV,
  setEdgesV,
  getEdgesH,
  setEdgesH,
  setEdgeDefault,
  getSpan,
  getGapX,
  getGapY,
} from "./table-model";
import { getTableCells } from "./structure";
import { resolveEdgeDefault, isNestedTable } from "./table-renderer";
import { splitV, splitH, hasPositiveGap, isBorderSpec } from "./edge-entries";
import { parseColor } from "./color-utils";

// Simple converters between UI-friendly types and model BorderSpec
export type UIStyle = "none" | "solid" | "dashed" | "dotted" | "double";
export interface UIBorder {
  weight: number;
  style: UIStyle;
  color?: string;
}

// Stored edge entries (data-edges-h / data-edges-v) are tri-state:
//   - a spec with weight > 0: an edge somebody explicitly painted;
//   - a spec with weight 0 / style "none": an edge somebody explicitly turned
//     OFF (weight 0 and "none" are one state — toSpec collapses either into
//     {weight: 0, style: "none"});
//   - null / absent / an empty entry: an edge NOBODY ever set — it renders
//     with the table default (resolveEdgeDefault) and keeps following later
//     edits to that default.
// The writers below preserve the third state: stamping a never-set entry with
// a value that renders exactly like the current default is skipped, so reading
// the resolved value maps (border-state.ts) and writing them back unchanged
// does not freeze inheriting edges at today's default. An entry somebody DID
// set is always overwritten, even with a default-equal value.

const toSpec = (u?: UIBorder | null, fallbackColor = "#444"): BorderSpec | null => {
  if (!u) return null;
  const color = u.color ?? fallbackColor;
  if (u.weight <= 0 || u.style === "none") return { weight: 0, style: "none", color };
  return { weight: u.weight, style: u.style, color } as BorderSpec;
};

// Do two color strings paint the same pixels? Raw string match first, then a
// parsed comparison so "#000", "#000000", and "rgb(0,0,0)" agree; two colors
// that both fail to parse only match textually.
const colorsEqual = (a: string | undefined, b: string | undefined): boolean => {
  if ((a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase()) return true;
  const pa = parseColor(a);
  const pb = parseColor(b);
  return !!pa && !!pb && pa.r === pb.r && pa.g === pb.g && pa.b === pb.b && pa.a === pb.a;
};

// An entry nobody ever set: absent, null, or a sided container with neither
// side set (ensureEdgesArrays pads new positions with {}).
const isUnsetEntry = (e: unknown): boolean => {
  if (e == null) return true;
  if (isBorderSpec(e)) return false;
  const s = e as { west?: unknown; east?: unknown; north?: unknown; south?: unknown };
  return s.west == null && s.east == null && s.north == null && s.south == null;
};

// Would `spec` render exactly like `dflt`? Invisible specs (weight 0 or style
// "none") all render alike, whatever their color.
const specMatchesDefault = (spec: BorderSpec | null, dflt: BorderSpec | null): boolean => {
  const invisible = (s: BorderSpec | null): boolean => !s || s.weight <= 0 || s.style === "none";
  if (invisible(spec) || invisible(dflt)) return invisible(spec) && invisible(dflt);
  return (
    spec!.weight === dflt!.weight &&
    spec!.style === dflt!.style &&
    colorsEqual(spec!.color, dflt!.color)
  );
};

// Edge-entry decoding (splitV/splitH, hasPositiveGap) is shared with the
// renderer via edge-entries, so the writer and renderer agree by construction.

// Read current sizes
export function getTableSize(table: HTMLElement): { rows: number; cols: number } {
  const rows = getRowHeights(table).length;
  const cols = getColumnWidths(table).length;
  return { rows, cols };
}

// Ensure edges arrays are sized to table
export function ensureEdgesArrays(table: HTMLElement) {
  const { rows, cols } = getTableSize(table);
  // V edges: R x (C+1) including perimeters
  let v = (getEdgesV(table) ?? []) as VEdgeEntry[][];
  while (v.length < rows) v.push([]);
  for (let r = 0; r < rows; r++) {
    while ((v[r] ?? (v[r] = [])).length < cols + 1) v[r].push({});
    v[r] = v[r].slice(0, cols + 1);
  }
  v = v.slice(0, rows);
  setEdgesV(table, v as VEdgeEntry[][]);

  // H edges: (R+1) x C including perimeters
  let h = (getEdgesH(table) ?? []) as HEdgeEntry[][];
  while (h.length < rows + 1) h.push([]);
  for (let r = 0; r < rows + 1; r++) {
    while ((h[r] ?? (h[r] = [])).length < cols) h[r].push({});
    h[r] = h[r].slice(0, cols);
  }
  h = h.slice(0, rows + 1);
  setEdgesH(table, h as HEdgeEntry[][]);
}

// Apply a uniform outer border to all four sides. A never-set perimeter entry
// that already renders like `border` via the table default stays unset (see
// the tri-state contract above), so it keeps following later default edits.
export function applyUniformOuter(
  table: HTMLElement,
  border: UIBorder | null,
  colorFallback = "#000",
) {
  ensureEdgesArrays(table);
  const { rows, cols } = getTableSize(table);
  const spec = toSpec(border, colorFallback);
  const specIsDefault = specMatchesDefault(spec, resolveEdgeDefault(table));
  const keep = (entry: unknown) => specIsDefault && isUnsetEntry(entry);
  // Top and Bottom perimeters via H at r=0 and r=rows
  const h = (getEdgesH(table) ?? []) as HEdgeEntry[][];
  for (let c = 0; c < cols; c++) {
    if (!keep(h[0][c])) h[0][c] = spec;
    if (!keep(h[rows][c])) h[rows][c] = spec;
  }
  setEdgesH(table, h);
  // Left and Right perimeters via V at c=0 and c=cols
  const v = (getEdgesV(table) ?? []) as VEdgeEntry[][];
  for (let r = 0; r < rows; r++) {
    if (!keep(v[r][0])) v[r][0] = spec;
    if (!keep(v[r][cols])) v[r][cols] = spec;
  }
  setEdgesV(table, v);
}

// Apply individual borders to each side of the outer perimeter. A side left
// undefined is not touched. A never-set perimeter entry that already renders
// like the requested value via the table default stays unset (tri-state
// contract above), so it keeps following later default edits.
// Exception, for a NESTED table (one whose parent is a cell): the renderer never
// applies the table default to such a table's perimeter, so an inherited
// perimeter would render as nothing. Its perimeter entries are always written
// explicitly.
export function applyOuterBorders(
  table: HTMLElement,
  borders: {
    top?: UIBorder | null;
    right?: UIBorder | null;
    bottom?: UIBorder | null;
    left?: UIBorder | null;
  },
  colorFallback = "#000",
) {
  ensureEdgesArrays(table);
  const { rows, cols } = getTableSize(table);
  const dflt = resolveEdgeDefault(table);
  // A nested table's perimeter cannot inherit (see the docstring above), so the
  // tri-state guard is off for it and every perimeter entry is materialized.
  const canInherit = !isNestedTable(table);

  const h = (getEdgesH(table) ?? []) as HEdgeEntry[][];
  const v = (getEdgesV(table) ?? []) as VEdgeEntry[][];

  // Top perimeter (H at r=0)
  if (borders.top !== undefined) {
    const spec = toSpec(borders.top, colorFallback);
    const keep = canInherit && specMatchesDefault(spec, dflt);
    for (let c = 0; c < cols; c++) {
      if (!(keep && isUnsetEntry(h[0][c]))) h[0][c] = spec;
    }
  }

  // Bottom perimeter (H at r=rows)
  if (borders.bottom !== undefined) {
    const spec = toSpec(borders.bottom, colorFallback);
    const keep = canInherit && specMatchesDefault(spec, dflt);
    for (let c = 0; c < cols; c++) {
      if (!(keep && isUnsetEntry(h[rows][c]))) h[rows][c] = spec;
    }
  }

  // Left perimeter (V at c=0)
  if (borders.left !== undefined) {
    const spec = toSpec(borders.left, colorFallback);
    const keep = canInherit && specMatchesDefault(spec, dflt);
    for (let r = 0; r < rows; r++) {
      if (!(keep && isUnsetEntry(v[r][0]))) v[r][0] = spec;
    }
  }

  // Right perimeter (V at c=cols)
  if (borders.right !== undefined) {
    const spec = toSpec(borders.right, colorFallback);
    const keep = canInherit && specMatchesDefault(spec, dflt);
    for (let r = 0; r < rows; r++) {
      if (!(keep && isUnsetEntry(v[r][cols]))) v[r][cols] = spec;
    }
  }

  setEdgesH(table, h);
  setEdgesV(table, v);
}

// Apply uniform inner vertical/horizontal borders (between cells). A never-set
// interior entry that already renders like `border` via the table default
// stays unset (tri-state contract above), so it keeps following later default
// edits; an entry somebody set — including a sided one — is overwritten.
export function applyUniformInner(
  table: HTMLElement,
  kind: "innerV" | "innerH",
  border: UIBorder | null,
  colorFallback = "#444",
) {
  ensureEdgesArrays(table);
  const { rows, cols } = getTableSize(table);
  const spec = toSpec(border, colorFallback);
  const specIsDefault = specMatchesDefault(spec, resolveEdgeDefault(table));
  const keep = (entry: unknown) => specIsDefault && isUnsetEntry(entry);
  if (kind === "innerV") {
    const v = (getEdgesV(table) ?? []) as Array<Array<HVVerticalEdgeCellSides | BorderSpec | null>>;
    for (let r = 0; r < rows; r++) {
      for (let c = 1; c <= Math.max(0, cols - 1); c++) {
        // Write a single-spec for conciseness
        if (!keep(v[r][c])) v[r][c] = spec;
      }
    }
    setEdgesV(table, v);
  } else {
    const h = (getEdgesH(table) ?? []) as Array<
      Array<HVHorizontalEdgeCellSides | BorderSpec | null>
    >;
    for (let r = 1; r <= Math.max(0, rows - 1); r++) {
      for (let c = 0; c < cols; c++) {
        if (!keep(h[r][c])) h[r][c] = spec;
      }
    }
    setEdgesH(table, h);
  }
}

// Apply a default border spec for unspecified edges. This writes the table
// default itself (data-border-default) — the value every never-set edge entry
// renders with — so it takes no tri-state guard: it IS what unset entries
// inherit.
export function setDefaultBorder(
  table: HTMLElement,
  border: UIBorder | null,
  colorFallback = "#444",
) {
  setEdgeDefault(table, toSpec(border, colorFallback));
}

// Apply borders around a single cell's perimeter.
// Uses unified edges: interior sides to inner boundaries; outer to perimeters in H/V arrays.
// A side left undefined in `map` is not touched. Writing weight 0 records an
// explicit 'none' for this cell's side (NOT the same as never-set — see the
// tri-state contract above), while writing a value a never-set entry already
// renders via the table default leaves that entry unset.
export function applyCellPerimeter(
  table: HTMLElement,
  cell: HTMLElement,
  map: {
    top?: UIBorder | null;
    right?: UIBorder | null;
    bottom?: UIBorder | null;
    left?: UIBorder | null;
  },
  outerColorFallback = "#000",
  innerColorFallback = "#444",
) {
  ensureEdgesArrays(table);
  const { rows, cols } = getTableSize(table);
  const cells = getTableCells(table);
  const idx = cells.indexOf(cell);
  if (idx < 0) return;
  const r = Math.floor(idx / Math.max(1, cols));
  const c = idx % Math.max(1, cols);
  const span = getSpan(cell);
  const sx = Math.max(1, span.x);
  const sy = Math.max(1, span.y);

  // Fetch arrays
  const v = (getEdgesV(table) ?? []) as Array<Array<HVVerticalEdgeCellSides | BorderSpec | null>>;
  const h = (getEdgesH(table) ?? []) as Array<Array<HVHorizontalEdgeCellSides | BorderSpec | null>>;

  // Gap info: when a boundary has a positive gap, the two adjacent cells own
  // independent border lines, so we must write only this cell's side and leave
  // the neighbor's alone. With no gap there is one shared line: writing a
  // visible border claims the whole edge (setting a line sets it for both
  // neighbors), but writing 'none' only withdraws this cell's side — the
  // neighbor keeps any line it wants. Since an untouched neighbor side may be
  // relying on the implicit default, we materialize it with the currently
  // rendered spec so withdrawing our side doesn't erase the neighbor's line.
  const gapX = getGapX(table);
  const gapY = getGapY(table);
  const isRemoval = (spec: BorderSpec | null): boolean => !!spec && spec.weight === 0;
  const dflt = () => resolveEdgeDefault(table);
  // Tri-state guard (see the contract above): a never-set entry that already
  // renders like the value being written stays unset, so it keeps following
  // later table-default edits. Only the perimeter and zero-gap whole-edge
  // writes take the guard — the sided gap and removal paths below write one
  // cell's side of the entry on purpose (an explicit 'none' must be KEPT
  // distinct from never-set: it says "this cell declined its side").
  const currentDefault = resolveEdgeDefault(table);
  const keepUnset = (entry: unknown, spec: BorderSpec | null): boolean =>
    isUnsetEntry(entry) && specMatchesDefault(spec, currentDefault);

  // Left
  if (map.left !== undefined) {
    const innerSpec = toSpec(map.left, innerColorFallback);
    const outerSpec = toSpec(map.left, outerColorFallback);
    // Perimeter if c==0 else interior boundary at column c. This cell sits east
    // of an interior left boundary, so it owns that boundary's `east` side.
    for (let rr = r; rr < Math.min(r + sy, v.length); rr++) {
      if (c === 0) {
        if (!keepUnset(v[rr][0], outerSpec)) v[rr][0] = outerSpec;
      } else if (hasPositiveGap(gapX, c - 1)) {
        v[rr][c] = { west: splitV(v[rr][c]).west, east: innerSpec };
      } else if (isRemoval(innerSpec)) {
        v[rr][c] = { west: splitV(v[rr][c]).west ?? dflt(), east: innerSpec };
      } else if (!keepUnset(v[rr][c], innerSpec)) {
        v[rr][c] = innerSpec;
      }
    }
  }

  // Right
  if (map.right !== undefined) {
    const innerSpec = toSpec(map.right, innerColorFallback);
    const outerSpec = toSpec(map.right, outerColorFallback);
    const rc = c + sx - 1;
    // This cell sits west of an interior right boundary, so it owns `west`.
    for (let rr = r; rr < Math.min(r + sy, v.length); rr++) {
      if (rc === cols - 1) {
        if (!keepUnset(v[rr][cols], outerSpec)) v[rr][cols] = outerSpec;
      } else if (hasPositiveGap(gapX, rc)) {
        v[rr][rc + 1] = { west: innerSpec, east: splitV(v[rr][rc + 1]).east };
      } else if (isRemoval(innerSpec)) {
        v[rr][rc + 1] = { west: innerSpec, east: splitV(v[rr][rc + 1]).east ?? dflt() };
      } else if (!keepUnset(v[rr][rc + 1], innerSpec)) {
        v[rr][rc + 1] = innerSpec;
      }
    }
  }

  // Top
  if (map.top !== undefined) {
    const innerSpec = toSpec(map.top, innerColorFallback);
    const outerSpec = toSpec(map.top, outerColorFallback);
    // Perimeter if r==0 else interior boundary at row r. This cell sits south of
    // an interior top boundary, so it owns that boundary's `south` side.
    const boundaryRow = r === 0 ? 0 : r;
    for (let cc = c; cc < Math.min(c + sx, h[boundaryRow]?.length ?? 0); cc++) {
      if (r === 0) {
        if (!keepUnset(h[0][cc], outerSpec)) h[0][cc] = outerSpec;
      } else if (hasPositiveGap(gapY, r - 1)) {
        h[boundaryRow][cc] = { north: splitH(h[boundaryRow][cc]).north, south: innerSpec };
      } else if (isRemoval(innerSpec)) {
        h[boundaryRow][cc] = { north: splitH(h[boundaryRow][cc]).north ?? dflt(), south: innerSpec };
      } else if (!keepUnset(h[boundaryRow][cc], innerSpec)) {
        h[boundaryRow][cc] = innerSpec;
      }
    }
  }

  // Bottom
  if (map.bottom !== undefined) {
    const innerSpec = toSpec(map.bottom, innerColorFallback);
    const outerSpec = toSpec(map.bottom, outerColorFallback);
    const rrBottom = r + sy - 1;
    const boundaryRow = rrBottom === rows - 1 ? rows : rrBottom + 1;
    // This cell sits north of an interior bottom boundary, so it owns `north`.
    for (let cc = c; cc < Math.min(c + sx, h[boundaryRow]?.length ?? 0); cc++) {
      if (rrBottom === rows - 1) {
        if (!keepUnset(h[boundaryRow][cc], outerSpec)) h[boundaryRow][cc] = outerSpec;
      } else if (hasPositiveGap(gapY, rrBottom)) {
        h[boundaryRow][cc] = { north: innerSpec, south: splitH(h[boundaryRow][cc]).south };
      } else if (isRemoval(innerSpec)) {
        h[boundaryRow][cc] = { north: innerSpec, south: splitH(h[boundaryRow][cc]).south ?? dflt() };
      } else if (!keepUnset(h[boundaryRow][cc], innerSpec)) {
        h[boundaryRow][cc] = innerSpec;
      }
    }
  }

  setEdgesV(table, v);
  setEdgesH(table, h);
}
