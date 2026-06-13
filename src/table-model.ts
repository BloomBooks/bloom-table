export type BorderStyle = "none" | "solid" | "dashed" | "dotted" | "double";

export interface BorderSpec {
  weight: number; // pixels
  style: BorderStyle;
  color: string; // CSS color
}

export interface CornersSpec {
  radius: number; // pixels
}

export interface SpanSpec {
  x: number; // columns >=1
  y: number; // rows >=1
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseJSONAttr<T>(el: HTMLElement, name: string): T | null {
  const s = el.getAttribute(name);
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    throw new Error(`Invalid JSON in ${name}`);
  }
}

function setJSONAttr(el: HTMLElement, name: string, value: unknown | null) {
  if (value == null) {
    el.removeAttribute(name);
  } else {
    el.setAttribute(name, JSON.stringify(value));
  }
}

// Widths / Heights (lists)
export function getColumnWidths(table: HTMLElement): string[] {
  assert(table.classList.contains("bloom-table"), "getColumnWidths: not a table");
  const v = table.getAttribute("data-column-widths") || "";
  return v === "" ? [] : v.split(",");
}

export function setColumnWidths(table: HTMLElement, widths: string[]): void {
  assert(table.classList.contains("bloom-table"), "setColumnWidths: not a table");
  table.setAttribute("data-column-widths", widths.join(","));
}

export function getRowHeights(table: HTMLElement): string[] {
  assert(table.classList.contains("bloom-table"), "getRowHeights: not a table");
  const v = table.getAttribute("data-row-heights") || "";
  return v === "" ? [] : v.split(",");
}

export function setRowHeights(table: HTMLElement, heights: string[]): void {
  assert(table.classList.contains("bloom-table"), "setRowHeights: not a table");
  table.setAttribute("data-row-heights", heights.join(","));
}

// Spans
export function getSpan(cell: HTMLElement): SpanSpec {
  assert(cell.classList.contains("bloom-cell"), "getSpan: not a cell");
  const x = parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1;
  const y = parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1;
  return { x: Math.max(1, x), y: Math.max(1, y) };
}

export function setSpan(cell: HTMLElement, span: SpanSpec): void {
  assert(cell.classList.contains("bloom-cell"), "setSpan: not a cell");
  assert(span.x >= 1 && span.y >= 1, "setSpan: span must be >=1");
  cell.setAttribute("data-span-x", String(span.x));
  cell.setAttribute("data-span-y", String(span.y));
}

// Borders
// Deprecated per-cell/table border side APIs have been removed in favor of unified edge arrays.

// Edge-based model
export interface HVHorizontalEdgeCellSides {
  north?: BorderSpec | null;
  south?: BorderSpec | null;
}
export interface HVVerticalEdgeCellSides {
  west?: BorderSpec | null;
  east?: BorderSpec | null;
}
// A single interior edge can be represented either as sided entries (west/east or north/south)
// or as a single BorderSpec applied to the edge. This enables simpler authoring when there is no gap.
export type VEdgeEntry = HVVerticalEdgeCellSides | BorderSpec | null;
export type HEdgeEntry = HVHorizontalEdgeCellSides | BorderSpec | null;

// Defaults and gaps
export type EdgeDefaultSpec = BorderSpec | null; // data-border-default

export function getGapX(table: HTMLElement): string[] {
  assert(table.classList.contains("bloom-table"), "getGapX: not a table");
  const v = (table.getAttribute("data-gap-x") || "").trim();
  if (!v) return [];
  return v.split(",").map((s) => s.trim());
}
export function setGapX(table: HTMLElement, gaps: string[] | string): void {
  assert(table.classList.contains("bloom-table"), "setGapX: not a table");
  const v = Array.isArray(gaps) ? gaps.join(",") : gaps;
  table.setAttribute("data-gap-x", v);
}
export function getGapY(table: HTMLElement): string[] {
  assert(table.classList.contains("bloom-table"), "getGapY: not a table");
  const v = (table.getAttribute("data-gap-y") || "").trim();
  if (!v) return [];
  return v.split(",").map((s) => s.trim());
}
export function setGapY(table: HTMLElement, gaps: string[] | string): void {
  assert(table.classList.contains("bloom-table"), "setGapY: not a table");
  const v = Array.isArray(gaps) ? gaps.join(",") : gaps;
  table.setAttribute("data-gap-y", v);
}

export function getEdgesH(table: HTMLElement): HEdgeEntry[][] | null {
  assert(table.classList.contains("bloom-table"), "getEdgesH: not a table");
  return parseJSONAttr<HEdgeEntry[][]>(table, "data-edges-h");
}
export function setEdgesH(table: HTMLElement, edges: HEdgeEntry[][] | null): void {
  assert(table.classList.contains("bloom-table"), "setEdgesH: not a table");
  setJSONAttr(table, "data-edges-h", edges);
}

export function getEdgesV(table: HTMLElement): VEdgeEntry[][] | null {
  assert(table.classList.contains("bloom-table"), "getEdgesV: not a table");
  return parseJSONAttr<VEdgeEntry[][]>(table, "data-edges-v");
}
export function setEdgesV(table: HTMLElement, edges: VEdgeEntry[][] | null): void {
  assert(table.classList.contains("bloom-table"), "setEdgesV: not a table");
  setJSONAttr(table, "data-edges-v", edges);
}

export function getEdgeDefault(table: HTMLElement): EdgeDefaultSpec {
  assert(table.classList.contains("bloom-table"), "getEdgeDefault: not a table");
  return parseJSONAttr<BorderSpec>(table, "data-border-default");
}
export function setEdgeDefault(table: HTMLElement, border: EdgeDefaultSpec): void {
  assert(table.classList.contains("bloom-table"), "setEdgeDefault: not a table");
  setJSONAttr(table, "data-border-default", border);
}

// (Deprecated table/cell border APIs removed; use unified edge model via get/setEdgesH/V and get/setEdgeDefault.)

// Horizontal text alignment within a cell. Default (no attribute) is center, matching the
// structural CSS. "start"/"end" are writing-direction aware (left/right in LTR).
export type CellAlign = "start" | "center" | "end";

export function getCellAlign(cell: HTMLElement): CellAlign | null {
  assert(cell.classList.contains("bloom-cell"), "getCellAlign: not a cell");
  const v = cell.getAttribute("data-align");
  return v === "start" || v === "center" || v === "end" ? v : null;
}

export function setCellAlign(cell: HTMLElement, align: CellAlign | null): void {
  assert(cell.classList.contains("bloom-cell"), "setCellAlign: not a cell");
  if (!align) cell.removeAttribute("data-align");
  else cell.setAttribute("data-align", align);
}

// Per-cell padding override (CSS padding shorthand string, e.g. "6px 16px"). Absent => the
// stylesheet default (--cell-padding). Rendered as inline padding so it wins over the default.
export function getCellPadding(cell: HTMLElement): string | null {
  assert(cell.classList.contains("bloom-cell"), "getCellPadding: not a cell");
  const v = cell.getAttribute("data-pad");
  return v && v.trim() ? v.trim() : null;
}

export function setCellPadding(cell: HTMLElement, padding: string | null): void {
  assert(cell.classList.contains("bloom-cell"), "setCellPadding: not a cell");
  if (!padding || !padding.trim()) cell.removeAttribute("data-pad");
  else cell.setAttribute("data-pad", padding.trim());
}

// Corners
export function getTableCorners(table: HTMLElement): CornersSpec | null {
  assert(table.classList.contains("bloom-table"), "getTableCorners: not a table");
  return parseJSONAttr<CornersSpec>(table, "data-corners");
}

export function setTableCorners(table: HTMLElement, corners: CornersSpec | null): void {
  assert(table.classList.contains("bloom-table"), "setTableCorners: not a table");
  setJSONAttr(table, "data-corners", corners);
}

export function getCellCorners(cell: HTMLElement): CornersSpec | null {
  assert(cell.classList.contains("bloom-cell"), "getCellCorners: not a cell");
  return parseJSONAttr<CornersSpec>(cell, "data-corners");
}

export function setCellCorners(cell: HTMLElement, corners: CornersSpec | null): void {
  assert(cell.classList.contains("bloom-cell"), "setCellCorners: not a cell");
  setJSONAttr(cell, "data-corners", corners);
}
