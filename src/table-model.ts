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
  assert(table.classList.contains("table"), "getColumnWidths: not a table");
  const v = table.getAttribute("data-column-widths") || "";
  return v === "" ? [] : v.split(",");
}

export function setColumnWidths(table: HTMLElement, widths: string[]): void {
  assert(table.classList.contains("table"), "setColumnWidths: not a table");
  table.setAttribute("data-column-widths", widths.join(","));
}

export function getRowHeights(table: HTMLElement): string[] {
  assert(table.classList.contains("table"), "getRowHeights: not a table");
  const v = table.getAttribute("data-row-heights") || "";
  return v === "" ? [] : v.split(",");
}

export function setRowHeights(table: HTMLElement, heights: string[]): void {
  assert(table.classList.contains("table"), "setRowHeights: not a table");
  table.setAttribute("data-row-heights", heights.join(","));
}

// Spans
export function getSpan(cell: HTMLElement): SpanSpec {
  assert(cell.classList.contains("cell"), "getSpan: not a cell");
  const x = parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1;
  const y = parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1;
  return { x: Math.max(1, x), y: Math.max(1, y) };
}

export function setSpan(cell: HTMLElement, span: SpanSpec): void {
  assert(cell.classList.contains("cell"), "setSpan: not a cell");
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
  assert(table.classList.contains("table"), "getGapX: not a table");
  const v = (table.getAttribute("data-gap-x") || "").trim();
  if (!v) return [];
  return v.split(",").map((s) => s.trim());
}
export function setGapX(table: HTMLElement, gaps: string[] | string): void {
  assert(table.classList.contains("table"), "setGapX: not a table");
  const v = Array.isArray(gaps) ? gaps.join(",") : gaps;
  table.setAttribute("data-gap-x", v);
}
export function getGapY(table: HTMLElement): string[] {
  assert(table.classList.contains("table"), "getGapY: not a table");
  const v = (table.getAttribute("data-gap-y") || "").trim();
  if (!v) return [];
  return v.split(",").map((s) => s.trim());
}
export function setGapY(table: HTMLElement, gaps: string[] | string): void {
  assert(table.classList.contains("table"), "setGapY: not a table");
  const v = Array.isArray(gaps) ? gaps.join(",") : gaps;
  table.setAttribute("data-gap-y", v);
}

export function getEdgesH(table: HTMLElement): HEdgeEntry[][] | null {
  assert(table.classList.contains("table"), "getEdgesH: not a table");
  return parseJSONAttr<HEdgeEntry[][]>(table, "data-edges-h");
}
export function setEdgesH(table: HTMLElement, edges: HEdgeEntry[][] | null): void {
  assert(table.classList.contains("table"), "setEdgesH: not a table");
  setJSONAttr(table, "data-edges-h", edges);
}

export function getEdgesV(table: HTMLElement): VEdgeEntry[][] | null {
  assert(table.classList.contains("table"), "getEdgesV: not a table");
  return parseJSONAttr<VEdgeEntry[][]>(table, "data-edges-v");
}
export function setEdgesV(table: HTMLElement, edges: VEdgeEntry[][] | null): void {
  assert(table.classList.contains("table"), "setEdgesV: not a table");
  setJSONAttr(table, "data-edges-v", edges);
}

export function getEdgeDefault(table: HTMLElement): EdgeDefaultSpec {
  assert(table.classList.contains("table"), "getEdgeDefault: not a table");
  return parseJSONAttr<BorderSpec>(table, "data-border-default");
}
export function setEdgeDefault(table: HTMLElement, border: EdgeDefaultSpec): void {
  assert(table.classList.contains("table"), "setEdgeDefault: not a table");
  setJSONAttr(table, "data-border-default", border);
}

// (Deprecated table/cell border APIs removed; use unified edge model via get/setEdgesH/V and get/setEdgeDefault.)

// Corners
export function getTableCorners(table: HTMLElement): CornersSpec | null {
  assert(table.classList.contains("table"), "getTableCorners: not a table");
  return parseJSONAttr<CornersSpec>(table, "data-corners");
}

export function setTableCorners(table: HTMLElement, corners: CornersSpec | null): void {
  assert(table.classList.contains("table"), "setTableCorners: not a table");
  setJSONAttr(table, "data-corners", corners);
}

export function getCellCorners(cell: HTMLElement): CornersSpec | null {
  assert(cell.classList.contains("cell"), "getCellCorners: not a cell");
  return parseJSONAttr<CornersSpec>(cell, "data-corners");
}

export function setCellCorners(cell: HTMLElement, corners: CornersSpec | null): void {
  assert(cell.classList.contains("cell"), "setCellCorners: not a cell");
  setJSONAttr(cell, "data-corners", corners);
}
