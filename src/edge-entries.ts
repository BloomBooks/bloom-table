// Single decoder for the edge-entry encoding stored in data-edges-v / data-edges-h.
// Both the renderer (table-renderer) and the writers (edge-utils, structure) read
// entries through this module, so they cannot silently disagree about the encoding.
//
// This module imports ONLY types from table-model — no runtime imports — so it can
// be consumed from either side of the renderer/writer split without a cycle
// (edge-utils imports resolveEdgeDefault from table-renderer, which is fine).
//
// Deliberately NOT done here: normalizing legacy concise array shapes at attach
// time (so entryAtV/entryAtH could assume the full layout). That would rewrite
// persisted attributes and is not behavior-preserving; it remains a possible
// future simplification.
import type {
  BorderSpec,
  HEdgeEntry,
  VEdgeEntry,
  HVHorizontalEdgeCellSides,
  HVVerticalEdgeCellSides,
} from "./table-model";

// Is this edge entry a single BorderSpec shared by both sides (vs. a sided
// west/east | north/south object)?
export const isBorderSpec = (e: unknown): e is BorderSpec => {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.weight === "number" ||
    Object.prototype.hasOwnProperty.call(o, "style") ||
    Object.prototype.hasOwnProperty.call(o, "color")
  );
};

// Decompose an edge entry into its two sides: a single spec applies to both
// sides; a sided object keeps each side (absent => null); null/absent => both
// null. Sides are returned raw — the renderer normalizes afterwards, the
// writers must not.
export const splitV = (e: VEdgeEntry | undefined): HVVerticalEdgeCellSides => {
  if (isBorderSpec(e)) return { west: e, east: e };
  if (e && typeof e === "object") {
    const s = e as HVVerticalEdgeCellSides;
    return { west: s.west ?? null, east: s.east ?? null };
  }
  return { west: null, east: null };
};
export const splitH = (e: HEdgeEntry | undefined): HVHorizontalEdgeCellSides => {
  if (isBorderSpec(e)) return { north: e, south: e };
  if (e && typeof e === "object") {
    const s = e as HVHorizontalEdgeCellSides;
    return { north: s.north ?? null, south: s.south ?? null };
  }
  return { north: null, south: null };
};

// Does the boundary at gap index `i` have a positive gap? A single value
// applies to all boundaries (the index clamps into the token list); a
// non-numeric token counts as positive unless it is '0'/'0px'.
export const hasPositiveGap = (tokens: string[], i: number): boolean => {
  const gi = Math.min(Math.max(0, i), Math.max(0, (tokens.length || 1) - 1));
  const token = (tokens[gi] || "").trim();
  if (!token) return false;
  const n = parseFloat(token);
  if (!isNaN(n)) return n > 0;
  return token !== "0" && token !== "0px";
};

// Raw entry lookup for a vertical boundary at row r, boundary c (0..cols).
// Accepts the three array shapes the renderer has always read: full
// (cols+1 entries including perimeters), concise interior-only (cols-1),
// and single-interior (length 1 when cols >= 2, answering for c === 1).
export function entryAtV(
  edgesV: VEdgeEntry[][] | null,
  cols: number,
  r: number,
  c: number,
): VEdgeEntry | undefined {
  const row: VEdgeEntry[] | undefined = (edgesV && (edgesV[r] as VEdgeEntry[])) || undefined;
  if (!row) return undefined;
  if (row.length === cols + 1) {
    return row[c];
  } else if (row.length === Math.max(0, cols - 1)) {
    // interior boundaries map c in [1..cols-1] to row[c-1]
    if (c >= 1 && c <= cols - 1) return row[c - 1];
  } else if (row.length === 1 && cols >= 2) {
    // Special case: single interior boundary (e.g., 1x2 table)
    if (c === 1) return row[0];
  }
  return undefined;
}

// Raw entry lookup for a horizontal boundary r (0..rows), column c. Same three
// accepted shapes, on the outer array: full (rows+1 boundary lines including
// perimeters), interior-only (rows-1), and single-interior (length 1 when
// rows >= 2, answering for r === 1).
export function entryAtH(
  edgesH: HEdgeEntry[][] | null,
  rows: number,
  r: number,
  c: number,
): HEdgeEntry | undefined {
  if (!edgesH) return undefined;
  if (edgesH.length === rows + 1) {
    return (edgesH[r] && edgesH[r][c]) as HEdgeEntry | undefined;
  } else if (edgesH.length === Math.max(0, rows - 1)) {
    // interior boundaries map r in [1..rows-1] to edgesH[r-1]
    if (r >= 1 && r <= rows - 1) {
      return (edgesH[r - 1] && edgesH[r - 1][c]) as HEdgeEntry | undefined;
    }
  } else if (edgesH.length === 1 && rows >= 2) {
    // Single interior boundary row, applies when r === 1
    if (r === 1) {
      return (edgesH[0] && edgesH[0][c]) as HEdgeEntry | undefined;
    }
  }
  return undefined;
}
