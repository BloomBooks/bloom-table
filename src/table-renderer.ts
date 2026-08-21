// Renderer core: converts data-* model to inline styles (no structure mutations)
import {
  getEdgesH,
  getEdgesV,
  getEdgeDefault,
  getTableCorners,
  getCellCorners,
  getGapX,
  getGapY,
  type BorderSpec,
} from "./table-model";
import { EDGE_DEFAULT } from "./defaults";
import type { HEdgeEntry, VEdgeEntry } from "./table-model";
import { entryAtV, entryAtH, splitV, splitH, hasPositiveGap } from "./edge-entries";

const MIN_COLUMN_WIDTH = "60px";
const MIN_ROW_HEIGHT = "20px";

// Note: We avoid hardcoding defaults in the renderer. Instead, we read
// computed CSS variables from the table element so stylesheet defaults and
// table-level overrides participate via normal CSS precedence. Data-*
// attributes still represent explicit user intent and win over inherited
// styles.

function makeSizeRule(size: string, minimum: string): string {
  const s = (size || "").trim();
  if (s === "hug") return `minmax(${minimum},max-content)`;
  if (s === "fill") return `minmax(${minimum},1fr)`;
  return s;
}

function getAttrList(el: HTMLElement, name: string): string[] {
  const raw = el.getAttribute(name) || "";
  if (raw === "") return [];
  return raw.split(",");
}

function getCells(table: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  Array.from(table.children).forEach((child) => {
    if (child instanceof HTMLElement && child.classList.contains("bloom-cell")) {
      result.push(child);
    }
  });
  return result;
}

// --- Helpers for reading CSS-derived defaults and normalizing specs ---
//

// Defaults can come from data-border-default or CSS variables on the table element.

function normalize(
  spec: BorderSpec | (Partial<BorderSpec> & Record<string, any>) | null | undefined,
): BorderSpec | null {
  if (!spec) return null;
  // If explicitly 'none', return a normalized none edge
  if ((spec as any).style === "none") {
    return { weight: 0, style: "none", color: (spec as any).color || "#000" };
  }
  // Accept partials for conciseness: default to 1 solid black unless provided
  const hasAnyField =
    Object.prototype.hasOwnProperty.call(spec, "weight") ||
    Object.prototype.hasOwnProperty.call(spec, "style") ||
    Object.prototype.hasOwnProperty.call(spec, "color");
  if (!hasAnyField) return null;
  const weight = Number.isFinite((spec as any).weight) ? (spec as any).weight : 1;
  const style = (spec as any).style || "solid";
  const color = (spec as any).color || "#000";
  if (style === "none" || weight <= 0) {
    return { weight: 0, style: "none", color };
  }
  return { weight, style, color } as BorderSpec;
}

export interface RenderModel {
  columnWidths: string[]; // raw tokens from data-*
  rowHeights: string[]; // raw tokens from data-*
  templateColumns: string; // resolved table-template-columns
  templateRows: string; // resolved table-template-rows
  spans: Array<{ index: number; x: number; y: number }>; // DOM order
  // resolved per-cell per-side borders
  cellBorders: Array<{
    top?: BorderSpec | null;
    right?: BorderSpec | null;
    bottom?: BorderSpec | null;
    left?: BorderSpec | null;
  }>;
}

function stylePrecedence(style: string | undefined): number {
  switch (style) {
    case "double":
      return 4;
    case "solid":
      return 3;
    case "dashed":
      return 2;
    case "dotted":
      return 1;
    case "none":
    default:
      return 0;
  }
}

// The border spec an unspecified edge falls back to: data-border-default wins,
// else the --edge-default-* CSS variables on the table, else EDGE_DEFAULT.
// Exported so edge writers can materialize a neighbor's currently-rendered
// default when one cell withdraws its side of a shared boundary.
export function resolveEdgeDefault(table: HTMLElement): BorderSpec | null {
  const authored = normalize(getEdgeDefault(table));
  if (authored) return authored;
  const cs = getComputedStyle(table);
  let wRaw = cs.getPropertyValue("--edge-default-weight").trim();
  let sRaw = cs.getPropertyValue("--edge-default-style").trim();
  let cRaw = cs.getPropertyValue("--edge-default-color").trim();
  // jsdom may not propagate custom properties via computed style; fall back to inline style
  if (!wRaw) wRaw = table.style.getPropertyValue("--edge-default-weight").trim();
  if (!sRaw) sRaw = table.style.getPropertyValue("--edge-default-style").trim();
  if (!cRaw) cRaw = table.style.getPropertyValue("--edge-default-color").trim();
  if (wRaw || sRaw || cRaw) {
    const w = wRaw ? parseFloat(wRaw) : EDGE_DEFAULT.weight;
    const s = (sRaw || EDGE_DEFAULT.style) as BorderSpec["style"];
    const c = cRaw || EDGE_DEFAULT.color;
    return normalize({
      weight: isFinite(w) ? w : EDGE_DEFAULT.weight,
      style: s,
      color: c,
    });
  }
  // Fallback to TS defaults if CSS variables are not set
  return normalize({ ...EDGE_DEFAULT });
}

export function buildRenderModel(table: HTMLElement): RenderModel {
  const columnWidths = getAttrList(table, "data-column-widths");
  const rowHeights = getAttrList(table, "data-row-heights");

  const templateColumns = columnWidths.map((x) => makeSizeRule(x, MIN_COLUMN_WIDTH)).join(" ");
  const templateRows = rowHeights.map((x) => makeSizeRule(x, MIN_ROW_HEIGHT)).join(" ");

  const cells = getCells(table);
  const spans = cells.map((cell, index) => {
    const x = parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1;
    const y = parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1;
    return { index, x: Math.max(1, x), y: Math.max(1, y) };
  });

  // Initialize per-cell borders
  const cellBorders: RenderModel["cellBorders"] = cells.map(() => ({
    top: null,
    right: null,
    bottom: null,
    left: null,
  }));

  const rows = rowHeights.length;
  const cols = columnWidths.length;

  // Detect if this table is embedded inside a parent cell. If so, we suppress
  // its perimeter painting so that the shared boundary between the parent
  // cell and this nested table is represented by a single edge (the parent).
  // This keeps the mental model "one edge, one stroke" and avoids double 1px
  // borders showing side-by-side.
  const isNestedTable = !!(
    table.parentElement &&
    table.parentElement.classList &&
    table.parentElement.classList.contains("bloom-cell")
  );

  function idx(r: number, c: number): number {
    return r * cols + c;
  }

  // Map every grid position to the index of the cell that actually paints
  // there: itself normally, or the merge anchor when the position is covered by
  // a span. Covered positions hold .bloom-skip cells, which are display:none,
  // so a border written to one of them never appears on screen.
  const coverOf: number[] = [];
  for (let i = 0; i < rows * cols; i++) coverOf[i] = i;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(r, c);
      const cell = cells[i];
      if (!cell || cell.classList.contains("bloom-skip")) continue;
      const sx = spans[i] ? spans[i].x : 1;
      const sy = spans[i] ? spans[i].y : 1;
      if (sx === 1 && sy === 1) continue;
      for (let dr = 0; dr < sy && r + dr < rows; dr++) {
        for (let dc = 0; dc < sx && c + dc < cols; dc++) {
          coverOf[idx(r + dr, c + dc)] = i;
        }
      }
    }
  }
  const rowOf = (i: number): number => Math.floor(i / cols);
  const colOf = (i: number): number => i % cols;

  // Write a left/right side for grid position `pos`, routed to the cell that
  // paints there. A vertically merged region meets a vertical boundary in
  // several rows; only the anchor's own row writes, so the rows below cannot
  // overwrite what the anchor row resolved.
  function writeVSide(pos: number, side: "left" | "right", spec: BorderSpec | null): void {
    const t = coverOf[pos];
    if (!cells[t]) return;
    if (rowOf(pos) !== rowOf(t)) return;
    cellBorders[t][side] = spec;
  }
  // Same for top/bottom sides: only the anchor's own column writes.
  function writeHSide(pos: number, side: "top" | "bottom", spec: BorderSpec | null): void {
    const t = coverOf[pos];
    if (!cells[t]) return;
    if (colOf(pos) !== colOf(t)) return;
    cellBorders[t][side] = spec;
  }

  // Edge inputs
  const edgesH = getEdgesH(table) as HEdgeEntry[][] | null; // (R+1) x C of entries: interior rows 1..R-1, perimeters at 0 (top) and R (bottom)
  const edgesV = getEdgesV(table) as VEdgeEntry[][] | null; // R x (C+1) of entries: interior cols 1..C-1, perimeters at 0 (left) and C (right)
  const edgeDefault = resolveEdgeDefault(table);
  const gapX = getGapX(table);
  const gapY = getGapY(table);

  // Wrappers close over the parsed gap arrays; a single value applies to all boundaries.
  const hasPositiveGapX = (c: number): boolean => hasPositiveGap(gapX, c);
  const hasPositiveGapY = (r: number): boolean => hasPositiveGap(gapY, r);

  function borderScore(spec: BorderSpec | null | undefined): number[] {
    // Higher tuple wins lexicographically: [visible, weight, stylePrec].
    // A visible border beats an explicit 'none' (CSS collapsed-border rule):
    // one cell withdrawing its side of a shared edge must not erase a line
    // the neighbor explicitly wants. 'none' still beats the implicit default
    // because an explicit side always beats an absent one (see pickSide).
    const s = spec && spec.style ? spec.style : "none";
    const w = spec && Number.isFinite(spec.weight) ? spec.weight : 0;
    const visible = s !== "none" && w > 0 ? 1 : 0;
    return [visible, w, stylePrecedence(s)];
  }
  function pickSide(
    a: BorderSpec | null | undefined,
    b: BorderSpec | null | undefined,
    tieFavor: "leftTop" | "rightBottom",
  ): "a" | "b" | null {
    const aPresent = !!a;
    const bPresent = !!b;
    if (aPresent && !bPresent) return "a";
    if (!aPresent && bPresent) return "b";
    if (!aPresent && !bPresent) return null;
    const sa = borderScore(a);
    const sb = borderScore(b);
    if (sa[0] !== sb[0]) return sa[0] > sb[0] ? "a" : "b"; // visible beats 'none'
    if (sa[1] !== sb[1]) return sa[1] > sb[1] ? "a" : "b"; // weight
    if (sa[2] !== sb[2]) return sa[2] > sb[2] ? "a" : "b"; // style prec
    return tieFavor === "leftTop" ? "a" : "b";
  }

  // Helper to read a vertical edge entry at row r, at boundary c (0..cols).
  // Decoding lives in edge-entries (shared with the writers); normalize stays
  // renderer-local because the writers must NOT normalize what they store.
  function readV(r: number, c: number): { west: BorderSpec | null; east: BorderSpec | null } {
    const s = splitV(entryAtV(edgesV, cols, r, c));
    return { west: normalize(s.west), east: normalize(s.east) };
  }

  // Helper to read a horizontal edge entry at boundary r (0..rows), column c
  function readH(r: number, c: number): { north: BorderSpec | null; south: BorderSpec | null } {
    const s = splitH(entryAtH(edgesH, rows, r, c));
    return { north: normalize(s.north), south: normalize(s.south) };
  }

  function paintedSpec(spec: BorderSpec | null | undefined): boolean {
    return !!spec && spec.style !== "none" && spec.weight > 0;
  }

  // Whether cell (r,c) shows a visible stroke on its top/bottom side, resolved
  // the same way the passes below resolve it. Used by the zero-gap tie-break.
  function hSidePainted(r: number, c: number, which: "top" | "bottom"): boolean {
    const b = which === "top" ? r : r + 1;
    const { north, south } = readH(b, c);
    const facing = which === "top" ? south : north;
    if (b === 0 || b === rows) {
      return paintedSpec(facing ?? (isNestedTable ? null : edgeDefault));
    }
    if (hasPositiveGapY(b - 1)) return paintedSpec(facing ?? edgeDefault);
    const side = pickSide(north || null, south || null, "leftTop") ?? "a";
    return paintedSpec((side === "a" ? north : south) ?? edgeDefault);
  }

  // Same for the left/right sides of cell (r,c).
  function vSidePainted(r: number, c: number, which: "left" | "right"): boolean {
    const b = which === "left" ? c : c + 1;
    const { west, east } = readV(r, b);
    const facing = which === "left" ? east : west;
    if (b === 0 || b === cols) {
      return paintedSpec(facing ?? (isNestedTable ? null : edgeDefault));
    }
    if (hasPositiveGapX(b - 1)) return paintedSpec(facing ?? edgeDefault);
    const side = pickSide(west || null, east || null, "leftTop") ?? "a";
    return paintedSpec((side === "a" ? west : east) ?? edgeDefault);
  }

  // Resolve vertical inner edges (between c and c+1), boundary index b=c+1 in [1..cols-1]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const iLeft = idx(r, c);
      const iRight = idx(r, c + 1);
      if (!cells[iLeft] || !cells[iRight]) {
        // No corresponding cells (e.g., empty table shell): skip
        continue;
      }
      if (coverOf[iLeft] === coverOf[iRight]) {
        // Boundary interior to a merged region: no stroke belongs here.
        continue;
      }
      const { west, east } = readV(r, c + 1);
      const gap = hasPositiveGapX(c);
      if (gap) {
        // Sided painting: each side draws independently; use default for unspecified sides
        writeVSide(iLeft, "right", (west ?? edgeDefault) || null);
        writeVSide(iRight, "left", (east ?? edgeDefault) || null);
      } else {
        // Zero gap: resolve to a single stroke. On a tie, paint it on the
        // cell whose top/bottom sides are also stroked, so a corner radius
        // has same-element borders to curve into (a lone rounded border
        // otherwise curls into a floating bracket beside the neighbor).
        const a = west || null;
        const b = east || null;
        const scoreLeft =
          (hSidePainted(r, c, "top") ? 1 : 0) + (hSidePainted(r, c, "bottom") ? 1 : 0);
        const scoreRight =
          (hSidePainted(r, c + 1, "top") ? 1 : 0) + (hSidePainted(r, c + 1, "bottom") ? 1 : 0);
        const tieFavor = scoreRight > scoreLeft ? "rightBottom" : "leftTop";
        let side = pickSide(a, b, tieFavor);
        if (!side && edgeDefault) {
          // neither side provided; fall back to default on the favored side
          side = tieFavor === "rightBottom" ? "b" : "a";
        }
        if (!side) continue;
        const winner = side === "a" ? a || edgeDefault : b || edgeDefault;
        if (!winner) continue;
        // The losing side becomes null (the winner paints the stroke), except
        // an explicit 'none' is kept: it renders identically, but lets the
        // border UI read "this cell declined this side" instead of borrowing
        // the neighbor's line.
        if (side === "a") {
          writeVSide(iLeft, "right", winner);
          writeVSide(iRight, "left", b && b.style === "none" ? b : null);
        } else {
          writeVSide(iRight, "left", winner);
          writeVSide(iLeft, "right", a && a.style === "none" ? a : null);
        }
      }
    }
  }

  // Resolve horizontal inner edges (between r and r+1), boundary index b=r+1 in [1..rows-1]
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const iTop = idx(r, c);
      const iBottom = idx(r + 1, c);
      if (!cells[iTop] || !cells[iBottom]) {
        continue;
      }
      if (coverOf[iTop] === coverOf[iBottom]) {
        // Boundary interior to a merged region: no stroke belongs here.
        continue;
      }
      const { north, south } = readH(r + 1, c);
      const gap = hasPositiveGapY(r);
      if (gap) {
        // Use default for unspecified sides across gaps
        writeHSide(iTop, "bottom", (north ?? edgeDefault) || null);
        writeHSide(iBottom, "top", (south ?? edgeDefault) || null);
      } else {
        const a = north || null;
        const b = south || null;
        const scoreTop =
          (vSidePainted(r, c, "left") ? 1 : 0) + (vSidePainted(r, c, "right") ? 1 : 0);
        const scoreBottom =
          (vSidePainted(r + 1, c, "left") ? 1 : 0) + (vSidePainted(r + 1, c, "right") ? 1 : 0);
        const tieFavor = scoreBottom > scoreTop ? "rightBottom" : "leftTop";
        let side = pickSide(a, b, tieFavor);
        if (!side && edgeDefault) side = tieFavor === "rightBottom" ? "b" : "a";
        if (!side) continue;
        const winner = side === "a" ? a || edgeDefault : b || edgeDefault;
        if (!winner) continue;
        // As with vertical edges: keep an explicit 'none' on the losing side.
        if (side === "a") {
          writeHSide(iTop, "bottom", winner);
          writeHSide(iBottom, "top", b && b.style === "none" ? b : null);
        } else {
          writeHSide(iBottom, "top", winner);
          writeHSide(iTop, "bottom", a && a.style === "none" ? a : null);
        }
      }
    }
  }
  // Perimeter from unified H/V edges: apply per-cell sides directly
  // Note: Per design spec, defaults are "Not applied across gaps or to perimeters".
  // Additionally, when this table is nested inside a parent cell, we default to
  // no outer perimeter. However, if the author explicitly provides perimeter
  // edges in the H/V arrays, we honor those perimeters (without falling back to
  // edgeDefault for missing sides). Interior edges of the nested table are still
  // resolved above.
  {
    // Nested tables honor explicit perimeters only (no default fallback).
    const fallback = isNestedTable ? null : edgeDefault ?? null;
    // Top perimeter: H at r=0 - use south side (faces the cells)
    for (let c = 0; c < cols; c++) {
      const { south } = readH(0, c);
      writeHSide(idx(0, c), "top", south ?? fallback);
    }
    // Bottom perimeter: H at r=rows - use north side (faces the cells)
    for (let c = 0; c < cols; c++) {
      const { north } = readH(rows, c);
      writeHSide(idx(Math.max(0, rows - 1), c), "bottom", north ?? fallback);
    }
    // Left perimeter: V at c=0 - use east side (faces the cells)
    for (let r = 0; r < rows; r++) {
      const { east } = readV(r, 0);
      writeVSide(idx(r, 0), "left", east ?? fallback);
    }
    // Right perimeter: V at c=cols - use west side (faces the cells)
    for (let r = 0; r < rows; r++) {
      const { west } = readV(r, cols);
      writeVSide(idx(r, Math.max(0, cols - 1)), "right", west ?? fallback);
    }
  }

  return {
    columnWidths,
    rowHeights,
    templateColumns,
    templateRows,
    spans,
    cellBorders,
  };
}

export function render(table: HTMLElement): void {
  const model = buildRenderModel(table);

  // Apply table templates
  if (model.templateColumns) {
    table.style.gridTemplateColumns = model.templateColumns;
    table.style.setProperty("--table-column-count", String(model.columnWidths.length));
  }
  if (model.templateRows) {
    table.style.gridTemplateRows = model.templateRows;
    table.style.setProperty("--table-row-count", String(model.rowHeights.length));
  }

  // Apply visual grid gaps from the gap model. The CSS `gap` shorthand defaults to
  // `var(--gap, 0)`; here we set the per-axis longhands from data-gap-x / data-gap-y so
  // authored gaps actually produce spacing (previously they only influenced border
  // sided-painting). CSS grid gap is uniform per axis, so we use the first specified
  // value; per-boundary variation is still only honored by the border logic.
  const firstGap = (tokens: string[]): string | null => {
    for (const t of tokens) {
      const s = (t || "").trim();
      if (s && s !== "0" && s !== "0px") return s;
    }
    return null;
  };
  const colGap = firstGap(getGapX(table));
  const rowGap = firstGap(getGapY(table));
  if (colGap) table.style.columnGap = colGap;
  else table.style.removeProperty("column-gap");
  if (rowGap) table.style.rowGap = rowGap;
  else table.style.removeProperty("row-gap");

  // Apply spans via CSS variables (maintains compatibility with existing CSS)
  const cells = getCells(table);
  model.spans.forEach((s) => {
    const cell = cells[s.index];
    if (!cell) return;
    cell.style.setProperty("--span-x", String(s.x));
    cell.style.setProperty("--span-y", String(s.y));
  });

  // Helper function to check if all edges are identical
  // Removed outline optimization; always apply per-side borders.

  // Helper function to apply individual border sides
  function applyBorderSide(cell: HTMLElement, side: string, spec: BorderSpec | null | undefined) {
    if (spec) {
      // Clamp 'double' to at least 4px so the double lines are visible.
      // Do not clamp when weight is 0 or style is 'none'.
      const style = spec.style;
      const rawW = Number.isFinite((spec as any).weight) ? (spec as any).weight : 0;
      const effectiveW = style === "double" && rawW > 0 && rawW < 4 ? 4 : rawW;
      (cell.style as any)[`border${side}Width`] = `${effectiveW}px`;
      (cell.style as any)[`border${side}Style`] = style;
      (cell.style as any)[`border${side}Color`] = spec.color;
    } else {
      (cell.style as any)[`border${side}Width`] = "0";
      (cell.style as any)[`border${side}Style`] = "none";
    }
  }

  // Apply cell border styling using per-side CSS borders only
  cells.forEach((cell, i) => {
    const b = model.cellBorders[i] ?? {};
    // Apply individual border sides
    applyBorderSide(cell, "Top", b.top);
    applyBorderSide(cell, "Right", b.right);
    applyBorderSide(cell, "Bottom", b.bottom);
    applyBorderSide(cell, "Left", b.left);
  });

  // Apply per-cell horizontal text alignment from data-align. Cells are flex containers
  // centered by default; this sets the main-axis position (justify-content) and text-align
  // (for multi-line content). Absent attribute => default centering (properties cleared).
  const ALIGN_JUSTIFY: Record<string, string> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
  };
  const ALIGN_TEXT: Record<string, string> = { start: "left", center: "center", end: "right" };
  cells.forEach((cell) => {
    const a = cell.getAttribute("data-align") || "";
    if (ALIGN_JUSTIFY[a]) {
      cell.style.justifyContent = ALIGN_JUSTIFY[a];
      cell.style.textAlign = ALIGN_TEXT[a];
    } else {
      cell.style.removeProperty("justify-content");
      cell.style.removeProperty("text-align");
    }
  });

  // Apply per-cell padding override from data-pad (absent => stylesheet default).
  cells.forEach((cell) => {
    const pad = cell.getAttribute("data-pad");
    if (pad && pad.trim()) cell.style.padding = pad.trim();
    else cell.style.removeProperty("padding");
  });

  // Apply per-cell background from data-bg (absent => stylesheet default via --cell-bg).
  cells.forEach((cell) => {
    const bg = cell.getAttribute("data-bg");
    if (bg && bg.trim()) cell.style.setProperty("--this-bg", bg.trim());
    else cell.style.removeProperty("--this-bg");
  });

  // Apply table background from data-bg (absent => transparent via the stylesheet).
  const tableBg = table.getAttribute("data-bg");
  if (tableBg && tableBg.trim()) table.style.setProperty("--bg", tableBg.trim());
  else table.style.removeProperty("--bg");

  // Apply outer corner radii
  const corners = getTableCorners(table) ?? { radius: 0 };
  if (Number.isFinite(corners.radius)) {
    const radiusPx = `${corners.radius}px`;
    // set on table as well (background corner), noting outline may not round
    (table.style as any).borderRadius = radiusPx;
    const rows = model.rowHeights.length;
    const cols = model.columnWidths.length;
    const cellsArr = getCells(table);
    // reset all cell corner radii to default 0 first (ensures determinism across renders)
    cellsArr.forEach((cell) => {
      (cell.style as any).borderTopLeftRadius = "0px";
      (cell.style as any).borderTopRightRadius = "0px";
      (cell.style as any).borderBottomLeftRadius = "0px";
      (cell.style as any).borderBottomRightRadius = "0px";
    });
    const idx = (r: number, c: number) => r * cols + c;
    function setCorner(
      r: number,
      c: number,
      prop:
        | "borderTopLeftRadius"
        | "borderTopRightRadius"
        | "borderBottomLeftRadius"
        | "borderBottomRightRadius",
    ) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return;
      const i = idx(r, c);
      const cell = cellsArr[i];
      if (!cell) return;
      (cell.style as any)[prop] = radiusPx;
    }
    setCorner(0, 0, "borderTopLeftRadius");
    setCorner(0, Math.max(0, cols - 1), "borderTopRightRadius");
    setCorner(Math.max(0, rows - 1), 0, "borderBottomLeftRadius");
    setCorner(Math.max(0, rows - 1), Math.max(0, cols - 1), "borderBottomRightRadius");
  }

  // Per-cell corners: honor data-corners on individual cells. The model already exposes
  // get/setCellCorners; previously only table corners were rendered. A per-cell radius
  // rounds that cell's four corners (useful for standalone rounded boxes within a grid).
  getCells(table).forEach((cell) => {
    const cc = getCellCorners(cell);
    if (cc && Number.isFinite(cc.radius)) {
      const r = `${cc.radius}px`;
      (cell.style as any).borderTopLeftRadius = r;
      (cell.style as any).borderTopRightRadius = r;
      (cell.style as any).borderBottomLeftRadius = r;
      (cell.style as any).borderBottomRightRadius = r;
    }
  });

  // Nested tables: perimeters suppressed in buildRenderModel to avoid double borders with parent.

  // Boundary hints are pure CSS now: bloom-table-edit.css outlines every cell
  // faintly while the table is selected and the pointer is near it, so cells
  // with invisible borders stay findable during editing.
}
