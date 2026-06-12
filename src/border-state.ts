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

export function getCellPerimeterValueMap(cell: HTMLElement): BorderValueMap {
  const table = cell.closest(".table") as HTMLElement | null;
  if (!table) {
    return {
      top: { weight: 0, style: "none", radius: 0 },
      right: { weight: 0, style: "none", radius: 0 },
      bottom: { weight: 0, style: "none", radius: 0 },
      left: { weight: 0, style: "none", radius: 0 },
      innerH: { weight: 0, style: "none", radius: 0 },
      innerV: { weight: 0, style: "none", radius: 0 },
    } as BorderValueMap;
  }
  const model = buildRenderModel(table);
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("cell"),
  );
  const index = cells.indexOf(cell);
  const rows = model.rowHeights.length;
  const cols = model.columnWidths.length;
  const toRC = (i: number) => ({
    r: Math.floor(i / Math.max(1, cols)),
    c: i % Math.max(1, cols),
  });
  const { r, c } = toRC(index);
  const inBounds = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < rows && cc < cols;
  const idx = (rr: number, cc: number) => rr * Math.max(1, cols) + cc;
  const toOuter = (spec: any): { weight: BorderWeight; style: BorderStyle } => {
    const w = snapWeight(Number.isFinite(spec?.weight) ? spec.weight : 0);
    let style: BorderStyle;
    if (w === 0) style = "none";
    else if (spec?.style) style = spec.style as BorderStyle;
    else style = EDGE_DEFAULT.style as BorderStyle;
    return { weight: w, style };
  };
  const sides = model.cellBorders[index] || {};
  // Union with neighbor-owned inner edges when this cell's side is unset
  const topSpec =
    sides.top ?? (inBounds(r - 1, c) ? (model.cellBorders[idx(r - 1, c)]?.bottom ?? null) : null);
  const rightSpec =
    sides.right ?? (inBounds(r, c + 1) ? (model.cellBorders[idx(r, c + 1)]?.left ?? null) : null);
  const bottomSpec =
    sides.bottom ?? (inBounds(r + 1, c) ? (model.cellBorders[idx(r + 1, c)]?.top ?? null) : null);
  const leftSpec =
    sides.left ?? (inBounds(r, c - 1) ? (model.cellBorders[idx(r, c - 1)]?.right ?? null) : null);
  return {
    top: { ...toOuter(topSpec), radius: 0 },
    right: { ...toOuter(rightSpec), radius: 0 },
    bottom: { ...toOuter(bottomSpec), radius: 0 },
    left: { ...toOuter(leftSpec), radius: 0 },
    innerH: { weight: 0, style: "none", radius: 0 },
    innerV: { weight: 0, style: "none", radius: 0 },
  };
}
