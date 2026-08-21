import { buildRenderModel } from "./table-renderer";
import { getTableCells } from "./structure";
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

const isPaintedSpec = (spec: any): boolean =>
  !!spec && spec.style !== "none" && Number(spec.weight) > 0;

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

  // Derive representative inner edges from the render model. With no gap the
  // renderer resolves a shared boundary onto ONE of the two cells and keeps an
  // explicit 'none' on the loser (so the cell panel can say "this cell declined
  // its half"), so one cell's side says nothing about whether the boundary
  // paints a line. Read both sides of every interior boundary and report a line
  // whenever any boundary paints one: this map round-trips back through
  // applyUniformInner on any table-scope edit, so reading 'none' here would
  // erase interior lines the user can still see.
  const boundary = (a: any, b: any): any => {
    if (isPaintedSpec(a)) return a;
    if (isPaintedSpec(b)) return b;
    return a ?? b ?? null;
  };
  const sampleInner = (kind: "H" | "V"): any => {
    const specs: any[] = [];
    if (kind === "H") {
      for (let r = 0; r + 1 < rows; r++) {
        for (let c = 0; c < cols; c++) {
          specs.push(
            boundary(model.cellBorders[idx(r, c)]?.bottom, model.cellBorders[idx(r + 1, c)]?.top),
          );
        }
      }
    } else {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c + 1 < cols; c++) {
          specs.push(
            boundary(model.cellBorders[idx(r, c)]?.right, model.cellBorders[idx(r, c + 1)]?.left),
          );
        }
      }
    }
    const painted = specs.find(isPaintedSpec);
    if (painted) return painted;
    if (specs.some((s) => s != null)) return { weight: 0, style: "none" } as any;
    return { weight: EDGE_DEFAULT.weight, style: EDGE_DEFAULT.style } as any;
  };

  return {
    top: { ...toOuter(safe(topLeft.top, null)), radius: 0 },
    right: { ...toOuter(safe(topRight.right, null)), radius: 0 },
    bottom: { ...toOuter(safe(bottomLeft.bottom, null)), radius: 0 },
    left: { ...toOuter(safe(topLeft.left, null)), radius: 0 },
    innerH: { ...toOuter(sampleInner("H")), radius: 0 },
    innerV: { ...toOuter(sampleInner("V")), radius: 0 },
  };
}

// Resolve a cell's four perimeter edge specs from the render model, borrowing
// the neighbor-owned spec for shared inner edges this cell's side leaves
// unset. Returns null when the cell isn't in a table. Spans need no special
// handling here: the renderer routes a covered position's strokes to the merge
// anchor, so a merged cell's sides already carry the boundaries past its span.
function resolveCellPerimeterSpecs(
  cell: HTMLElement,
): { top: any; right: any; bottom: any; left: any } | null {
  const table = cell.closest(".bloom-table") as HTMLElement | null;
  if (!table) return null;
  const model = buildRenderModel(table);
  const index = getTableCells(table).indexOf(cell);
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

/** A cell's own painted sides from the render model, with NO borrowing of
 *  neighbor-owned strokes: a side the cell doesn't paint (unset, lost to the
 *  neighbor, or explicitly declined) resolves to a 'none' edge. This is what
 *  copy-properties wants — pasting these claims reproduces the source's look,
 *  because paste's sided none-writes keep the target's neighbors' lines while
 *  visible sides claim the shared edge. (The borrowing value map above would
 *  capture a neighbor's stroke as if it were this cell's border and, pasted
 *  at a table edge, invent a perimeter line the source never painted.) */
export function getCellOwnPerimeter(cell: HTMLElement): {
  top: { weight: BorderWeight; style: BorderStyle; color: string | null };
  right: { weight: BorderWeight; style: BorderStyle; color: string | null };
  bottom: { weight: BorderWeight; style: BorderStyle; color: string | null };
  left: { weight: BorderWeight; style: BorderStyle; color: string | null };
} {
  const table = cell.closest(".bloom-table") as HTMLElement | null;
  let sides: { top?: any; right?: any; bottom?: any; left?: any } = {};
  if (table) {
    const model = buildRenderModel(table);
    const index = getTableCells(table).indexOf(cell);
    sides = model.cellBorders[index] || {};
  }
  const toEdge = (spec: any) => {
    const w = snapWeight(Number.isFinite(spec?.weight) ? spec.weight : 0);
    const style: BorderStyle = w === 0 ? "none" : ((spec?.style as BorderStyle) ?? "solid");
    const color = spec && typeof spec.color === "string" && spec.color ? spec.color : null;
    return { weight: w, style, color };
  };
  return {
    top: toEdge(sides.top),
    right: toEdge(sides.right),
    bottom: toEdge(sides.bottom),
    left: toEdge(sides.left),
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
