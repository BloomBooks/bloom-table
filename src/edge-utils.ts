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

  // Left
  if (map.left !== undefined) {
    const innerSpec = toSpec(map.left, innerColorFallback);
    const outerSpec = toSpec(map.left, outerColorFallback);
    // Perimeter if c==0 else interior boundary at column c
    for (let rr = r; rr < Math.min(r + sy, v.length); rr++) {
      const boundary = c === 0 ? 0 : c;
      v[rr][boundary] = c === 0 ? outerSpec : innerSpec;
    }
  }

  // Right
  if (map.right !== undefined) {
    const innerSpec = toSpec(map.right, innerColorFallback);
    const outerSpec = toSpec(map.right, outerColorFallback);
    const rc = c + sx - 1;
    for (let rr = r; rr < Math.min(r + sy, v.length); rr++) {
      const boundary = rc === cols - 1 ? cols : rc + 1;
      v[rr][boundary] = rc === cols - 1 ? outerSpec : innerSpec;
    }
  }

  // Top
  if (map.top !== undefined) {
    const innerSpec = toSpec(map.top, innerColorFallback);
    const outerSpec = toSpec(map.top, outerColorFallback);
    // Perimeter if r==0 else interior boundary at row r
    const boundaryRow = r === 0 ? 0 : r;
    for (let cc = c; cc < Math.min(c + sx, h[boundaryRow]?.length ?? 0); cc++) {
      h[boundaryRow][cc] = r === 0 ? outerSpec : innerSpec;
    }
  }

  // Bottom
  if (map.bottom !== undefined) {
    const innerSpec = toSpec(map.bottom, innerColorFallback);
    const outerSpec = toSpec(map.bottom, outerColorFallback);
    const rrBottom = r + sy - 1;
    const boundaryRow = rrBottom === rows - 1 ? rows : rrBottom + 1;
    for (let cc = c; cc < Math.min(c + sx, h[boundaryRow]?.length ?? 0); cc++) {
      h[boundaryRow][cc] = rrBottom === rows - 1 ? outerSpec : innerSpec;
    }
  }

  setEdgesV(table, v);
  setEdgesH(table, h);
}
