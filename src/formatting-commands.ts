// Formatting commands shared by the Cell, Row, Column, and Table menus.
//
// Every command writes per-cell properties to each cell in a scope (one cell,
// a row, a column, or the whole table). There is no row/column/table-level
// override layer: the last command wins, whichever menu it came from.
// Formatting a cell and then its row overwrites that cell along with the rest
// of the row; formatting the row and then one cell changes only that cell.

import {
  getRowAndColumn,
  snapshotCellSettings,
  applyCellSettings,
  type CellSettings,
} from "./structure";
import { render } from "./table-renderer";
import { tableHistoryManager } from "./history";
import {
  setupContentsOfCell,
  dispatchCellContentChanged,
  getCurrentContentTypeId,
} from "./cell-contents";
import {
  getSpan,
  setCellAlign,
  setCellPadding,
  setCellBackground,
  setCellCorners,
  setTableBackground,
  type CellAlign,
} from "./table-model";
import {
  getCellPerimeterValueMap,
  getCellPerimeterColors,
  getTableOuterBorderValueMap,
} from "./border-state";
import { representativeBorderColorHex } from "./color-utils";
import type { BorderStyle, BorderWeight } from "./components/BorderControl/logic/types";
import {
  applyCellPerimeter,
  applyOuterBorders,
  applyUniformInner,
  setDefaultBorder,
} from "./edge-utils";

export type FormattingScope = "cell" | "row" | "column" | "table";

// Active cells only: bloom-skip cells are spanned-over placeholders — they are
// display:none, own no rendered border sides, and must not be written to (a
// skip cell's perimeter shares edges with the visible spanning cell).
const tableCells = (table: HTMLElement): HTMLElement[] =>
  Array.from(table.children).filter(
    (c): c is HTMLElement =>
      c instanceof HTMLElement &&
      c.classList.contains("bloom-cell") &&
      !c.classList.contains("bloom-skip"),
  );

// One undo entry per command, matching the structural operations. (Without
// this, Ctrl+Z after a formatting change would revert an unrelated earlier
// operation while the formatting stayed.) No-ops on unattached tables, same
// as every other history-backed operation.
function withHistory(table: HTMLElement, description: string, op: () => void): void {
  tableHistoryManager.addHistoryEntry(table, description, op);
}

/** The cells a formatting command targets: the given cell, its row, its
 *  column, or every cell in the table. A spanning cell belongs to every row
 *  and column it covers. Row/column/cell scopes need a reference cell; without
 *  one they resolve to no cells. */
export function getCellsInScope(
  table: HTMLElement,
  scope: FormattingScope,
  cell: HTMLElement | null,
): HTMLElement[] {
  const cells = tableCells(table);
  if (scope === "table") return cells;
  if (!cell) return [];
  if (scope === "cell") return cells.includes(cell) ? [cell] : [];
  let target: { row: number; column: number };
  try {
    target = getRowAndColumn(table, cell);
  } catch {
    return [];
  }
  return cells.filter((c) => {
    try {
      const pos = getRowAndColumn(table, c);
      const span = getSpan(c);
      return scope === "row"
        ? target.row >= pos.row && target.row < pos.row + Math.max(1, span.y)
        : target.column >= pos.column && target.column < pos.column + Math.max(1, span.x);
    } catch {
      return false;
    }
  });
}

export function applyContentType(
  table: HTMLElement,
  cells: HTMLElement[],
  contentTypeId: string,
): void {
  // One history entry for the whole scope (per-cell putInHistory would push
  // one whole-table snapshot per cell, making undo multi-step and lossy).
  // Host notification is deferred until the entry closes so handlers may
  // safely run further table operations.
  const wasDifferent = cells.filter((c) => getCurrentContentTypeId(c) !== contentTypeId);
  withHistory(table, "Change Content Type", () => {
    for (const c of cells) setupContentsOfCell(c, contentTypeId, false, false);
    render(table);
  });
  for (const c of wasDifferent) {
    // Notify only for cells that actually changed (none did if the history
    // manager refused the operation, e.g. on a detached table).
    if (getCurrentContentTypeId(c) === contentTypeId) dispatchCellContentChanged(c, contentTypeId);
  }
}

export function applyAlignment(table: HTMLElement, cells: HTMLElement[], align: CellAlign): void {
  withHistory(table, "Set Alignment", () => {
    for (const c of cells) setCellAlign(c, align);
    render(table);
  });
}

export function applyPadding(table: HTMLElement, cells: HTMLElement[], px: number): void {
  withHistory(table, "Set Padding", () => {
    for (const c of cells) setCellPadding(c, `${px}px`);
    render(table);
  });
}

export function applyCorners(table: HTMLElement, cells: HTMLElement[], radius: number): void {
  withHistory(table, "Set Corners", () => {
    for (const c of cells) setCellCorners(c, radius ? { radius } : null);
    render(table);
  });
}

/** Fill colors the cells themselves; null clears back to the stylesheet
 *  default. Table scope also clears any container color: the container div is
 *  sized larger than the cells, so its color would bleed outside the table. */
export function applyFill(
  table: HTMLElement,
  scope: FormattingScope,
  cells: HTMLElement[],
  color: string | null,
): void {
  withHistory(table, "Set Fill", () => {
    if (scope === "table") setTableBackground(table, null);
    for (const c of cells) setCellBackground(c, color || null);
    render(table);
  });
}

export type BorderProps = {
  color?: string;
  style?: BorderStyle;
  weight?: BorderWeight;
};

// Resolve one edge's new value: apply the requested overrides on top of the
// edge's current weight/style, then keep weight and style consistent — style
// "none" zeroes the weight, weight 0 turns the style off, and setting a real
// style on an invisible edge (or a real weight on a style-less one) makes the
// edge visible.
function resolveEdge(
  current: { weight: number; style: BorderStyle },
  props: BorderProps,
  color: string,
): { weight: number; style: BorderStyle; color: string } {
  let weight = props.weight ?? current.weight;
  let style = props.style ?? current.style;
  if (props.style !== undefined) {
    if (props.style === "none") weight = 0;
    else if (weight === 0) weight = 1;
  } else if (props.weight !== undefined) {
    if (props.weight === 0) style = "none";
    else if (style === "none") style = "solid";
  }
  return { weight, style, color };
}

/** Change border color / style / weight while preserving whatever isn't being
 *  set. Cell/row/column scopes re-write each target cell's perimeter; table
 *  scope re-writes the outer, inner, and default borders so newly added rows
 *  and columns pick up the change too. */
export function applyBorderProps(
  table: HTMLElement,
  scope: FormattingScope,
  cells: HTMLElement[],
  props: BorderProps,
): void {
  if (scope === "table") {
    withHistory(table, "Change Border", () => {
      const base = getTableOuterBorderValueMap(table);
      const firstCell = cells[0] ?? tableCells(table)[0];
      const color =
        props.color ?? (firstCell ? representativeBorderColorHex(firstCell) : "#000000");
      const side = (s: { weight: number; style: BorderStyle }) => resolveEdge(s, props, color);
      applyOuterBorders(
        table,
        {
          top: side(base.top),
          right: side(base.right),
          bottom: side(base.bottom),
          left: side(base.left),
        },
        color,
      );
      applyUniformInner(table, "innerH", side(base.innerH) as any, color);
      applyUniformInner(table, "innerV", side(base.innerV) as any, color);
      setDefaultBorder(table, side(base.innerH) as any, color);
      render(table);
    });
    return;
  }
  withHistory(table, "Change Border", () => {
    // Snapshot every perimeter before writing: cells share edges, so a write
    // for one cell must not feed into the map read for the next. Colors are
    // kept per edge so a style/weight change doesn't flatten a multi-colored
    // perimeter to one color.
    const snapshots = cells.map((c) => ({
      map: getCellPerimeterValueMap(c),
      colors: getCellPerimeterColors(c),
      fallback: props.color ?? representativeBorderColorHex(c),
    }));
    cells.forEach((c, i) => {
      const { map, colors, fallback } = snapshots[i];
      const edgeColor = (current: string | null) => props.color ?? current ?? fallback;
      applyCellPerimeter(table, c, {
        top: resolveEdge(map.top, props, edgeColor(colors.top)),
        right: resolveEdge(map.right, props, edgeColor(colors.right)),
        bottom: resolveEdge(map.bottom, props, edgeColor(colors.bottom)),
        left: resolveEdge(map.left, props, edgeColor(colors.left)),
      });
    });
    render(table);
  });
}

export function applyBorderColor(
  table: HTMLElement,
  scope: FormattingScope,
  cells: HTMLElement[],
  color: string,
): void {
  applyBorderProps(table, scope, cells, { color });
}

// ---- Copy / Paste properties -----------------------------------------------
// A module-level clipboard for cell properties (not contents): the shared
// CellSettings record (alignment, padding, fill, corners, content type) plus
// the perimeter borders. Borders travel as resolved per-edge values because a
// clipboard can't reference another table's edge arrays. Copy snapshots the
// first cell of the source scope; paste stamps the snapshot onto every cell of
// the target scope — the same last-command-wins model as the other commands.

type CopiedEdge = { weight: number; style: BorderStyle; color: string };

export type CopiedCellProperties = {
  settings: CellSettings;
  border: {
    top: CopiedEdge;
    right: CopiedEdge;
    bottom: CopiedEdge;
    left: CopiedEdge;
  };
};

let copiedProperties: CopiedCellProperties | null = null;

export function hasCopiedProperties(): boolean {
  return copiedProperties !== null;
}

/** Snapshot the properties of the scope's first cell. Returns the snapshot
 *  (also kept as the active clipboard), or null when the scope is empty. */
export function copyProperties(cells: HTMLElement[]): CopiedCellProperties | null {
  const seed = cells[0];
  if (!seed) return null;
  const m = getCellPerimeterValueMap(seed);
  const colors = getCellPerimeterColors(seed);
  const fallback = representativeBorderColorHex(seed);
  const edge = (e: { weight: number; style: BorderStyle }, color: string | null): CopiedEdge => ({
    weight: e.weight,
    style: e.style,
    color: color ?? fallback,
  });
  copiedProperties = {
    settings: snapshotCellSettings(seed),
    border: {
      top: edge(m.top, colors.top),
      right: edge(m.right, colors.right),
      bottom: edge(m.bottom, colors.bottom),
      left: edge(m.left, colors.left),
    },
  };
  return copiedProperties;
}

/** Stamp the copied properties onto every cell in the target scope. Content
 *  type is one of them: a target cell of a different type is rebuilt as an
 *  empty skeleton of the copied type (its content is not preserved). No-op
 *  when nothing has been copied. */
export function pasteProperties(table: HTMLElement, cells: HTMLElement[]): void {
  const p = copiedProperties;
  if (!p || !cells.length) return;
  // As in applyContentType, host notification for content-type changes waits
  // until the history entry closes.
  const targetType = p.settings.contentType;
  const wasDifferent = targetType
    ? cells.filter((c) => getCurrentContentTypeId(c) !== targetType)
    : [];
  withHistory(table, "Paste Properties", () => {
    for (const c of cells) {
      applyCellSettings(c, p.settings);
      applyCellPerimeter(table, c, {
        top: { ...p.border.top },
        right: { ...p.border.right },
        bottom: { ...p.border.bottom },
        left: { ...p.border.left },
      });
    }
    render(table);
  });
  for (const c of wasDifferent) {
    if (getCurrentContentTypeId(c) === targetType) dispatchCellContentChanged(c, targetType);
  }
}

export function applyBorderStyle(
  table: HTMLElement,
  scope: FormattingScope,
  cells: HTMLElement[],
  style: BorderStyle,
): void {
  applyBorderProps(table, scope, cells, { style });
}

export function applyBorderWeight(
  table: HTMLElement,
  scope: FormattingScope,
  cells: HTMLElement[],
  weight: BorderWeight,
): void {
  applyBorderProps(table, scope, cells, { weight });
}
