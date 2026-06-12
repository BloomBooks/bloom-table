// Renderer core: converts data-* model to inline styles (no structure mutations)
import {
  getEdgesH,
  getEdgesV,
  getEdgeDefault,
  getTableCorners,
  getGapX,
  getGapY,
  type BorderSpec,
} from "./table-model";
import { EDGE_DEFAULT } from "./defaults";
import type {
  HEdgeEntry,
  VEdgeEntry,
  HVHorizontalEdgeCellSides,
  HVVerticalEdgeCellSides,
} from "./table-model";

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
    if (child instanceof HTMLElement && child.classList.contains("cell")) {
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

//

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
    table.parentElement.classList.contains("cell")
  );

  function idx(r: number, c: number): number {
    return r * cols + c;
  }

  // Edge inputs
  const edgesH = getEdgesH(table) as HEdgeEntry[][] | null; // (R+1) x C of entries: interior rows 1..R-1, perimeters at 0 (top) and R (bottom)
  const edgesV = getEdgesV(table) as VEdgeEntry[][] | null; // R x (C+1) of entries: interior cols 1..C-1, perimeters at 0 (left) and C (right)
  // Discover default edge: data-border-default wins; else read CSS vars on table
  let edgeDefault = normalize(getEdgeDefault(table));
  if (!edgeDefault) {
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
      edgeDefault = normalize({
        weight: isFinite(w) ? w : EDGE_DEFAULT.weight,
        style: s,
        color: c,
      });
    } else {
      // Fallback to TS defaults if CSS variables are not set
      edgeDefault = normalize({ ...EDGE_DEFAULT });
    }
  }
  const gapX = getGapX(table);
  const gapY = getGapY(table);

  function hasPositiveGapX(c: number): boolean {
    // Allow a single value to apply to all boundaries, or provide per-boundary values
    const gi = Math.min(Math.max(0, c), Math.max(0, (gapX.length || 1) - 1));
    const token = (gapX[gi] || "").trim();
    if (!token) return false;
    const n = parseFloat(token);
    if (!isNaN(n)) return n > 0;
    return token !== "0" && token !== "0px"; // basic fallback
  }
  function hasPositiveGapY(r: number): boolean {
    const gi = Math.min(Math.max(0, r), Math.max(0, (gapY.length || 1) - 1));
    const token = (gapY[gi] || "").trim();
    if (!token) return false;
    const n = parseFloat(token);
    if (!isNaN(n)) return n > 0;
    return token !== "0" && token !== "0px";
  }

  function borderScore(spec: BorderSpec | null | undefined): number[] {
    // Higher tuple wins lexicographically: [noneWins, weight, stylePrec]
    // We treat 'none' as dominating any other style per rule
    const s = spec && spec.style ? spec.style : "none";
    const w = spec && Number.isFinite(spec.weight) ? spec.weight : 0;
    const noneWin = s === "none" ? 1 : 0;
    return [noneWin, w, stylePrecedence(s)];
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
    if (sa[0] !== sb[0]) return sa[0] > sb[0] ? "a" : "b"; // 'none' wins
    if (sa[1] !== sb[1]) return sa[1] > sb[1] ? "a" : "b"; // weight
    if (sa[2] !== sb[2]) return sa[2] > sb[2] ? "a" : "b"; // style prec
    return tieFavor === "leftTop" ? "a" : "b";
  }

  // Helper to read a vertical edge entry at row r, at boundary c (0..cols)
  function readV(r: number, c: number): { west: BorderSpec | null; east: BorderSpec | null } {
    const row: VEdgeEntry[] | undefined = (edgesV && (edgesV[r] as VEdgeEntry[])) || undefined;
    let e: VEdgeEntry | undefined;
    if (row) {
      // Support either full (cols+1) entries including perimeters
      // or concise interior-only arrays of length (cols-1)
      if (row.length === cols + 1) {
        e = row[c];
      } else if (row.length === Math.max(0, cols - 1)) {
        // interior boundaries map c in [1..cols-1] to row[c-1]
        if (c >= 1 && c <= cols - 1) e = row[c - 1];
      } else if (row.length === 1 && cols >= 2) {
        // Special case: single interior boundary (e.g., 1x2 table)
        if (c === 1) e = row[0];
      }
    }
    let west: BorderSpec | null = null;
    let east: BorderSpec | null = null;
    const isBorderSpec =
      e &&
      typeof e === "object" &&
      (typeof (e as any).weight === "number" ||
        Object.prototype.hasOwnProperty.call(e as any, "style") ||
        Object.prototype.hasOwnProperty.call(e as any, "color"));
    if (isBorderSpec) {
      const spec = normalize(e as BorderSpec);
      west = spec;
      east = spec;
    } else {
      const sv = (e as HVVerticalEdgeCellSides | undefined) ?? undefined;
      west = normalize(sv?.west ?? null);
      east = normalize(sv?.east ?? null);
    }
    return { west, east };
  }

  // Helper to read a horizontal edge entry at boundary r (0..rows), column c
  function readH(r: number, c: number): { north: BorderSpec | null; south: BorderSpec | null } {
    const rowsCount = rowHeights.length;
    let e: HEdgeEntry | undefined;
    if (edgesH) {
      const full = edgesH.length === rowsCount + 1;
      const interiorOnly = edgesH.length === Math.max(0, rowsCount - 1);
      const singleInterior = edgesH.length === 1 && rowsCount >= 2;
      if (full) {
        e = (edgesH[r] && (edgesH[r][c] as HEdgeEntry)) as HEdgeEntry | undefined;
      } else if (interiorOnly) {
        // interior boundaries map r in [1..rows-1] to edgesH[r-1]
        if (r >= 1 && r <= rowsCount - 1) {
          const rr = r - 1;
          e = (edgesH[rr] && (edgesH[rr][c] as HEdgeEntry)) as HEdgeEntry | undefined;
        }
      } else if (singleInterior) {
        // Single interior boundary row, applies when r===1
        if (r === 1) {
          e = (edgesH[0] && (edgesH[0][c] as HEdgeEntry)) as HEdgeEntry | undefined;
        }
      }
    }
    let north: BorderSpec | null = null;
    let south: BorderSpec | null = null;
    const isBorderSpec =
      e &&
      typeof e === "object" &&
      (typeof (e as any).weight === "number" ||
        Object.prototype.hasOwnProperty.call(e as any, "style") ||
        Object.prototype.hasOwnProperty.call(e as any, "color"));
    if (isBorderSpec) {
      const spec = normalize(e as BorderSpec);
      north = spec;
      south = spec;
    } else {
      const sh = (e as HVHorizontalEdgeCellSides | undefined) ?? undefined;
      north = normalize(sh?.north ?? null);
      south = normalize(sh?.south ?? null);
    }
    return { north, south };
  }

  // Resolve vertical inner edges (between c and c+1), boundary index b=c+1 in [1..cols-1]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const iLeft = idx(r, c);
      const iRight = idx(r, c + 1);
      const leftCell = cells[iLeft];
      const rightCell = cells[iRight];
      if (!leftCell || !rightCell) {
        // No corresponding cells (e.g., empty table shell): skip
        continue;
      }
      const leftIsSkip = leftCell.classList.contains("skip");
      const rightIsSkip = rightCell.classList.contains("skip");
      const { west, east } = readV(r, c + 1);
      const gap = hasPositiveGapX(c);
      if (gap) {
        // Sided painting: each side draws independently; use default for unspecified sides
        if (!leftIsSkip) cellBorders[iLeft].right = (west ?? edgeDefault) || null;
        if (!rightIsSkip) cellBorders[iRight].left = (east ?? edgeDefault) || null;
      } else {
        // Zero gap: resolve to a single stroke
        const a = west || null;
        const b = east || null;
        let side = pickSide(a, b, "leftTop");
        if (!side && edgeDefault) {
          // neither side provided; fall back to default on left
          side = "a";
        }
        if (!side) continue;
        const winner = side === "a" ? a || edgeDefault : b || edgeDefault;
        if (!winner) continue;
        if (side === "a") {
          if (!leftIsSkip) cellBorders[iLeft].right = winner;
          if (!rightIsSkip) cellBorders[iRight].left = null;
        } else {
          if (!rightIsSkip) cellBorders[iRight].left = winner;
          if (!leftIsSkip) cellBorders[iLeft].right = null;
        }
      }
    }
  }

  // Resolve horizontal inner edges (between r and r+1), boundary index b=r+1 in [1..rows-1]
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const iTop = idx(r, c);
      const iBottom = idx(r + 1, c);
      const topCell = cells[iTop];
      const bottomCell = cells[iBottom];
      if (!topCell || !bottomCell) {
        continue;
      }
      const topIsSkip = topCell.classList.contains("skip");
      const bottomIsSkip = bottomCell.classList.contains("skip");
      const { north, south } = readH(r + 1, c);
      const gap = hasPositiveGapY(r);
      if (gap) {
        // Use default for unspecified sides across gaps
        if (!topIsSkip) cellBorders[iTop].bottom = (north ?? edgeDefault) || null;
        if (!bottomIsSkip) cellBorders[iBottom].top = (south ?? edgeDefault) || null;
      } else {
        const a = north || null;
        const b = south || null;
        let side = pickSide(a, b, "leftTop");
        if (!side && edgeDefault) side = "a";
        if (!side) continue;
        const winner = side === "a" ? a || edgeDefault : b || edgeDefault;
        if (!winner) continue;
        if (side === "a") {
          if (!topIsSkip) cellBorders[iTop].bottom = winner;
          if (!bottomIsSkip) cellBorders[iBottom].top = null;
        } else {
          if (!bottomIsSkip) cellBorders[iBottom].top = winner;
          if (!topIsSkip) cellBorders[iTop].bottom = null;
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
  if (!isNestedTable) {
    // Top perimeter: H at r=0 - use south side (faces the cells)
    for (let c = 0; c < cols; c++) {
      const { south } = readH(0, c);
      const i = idx(0, c);
      if (cells[i]) {
        cellBorders[i].top = south ?? edgeDefault ?? null;
      }
    }
    // Bottom perimeter: H at r=rows - use north side (faces the cells)
    for (let c = 0; c < cols; c++) {
      const { north } = readH(rows, c);
      const i = idx(Math.max(0, rows - 1), c);
      if (cells[i]) {
        cellBorders[i].bottom = north ?? edgeDefault ?? null;
      }
    }
    // Left perimeter: V at c=0 - use east side (faces the cells)
    for (let r = 0; r < rows; r++) {
      const { east } = readV(r, 0);
      const i = idx(r, 0);
      if (cells[i]) {
        cellBorders[i].left = east ?? edgeDefault ?? null;
      }
    }
    // Right perimeter: V at c=cols - use west side (faces the cells)
    for (let r = 0; r < rows; r++) {
      const { west } = readV(r, cols);
      const i = idx(r, Math.max(0, cols - 1));
      if (cells[i]) {
        cellBorders[i].right = west ?? edgeDefault ?? null;
      }
    }
  } else {
    // Honor explicit perimeters only (no default fallback)
    // Top perimeter: H at r=0 - use south side (faces the cells)
    for (let c = 0; c < cols; c++) {
      const { south } = readH(0, c);
      const i = idx(0, c);
      if (cells[i]) {
        cellBorders[i].top = south ?? null;
      }
    }
    // Bottom perimeter: H at r=rows - use north side (faces the cells)
    for (let c = 0; c < cols; c++) {
      const { north } = readH(rows, c);
      const i = idx(Math.max(0, rows - 1), c);
      if (cells[i]) {
        cellBorders[i].bottom = north ?? null;
      }
    }
    // Left perimeter: V at c=0 - use east side (faces the cells)
    for (let r = 0; r < rows; r++) {
      const { east } = readV(r, 0);
      const i = idx(r, 0);
      if (cells[i]) {
        cellBorders[i].left = east ?? null;
      }
    }
    // Right perimeter: V at c=cols - use west side (faces the cells)
    for (let r = 0; r < rows; r++) {
      const { west } = readV(r, cols);
      const i = idx(r, Math.max(0, cols - 1));
      if (cells[i]) {
        cellBorders[i].right = west ?? null;
      }
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
    // Reset hint colors (computed below)
    cell.style.removeProperty("--hint-top-color");
    cell.style.removeProperty("--hint-right-color");
    cell.style.removeProperty("--hint-bottom-color");
    cell.style.removeProperty("--hint-left-color");
  });

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

  // Nested tables: perimeters suppressed in buildRenderModel to avoid double borders with parent.

  // Subtle boundary hints: show only where both sides are effectively none.
  // Helper to check if a rendered spec is effectively none.
  const isNone = (spec: BorderSpec | null | undefined) => {
    if (!spec) return true;
    if (spec.style === "none") return true;
    const w = Number.isFinite((spec as any).weight) ? (spec as any).weight : 0;
    return !w || w <= 0;
  };

  const rows = model.rowHeights.length;
  const cols = model.columnWidths.length;
  const idx = (r: number, c: number) => r * cols + c;

  // Vertical inner boundaries: paint hint on the left cell's right side when both sides are none
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const iLeft = idx(r, c);
      const iRight = idx(r, c + 1);
      const left = model.cellBorders[iLeft]?.right;
      const right = model.cellBorders[iRight]?.left;
      if (isNone(left) && isNone(right)) {
        const cell = cells[iLeft];
        if (cell) cell.style.setProperty("--hint-right-color", "var(--table-hint-color)");
      }
    }
  }

  // Horizontal inner boundaries: paint hint on the top cell's bottom side when both sides are none
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const iTop = idx(r, c);
      const iBottom = idx(r + 1, c);
      const top = model.cellBorders[iTop]?.bottom;
      const bottom = model.cellBorders[iBottom]?.top;
      if (isNone(top) && isNone(bottom)) {
        const cell = cells[iTop];
        if (cell) cell.style.setProperty("--hint-bottom-color", "var(--table-hint-color)");
      }
    }
  }

  // Perimeters: paint hint on perimeters where the side is none
  // Top row
  for (let c = 0; c < cols; c++) {
    const i = idx(0, c);
    const spec = model.cellBorders[i]?.top;
    if (isNone(spec)) {
      const cell = cells[i];
      if (cell) cell.style.setProperty("--hint-top-color", "var(--table-hint-color)");
    }
  }
  // Bottom row
  for (let c = 0; c < cols; c++) {
    const i = idx(Math.max(0, rows - 1), c);
    const spec = model.cellBorders[i]?.bottom;
    if (isNone(spec)) {
      const cell = cells[i];
      if (cell) cell.style.setProperty("--hint-bottom-color", "var(--table-hint-color)");
    }
  }
  // Left col
  for (let r = 0; r < rows; r++) {
    const i = idx(r, 0);
    const spec = model.cellBorders[i]?.left;
    if (isNone(spec)) {
      const cell = cells[i];
      if (cell) cell.style.setProperty("--hint-left-color", "var(--table-hint-color)");
    }
  }
  // Right col
  for (let r = 0; r < rows; r++) {
    const i = idx(r, Math.max(0, cols - 1));
    const spec = model.cellBorders[i]?.right;
    if (isNone(spec)) {
      const cell = cells[i];
      if (cell) cell.style.setProperty("--hint-right-color", "var(--table-hint-color)");
    }
  }
}
