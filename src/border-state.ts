import { buildRenderModel } from "./table-renderer";
import { EDGE_DEFAULT } from "./defaults";
import type {
  BorderStyle,
  BorderValueMap,
  BorderWeight,
} from "./components/BorderControl/logic/types";

const snapWeight = (w: number): BorderWeight => {
  if (w <= 0) return 0;
  if (w < 1.5) return 1;
  if (w < 3) return 2;
  return 4;
};

export function getTableOuterBorderValueMap(table: HTMLElement): BorderValueMap {
  const model = buildRenderModel(table);
  const rows = model.rowHeights.length;
  const cols = model.columnWidths.length;

  const idx = (r: number, c: number) => r * Math.max(1, cols) + c;
  const safe = <T>(v: T | undefined | null, d: T): T => (v == null ? d : v);

  const topLeft = model.cellBorders[idx(0, 0)] || {};
  const topRight = model.cellBorders[idx(0, Math.max(0, cols - 1))] || {};
  const bottomLeft = model.cellBorders[idx(Math.max(0, rows - 1), 0)] || {};

  const toOuter = (spec: any): { weight: BorderWeight; style: BorderStyle } => {
    const w = snapWeight(Number.isFinite(spec?.weight) ? spec.weight : 0);
    let style: BorderStyle;
    if (w === 0) {
      style = "none";
    } else if (spec?.style) {
      style = spec.style as BorderStyle;
    } else {
      // Last resort: use TS default style to avoid inventing a third source here
      style = EDGE_DEFAULT.style as BorderStyle;
    }
    return { weight: w, style };
  };

  // Derive representative inner edges from the render model (zero-gap case assigns to one side):
  // - innerH: sample bottom of the top-left cell if there is at least 2 rows
  // - innerV: sample right of the top-left cell if there is at least 2 cols
  const sampleInnerH = () => {
    if (rows >= 2 && cols >= 1) {
      const spec = (model.cellBorders[idx(0, 0)] || {}).bottom as any;
      if (spec) return spec;
    }
    return { weight: EDGE_DEFAULT.weight, style: EDGE_DEFAULT.style } as any;
  };
  const sampleInnerV = () => {
    if (cols >= 2 && rows >= 1) {
      const spec = (model.cellBorders[idx(0, 0)] || {}).right as any;
      if (spec) return spec;
    }
    return { weight: EDGE_DEFAULT.weight, style: EDGE_DEFAULT.style } as any;
  };

  return {
    top: { ...toOuter(safe(topLeft.top, null)), radius: 0 },
    right: { ...toOuter(safe(topRight.right, null)), radius: 0 },
    bottom: { ...toOuter(safe(bottomLeft.bottom, null)), radius: 0 },
    left: { ...toOuter(safe(topLeft.left, null)), radius: 0 },
    innerH: { ...toOuter(sampleInnerH()), radius: 0 },
    innerV: { ...toOuter(sampleInnerV()), radius: 0 },
  };
}

// Resolve a cell's four perimeter edge specs from the render model, borrowing
// the neighbor-owned spec for shared inner edges this cell's side leaves
// unset. Returns null when the cell isn't in a table.
function resolveCellPerimeterSpecs(
  cell: HTMLElement,
): { top: any; right: any; bottom: any; left: any } | null {
  const table = cell.closest(".bloom-table") as HTMLElement | null;
  if (!table) return null;
  const model = buildRenderModel(table);
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  const index = cells.indexOf(cell);
  const rows = model.rowHeights.length;
  const cols = model.columnWidths.length;
  const r = Math.floor(index / Math.max(1, cols));
  const c = index % Math.max(1, cols);
  const inBounds = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < rows && cc < cols;
  const idx = (rr: number, cc: number) => rr * Math.max(1, cols) + cc;
  const sides = model.cellBorders[index] || {};
  return {
    top:
      sides.top ?? (inBounds(r - 1, c) ? (model.cellBorders[idx(r - 1, c)]?.bottom ?? null) : null),
    right:
      sides.right ?? (inBounds(r, c + 1) ? (model.cellBorders[idx(r, c + 1)]?.left ?? null) : null),
    bottom:
      sides.bottom ?? (inBounds(r + 1, c) ? (model.cellBorders[idx(r + 1, c)]?.top ?? null) : null),
    left:
      sides.left ?? (inBounds(r, c - 1) ? (model.cellBorders[idx(r, c - 1)]?.right ?? null) : null),
  };
}

export function getCellPerimeterValueMap(cell: HTMLElement): BorderValueMap {
  const specs = resolveCellPerimeterSpecs(cell);
  if (!specs) {
    return {
      top: { weight: 0, style: "none", radius: 0 },
      right: { weight: 0, style: "none", radius: 0 },
      bottom: { weight: 0, style: "none", radius: 0 },
      left: { weight: 0, style: "none", radius: 0 },
      innerH: { weight: 0, style: "none", radius: 0 },
      innerV: { weight: 0, style: "none", radius: 0 },
    } as BorderValueMap;
  }
  const toOuter = (spec: any): { weight: BorderWeight; style: BorderStyle } => {
    const w = snapWeight(Number.isFinite(spec?.weight) ? spec.weight : 0);
    let style: BorderStyle;
    if (w === 0) style = "none";
    else if (spec?.style) style = spec.style as BorderStyle;
    else style = EDGE_DEFAULT.style as BorderStyle;
    return { weight: w, style };
  };
  return {
    top: { ...toOuter(specs.top), radius: 0 },
    right: { ...toOuter(specs.right), radius: 0 },
    bottom: { ...toOuter(specs.bottom), radius: 0 },
    left: { ...toOuter(specs.left), radius: 0 },
    innerH: { weight: 0, style: "none", radius: 0 },
    innerV: { weight: 0, style: "none", radius: 0 },
  };
}

/** Per-edge colors of a cell's perimeter, resolved the same way as
 *  getCellPerimeterValueMap. An edge with no explicit color (or an invisible
 *  edge) yields null, so callers can fall back per edge instead of flattening
 *  a multi-colored perimeter to one color. */
export function getCellPerimeterColors(cell: HTMLElement): {
  top: string | null;
  right: string | null;
  bottom: string | null;
  left: string | null;
} {
  const specs = resolveCellPerimeterSpecs(cell);
  const colorOf = (spec: any): string | null =>
    spec && typeof spec.color === "string" && spec.color ? spec.color : null;
  return {
    top: colorOf(specs?.top),
    right: colorOf(specs?.right),
    bottom: colorOf(specs?.bottom),
    left: colorOf(specs?.left),
  };
}
