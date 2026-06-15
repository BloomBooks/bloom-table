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

// Simple converters between UI-friendly types and model BorderSpec
export type UIStyle = "none" | "solid" | "dashed" | "dotted" | "double";
export interface UIBorder {
  weight: number;
  style: UIStyle;
  color?: string;
}

const toSpec = (u?: UIBorder | null, fallbackColor = "#444"): BorderSpec | null => {
  if (!u) return null;
  const color = u.color ?? fallbackColor;
  if (u.weight <= 0 || u.style === "none") return { weight: 0, style: "none", color };
  return { weight: u.weight, style: u.style, color } as BorderSpec;
};

// Is this edge entry a single shared BorderSpec (vs. a sided west/east|north/south object)?
const isSpec = (e: unknown): e is BorderSpec => {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.weight === "number" ||
    Object.prototype.hasOwnProperty.call(o, "style") ||
    Object.prototype.hasOwnProperty.call(o, "color")
  );
};

// Decompose an edge entry into its two sides, mirroring the renderer: a single spec
// applies to both sides; a sided object keeps each side; null/absent => both null.
const splitV = (e: VEdgeEntry | undefined): HVVerticalEdgeCellSides => {
  if (isSpec(e)) return { west: e, east: e };
  if (e && typeof e === "object") {
    const s = e as HVVerticalEdgeCellSides;
    return { west: s.west ?? null, east: s.east ?? null };
  }
  return { west: null, east: null };
};
const splitH = (e: HEdgeEntry | undefined): HVHorizontalEdgeCellSides => {
  if (isSpec(e)) return { north: e, south: e };
  if (e && typeof e === "object") {
    const s = e as HVHorizontalEdgeCellSides;
    return { north: s.north ?? null, south: s.south ?? null };
  }
  return { north: null, south: null };
};

// Does the boundary at the given gap index have a positive gap? Mirrors the
// renderer's hasPositiveGap logic so the writer and renderer agree.
const gapPositive = (tokens: string[], i: number): boolean => {
  const gi = Math.min(Math.max(0, i), Math.max(0, (tokens.length || 1) - 1));
  const token = (tokens[gi] || "").trim();
  if (!token) return false;
  const n = parseFloat(token);
  if (!isNaN(n)) return n > 0;
  return token !== "0" && token !== "0px";
};

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

// Apply a uniform outer border to all four sides
export function applyUniformOuter(
  table: HTMLElement,
  border: UIBorder | null,
  colorFallback = "#000",
) {
  ensureEdgesArrays(table);
  const { rows, cols } = getTableSize(table);
  const spec = toSpec(border, colorFallback);
  // Top and Bottom perimeters via H at r=0 and r=rows
  const h = (getEdgesH(table) ?? []) as HEdgeEntry[][];
  for (let c = 0; c < cols; c++) {
    h[0][c] = spec;
    h[rows][c] = spec;
  }
  setEdgesH(table, h);
  // Left and Right perimeters via V at c=0 and c=cols
  const v = (getEdgesV(table) ?? []) as VEdgeEntry[][];
  for (let r = 0; r < rows; r++) {
    v[r][0] = spec;
    v[r][cols] = spec;
  }
  setEdgesV(table, v);
}

// Apply individual borders to each side of the outer perimeter
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

  const h = (getEdgesH(table) ?? []) as HEdgeEntry[][];
  const v = (getEdgesV(table) ?? []) as VEdgeEntry[][];

  // Top perimeter (H at r=0)
  if (borders.top !== undefined) {
    const spec = toSpec(borders.top, colorFallback);
    for (let c = 0; c < cols; c++) {
      h[0][c] = spec;
    }
  }

  // Bottom perimeter (H at r=rows)
  if (borders.bottom !== undefined) {
    const spec = toSpec(borders.bottom, colorFallback);
    for (let c = 0; c < cols; c++) {
      h[rows][c] = spec;
    }
  }

  // Left perimeter (V at c=0)
  if (borders.left !== undefined) {
    const spec = toSpec(borders.left, colorFallback);
    for (let r = 0; r < rows; r++) {
      v[r][0] = spec;
    }
  }

  // Right perimeter (V at c=cols)
  if (borders.right !== undefined) {
    const spec = toSpec(borders.right, colorFallback);
    for (let r = 0; r < rows; r++) {
      v[r][cols] = spec;
    }
  }

  setEdgesH(table, h);
  setEdgesV(table, v);
}

// Apply uniform inner vertical/horizontal borders (between cells)
export function applyUniformInner(
  table: HTMLElement,
  kind: "innerV" | "innerH",
  border: UIBorder | null,
  colorFallback = "#444",
) {
  ensureEdgesArrays(table);
  const { rows, cols } = getTableSize(table);
  const spec = toSpec(border, colorFallback);
  if (kind === "innerV") {
    const v = (getEdgesV(table) ?? []) as Array<Array<HVVerticalEdgeCellSides | BorderSpec | null>>;
    for (let r = 0; r < rows; r++) {
      for (let c = 1; c <= Math.max(0, cols - 1); c++) {
        // Write a single-spec for conciseness
        v[r][c] = spec;
      }
    }
    setEdgesV(table, v);
  } else {
    const h = (getEdgesH(table) ?? []) as Array<
      Array<HVHorizontalEdgeCellSides | BorderSpec | null>
    >;
    for (let r = 1; r <= Math.max(0, rows - 1); r++) {
      for (let c = 0; c < cols; c++) {
        h[r][c] = spec;
      }
    }
    setEdgesH(table, h);
  }
}

// Apply a default border spec for unspecified edges
export function setDefaultBorder(
  table: HTMLElement,
  border: UIBorder | null,
  colorFallback = "#444",
) {
  setEdgeDefault(table, toSpec(border, colorFallback));
}

// Apply borders around a single cell's perimeter.
// Uses unified edges: interior sides to inner boundaries; outer to perimeters in H/V arrays.
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
  // the neighbor's alone. With no gap there is one shared line; we overwrite the
  // whole edge so the change lands on it (and the renderer collapses it).
  const gapX = getGapX(table);
  const gapY = getGapY(table);

  // Left
  if (map.left !== undefined) {
    const innerSpec = toSpec(map.left, innerColorFallback);
    const outerSpec = toSpec(map.left, outerColorFallback);
    // Perimeter if c==0 else interior boundary at column c. This cell sits east
    // of an interior left boundary, so it owns that boundary's `east` side.
    for (let rr = r; rr < Math.min(r + sy, v.length); rr++) {
      if (c === 0) {
        v[rr][0] = outerSpec;
      } else if (gapPositive(gapX, c - 1)) {
        v[rr][c] = { west: splitV(v[rr][c]).west, east: innerSpec };
      } else {
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
        v[rr][cols] = outerSpec;
      } else if (gapPositive(gapX, rc)) {
        v[rr][rc + 1] = { west: innerSpec, east: splitV(v[rr][rc + 1]).east };
      } else {
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
        h[0][cc] = outerSpec;
      } else if (gapPositive(gapY, r - 1)) {
        h[boundaryRow][cc] = { north: splitH(h[boundaryRow][cc]).north, south: innerSpec };
      } else {
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
        h[boundaryRow][cc] = outerSpec;
      } else if (gapPositive(gapY, rrBottom)) {
        h[boundaryRow][cc] = { north: innerSpec, south: splitH(h[boundaryRow][cc]).south };
      } else {
        h[boundaryRow][cc] = innerSpec;
      }
    }
  }

  setEdgesV(table, v);
  setEdgesH(table, h);
}
