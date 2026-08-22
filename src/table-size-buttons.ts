// Four edge "+" buttons shown around the visible bounds of the selected table.
// Right/Left insert columns; Top/Bottom insert rows.
//
// This module has been partially decomposed: icon constants live in
// menu-icons.ts, stateless menu element factories in menu-widgets.ts, and
// Paint Format mode in paint-format.ts (re-exported below). What remains here
// shares the menuPopup / overlayTable / cluster module state and is a
// candidate for a next extraction as one or more units: the overlay/cluster
// lifecycle (ensureEdgeOverlays, show/hide/reposition, the proximity gate),
// the menu sections and popup lifecycle (sectionBuilders, openMenu,
// makeMenuItem), the menu command handlers (menuAddRow etc.), and the
// delete/add hover previews.

import { BloomTable } from "./BloomTable";
import { getTableInfo, getRowAndColumn } from "./structure";
import { buildGrid } from "./grid";
import { ProximityDiv } from "./ProximityDiv";
import { kBloomBlue } from "./constants";
import { render } from "./table-renderer";
import { contentTypeOptions, getCurrentContentTypeId } from "./cell-contents";
import {
  getCellAlign,
  getSpan,
  getGapX,
  setGapX,
  getGapY,
  setGapY,
  getCellBackground,
  getCellPadding,
  getCellCorners,
  getTableBackground,
  getColumnWidths,
  getRowHeights,
  type CellAlign,
} from "./table-model";
import { representativeBorderColorHex } from "./color-utils";
import { getCellPerimeterValueMap } from "./border-state";
import type { BorderStyle, BorderWeight } from "./components/BorderControl/logic/types";
import {
  type FormattingScope,
  getCellsInScope,
  applyContentType,
  applyAlignment,
  applyPadding,
  applyCorners,
  applyFill,
  applyBorderColor,
  applyBorderStyle,
  applyBorderWeight,
  copyProperties,
  pasteProperties,
  hasCopiedProperties,
} from "./formatting-commands";
import {
  enterPaintFormatMode,
  exitPaintFormatMode,
  isPaintFormatModeActive,
  setPaintFormatOverlayHider,
} from "./paint-format";
// Toolbar icons reused on the menu (imported as URLs).
import columnDeleteIcon from "./components/icons/column-delete.svg";
import cellMergeIcon from "./components/icons/cell-merge.svg";
import cellSplitIcon from "./components/icons/cell-split.svg";
import alignLeftIcon from "./components/icons/align-left.svg";
import alignCenterIcon from "./components/icons/align-center.svg";
import alignRightIcon from "./components/icons/align-right.svg";
import cellContentTableIcon from "./components/icons/cell-content-table.svg";
import menuRowIcon from "./components/icons/menu-row.svg";
import menuColumnIcon from "./components/icons/menu-column.svg";
import columnGrowIcon from "./components/icons/column-grow.svg";
import columnHugIcon from "./components/icons/column-hug.svg";
import rowGrowIcon from "./components/icons/row-grow.svg";
import rowHugIcon from "./components/icons/row-hug.svg";

// Inline SVG icons (see menu-icons.ts) so the core attach path stays free of
// React / MUI.
import {
  kAddIconSvg,
  kAddRowAboveIconSvg,
  kAddRowBelowIconSvg,
  kAddColumnLeftIconSvg,
  kAddColumnRightIconSvg,
  kMoveUpIconSvg,
  kMoveDownIconSvg,
  kMoveLeftIconSvg,
  kMoveRightIconSvg,
  kCopyIconSvg,
  kPasteIconSvg,
  kCutIconSvg,
  kTrashIconSvg,
  kPaintIconSvg,
} from "./menu-icons";
// Stateless element factories for the menus (see menu-widgets.ts).
import {
  kIconSlotPx,
  kItemIconColor,
  makeGlyphPill,
  makeMenuHeader,
  makeDivider,
  setIconSlot,
  makeInfoNote,
  makeControlRow,
  setToggleActive,
  makeIconToggle,
  makeTextToggle,
  makeBorderStyleToggle,
  makeBorderWeightToggle,
  makeCornerToggle,
  firstPx,
  makeSliderRow,
  makeColorPairRow,
} from "./menu-widgets";

let installed = false;
// Unique ID source for anchor names, plus the set of names minted this
// session (names found in loaded HTML but absent here are stale and must not
// be reused — see getElementAnchorName).
let anchorCounter = 0;
const mintedAnchorNames = new Set<string>();

// Reset function for testing
export function resetTableSizeButtons(): void {
  exitPaintFormatMode();
  removeTableSizeButtonListeners();
  installed = false;
  overlayTable = null;
  // Fresh "session" for anchor names, so tests exercise the same collision
  // rules a real page reload does.
  anchorCounter = 0;
  mintedAnchorNames.clear();

  // Reset cluster elements. Each ProximityDiv must be destroy()ed: that is the
  // only path that drops it from the module-global instance list the document
  // mousemove handler walks, and the only one that removes its wrapper (and the
  // buttons inside it) from the DOM.
  for (const prox of [proxColCluster, proxRowCluster, proxColAdd, proxRowAdd, proxTablePillTL]) {
    prox?.destroy();
  }
  colAddBtn = null;
  rowAddBtn = null;
  colMenuPill = null;
  rowMenuPill = null;
  colCluster = null;
  rowCluster = null;
  proxColCluster = null;
  proxRowCluster = null;
  proxColAdd = null;
  proxRowAdd = null;
  tablePillTL = null;
  proxTablePillTL = null;
  if (menuPopup) {
    menuPopup.remove();
    menuPopup = null;
  }
  menuOpenId = null;
  menuTargetCell = null;

  // The hover previews are cached DOM nodes; keeping them across a reset means
  // a host that replaced the body content gets a detached div forever after.
  deletePreviewDiv?.remove();
  deletePreviewDiv = null;
  deletePreviewVisible = false;
  currentPreviewKind = null;
  addPreviewDiv?.remove();
  addPreviewDiv = null;
  addPreviewVisible = false;
  currentAddKind = null;
  currentAddPosition = null;

  if (repositionRaf) {
    cancelAnimationFrame(repositionRaf);
    repositionRaf = 0;
  }
  // A frame already queued by the proximity gate would run updateProximityGate
  // after the reset and rebuild the overlay DOM this function just cleared.
  if (gateRaf) {
    cancelAnimationFrame(gateRaf);
    gateRaf = 0;
  }
}

// Named (not inline) so resetTableSizeButtons can remove them again. Anonymous
// closures here would stack a fresh copy on every reset + re-attach cycle.
function onFocusInForOverlays(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const cell = target.closest(".bloom-cell") as HTMLElement | null;
  if (!cell) {
    scheduleOverlayReposition();
    return;
  }
  const table = cell.closest(".bloom-table") as HTMLElement | null;
  if (!table) return;
  showEdgeOverlays(table);
}

// Right-click on a cell opens the Cell menu.
function onContextMenuForOverlays(event: Event): void {
  const target = event.target as HTMLElement | null;
  const cell = target?.closest(".bloom-cell") as HTMLElement | null;
  if (!cell) return; // not on a table cell — leave the native menu alone
  const table = cell.closest(".bloom-table") as HTMLElement | null;
  if (!table) return;
  event.preventDefault();
  // Paint Format owns every click on a cell while it runs. Opening the Cell
  // menu here would put a menu on top of the active mode, and picking "Paint
  // format" in it would silently re-enter with a different pattern.
  if (isPaintFormatModeActive()) return;
  showEdgeOverlays(table);
  openMenu(
    ["cell"],
    { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY },
    "context",
    cell,
  );
}

// Scroll must be capture-phase: scroll events do not bubble, so a non-capture
// window listener never hears an inner scroll container move, and the pills and
// previews (placed in fixed/document coordinates) strand at their old spots.
const kScrollListenerOptions = { capture: true, passive: true } as const;

function removeTableSizeButtonListeners(): void {
  document.removeEventListener("focusin", onFocusInForOverlays, true);
  document.removeEventListener("contextmenu", onContextMenuForOverlays, true);
  window.removeEventListener("resize", scheduleOverlayReposition);
  window.removeEventListener("scroll", scheduleOverlayReposition, kScrollListenerOptions);
  document.removeEventListener("tableHistoryUpdated", scheduleOverlayReposition as EventListener);
  // Removal matches on the capture flag only, so the passive option that the
  // install side passes is irrelevant here.
  document.removeEventListener("mousemove", onMouseMoveForProximityGate as EventListener);
  gateInstalled = false;
}

export function ensureTableSizeButtons(): void {
  if (installed) return;
  installed = true;

  ensureEdgeOverlays();

  document.addEventListener("focusin", onFocusInForOverlays, true);
  document.addEventListener("contextmenu", onContextMenuForOverlays, true);

  window.addEventListener("resize", scheduleOverlayReposition, {
    passive: true,
  });
  window.addEventListener("scroll", scheduleOverlayReposition, kScrollListenerOptions);
  document.addEventListener("tableHistoryUpdated", scheduleOverlayReposition as EventListener);

  installProximityGate();
}

// --- Contextual control clusters ---
// Each cluster pairs an "add" ("+") button with the "..." menu pill and tracks
// the current selection: the column cluster sits above the current column (a
// vertical stack — same horizontal position); the row cluster sits to the left
// of the current row (a horizontal pair — same vertical position).
let colAddBtn: HTMLButtonElement | null = null; // add column (to the right of current)
let rowAddBtn: HTMLButtonElement | null = null; // add row (below current)
let colMenuPill: HTMLButtonElement | null = null;
let rowMenuPill: HTMLButtonElement | null = null;

// Cluster containers + their proximity wrappers
let colCluster: HTMLDivElement | null = null;
let rowCluster: HTMLDivElement | null = null;
let proxColCluster: ProximityDiv | null = null;
let proxRowCluster: ProximityDiv | null = null;

// The "+" add buttons are table-level (not tied to the selected row/column):
// the row "+" sits below the table, the column "+" to its right.
let proxColAdd: ProximityDiv | null = null;
let proxRowAdd: ProximityDiv | null = null;

// Table-level menu pill (table icon + "..."), horizontally centered above the
// table's top edge. Opens the "Table" menu.
let tablePillTL: HTMLButtonElement | null = null;
let proxTablePillTL: ProximityDiv | null = null;

// The open popup menu; null when closed. menuOpenId identifies which trigger
// opened it (so clicking the same pill toggles it closed). menuTargetCell is the
// cell the menu acts on (the right-clicked cell, or the selected cell for pills).
let menuPopup: HTMLDivElement | null = null;
let menuOpenId: string | null = null;
let menuTargetCell: HTMLElement | null = null;

let overlayTable: HTMLElement | null = null;
let repositionRaf = 0;

// --- Hover preview overlay for delete actions ---
let deletePreviewDiv: HTMLDivElement | null = null;
let deletePreviewVisible = false;
type PreviewKind = "row" | "column";
let currentPreviewKind: PreviewKind | null = null;

// Shared dimensions
const kAddButtonLength = 50; // px, long side of add button (tall for columns, wide for rows)
const kAddPreviewThickness = 10; // px, thickness of the pulsing add preview bar

// Ensure global overlay styles exist (for animations)
let overlayStylesInstalled = false;
function ensureOverlayStyles() {
  if (overlayStylesInstalled) return;
  const style = document.createElement("style");
  style.textContent = `
/* Enable referencing anchors anywhere in the document */
html { anchor-scope: all; }
@keyframes btable-pulse {
  0% { opacity: 0.25; }
  50% { opacity: 0.9; }
  100% { opacity: 0.25; }
}`;
  document.head.appendChild(style);
  overlayStylesInstalled = true;
}

type OverlaySide = "right" | "left" | "top" | "bottom";

const kAddOverlayLabel: Record<OverlaySide, string> = {
  right: "Insert Column Right",
  left: "Insert Column Left",
  top: "Insert Row Above",
  bottom: "Insert Row Below",
};

function makeOverlay(
  onClick: () => void,
  iconSvg: string,
  side: OverlaySide,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  const label = kAddOverlayLabel[side];
  btn.setAttribute("aria-label", label);
  btn.title = label;
  // Edit-time chrome living outside the table; prepare-for-save strips it.
  btn.setAttribute("data-table-overlay", "add-button");
  Object.assign(btn.style, {
    position: "absolute",
    // base size; will be overridden per kind/side below
    width: "24px",
    height: "24px",
    borderRadius: "12px",
    border: "1px solid rgba(0,0,0,0.3)",
    backgroundColor: "#2D8294",
    color: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    zIndex: "2147483647",
    cursor: "pointer",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);

  // Add buttons are bigger targets: a pill along the edge they insert on.
  if (side === "right" || side === "left") {
    // Tall rounded rectangle for columns
    btn.style.width = "24px";
    btn.style.height = `${kAddButtonLength}px`;
    btn.style.borderRadius = "12px"; // pill-like vertically
  } else {
    // Wide rounded rectangle for rows
    btn.style.width = `${kAddButtonLength}px`;
    btn.style.height = "24px";
    btn.style.borderRadius = "12px"; // pill-like horizontally
  }
  // Inject the icon as inline SVG for crisp rendering
  btn.innerHTML = iconSvg;
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => onClick());
  return btn;
}

// Build a cluster container (a flex box) wrapped by anchor positioning. The
// column cluster lays out horizontally ("+" then "..." to its right, above the
// column); the row cluster stacks vertically ("+" then "..." below it, left of
// the row).
function makeClusterContainer(kind: MenuKind): HTMLDivElement {
  const div = document.createElement("div");
  div.setAttribute("data-overlay-cluster", kind);
  // Also tagged for prepare-for-save: the cluster is appended to <body> here and
  // later moved into a ProximityDiv wrapper, so it must be strippable either way.
  div.setAttribute("data-table-overlay", "cluster");
  Object.assign(div.style, {
    position: "static",
    zIndex: "2147483647",
    display: "none",
    gap: "6px",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  } as any);
  div.style.flexDirection = kind === "column" ? "row" : "column";
  document.body.appendChild(div);
  return div;
}

function ensureEdgeOverlays() {
  ensureOverlayStyles();
  // One "+" per axis; reshaped to a small pill so it pairs neatly with the menu.
  if (!colAddBtn) colAddBtn = makeOverlay(tryInsertColumnRight, kAddIconSvg, "right");
  if (!rowAddBtn) rowAddBtn = makeOverlay(tryInsertRowBelow, kAddIconSvg, "bottom");
  for (const b of [colAddBtn, rowAddBtn]) {
    if (!b) continue;
    b.style.width = "";
    b.style.minWidth = "30px";
    b.style.height = "20px";
    b.style.borderRadius = "10px";
    b.style.padding = "0 8px";
  }
  // The "..." menu pills (row/column) and the table-level pills.
  ensureMenuPills();
  ensureTablePills();

  // Assemble each cluster as [ + ][ ... ] (add button nearest the table edge).
  // Double the resting opacity of the row/column menu affordances (ProximityDiv
  // defaults to 0.08) so the "..." pills are easier to spot at rest.
  if (!colCluster) {
    colCluster = makeClusterContainer("column");
    proxColCluster = new ProximityDiv(document.body, colCluster, { minOpacity: 0.16 });
  }
  if (!rowCluster) {
    rowCluster = makeClusterContainer("row");
    proxRowCluster = new ProximityDiv(document.body, rowCluster, { minOpacity: 0.16 });
  }
  const addToCluster = (cluster: HTMLDivElement, ...els: (HTMLElement | null)[]) => {
    for (const el of els) {
      if (!el) continue;
      el.style.position = "static";
      el.style.display = "flex";
      if (!cluster.contains(el)) cluster.appendChild(el);
    }
  };
  // The clusters now hold only the "..." menu pill (anchored to the selected
  // row/column). The "+" buttons are positioned table-relative below.
  addToCluster(colCluster, colMenuPill);
  addToCluster(rowCluster, rowMenuPill);

  // Each "+" gets its own proximity wrapper so it can be placed at a table edge,
  // independent of the selection-anchored clusters.
  if (colAddBtn) {
    colAddBtn.style.position = "static";
    if (!proxColAdd) proxColAdd = new ProximityDiv(document.body, colAddBtn);
  }
  if (rowAddBtn) {
    rowAddBtn.style.position = "static";
    if (!proxRowAdd) proxRowAdd = new ProximityDiv(document.body, rowAddBtn);
  }

  // Hover previews: the "+" shows where the new line will land.
  const ensureAddHover = (
    btn: HTMLButtonElement | null,
    kind: PreviewKind,
    position: "above" | "below" | "left" | "right",
  ) => {
    if (!btn) return;
    if ((btn as any)._hasAddPreviewHandlers) return;
    (btn as any)._hasAddPreviewHandlers = true;
    btn.addEventListener("mouseenter", () => showAddPreview(kind, position));
    btn.addEventListener("mouseleave", hideAddPreview);
  };
  ensureAddHover(colAddBtn, "column", "right");
  ensureAddHover(rowAddBtn, "row", "below");
}

function ensureMenuPills(): void {
  if (!colMenuPill) {
    colMenuPill = makeGlyphPill("Column menu", menuColumnIcon, "display:block;height:16px;width:auto");
    colMenuPill.setAttribute("data-btable-menu-pill", "column");
    colMenuPill.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePillMenu("column", colMenuPill!, "pill:column");
    });
  }
  if (!rowMenuPill) {
    rowMenuPill = makeGlyphPill("Row menu", menuRowIcon, "display:block;width:16px;height:auto");
    rowMenuPill.setAttribute("data-btable-menu-pill", "row");
    rowMenuPill.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePillMenu("row", rowMenuPill!, "pill:row");
    });
  }
}

function ensureTablePills(): void {
  const make = (id: string) => {
    const pill = makeGlyphPill("Table menu", cellContentTableIcon, "display:block;width:16px;height:16px");
    pill.setAttribute("data-btable-menu-pill", "table");
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePillMenu("table", pill, id);
    });
    return pill;
  };
  // The table pill is the menu entry point and lives above the table, away from
  // where the cursor usually is — keep it clearly visible at rest (rather than
  // fading to near-invisible) so it's discoverable.
  if (!tablePillTL) {
    tablePillTL = make("pill:table:tl");
    proxTablePillTL = new ProximityDiv(document.body, tablePillTL, { minOpacity: 0.6 });
  }
}

// ===== "..." pill menus =====
// A menu is composed of one or more of these sections. Pills open a single
// section (row/column/table); right-clicking a cell opens the Cell section.
type SectionName = "cell" | "row" | "column" | "table";
// Pills are triggered for the row/column/table sections only.
type MenuKind = "row" | "column" | "table";

// Context the section builders compute against (the cell the menu acts on).
type MenuCtx = {
  table: HTMLElement | null;
  cell: HTMLElement | null;
  row: number;
  col: number;
  rowCount: number;
  colCount: number;
};

function makeMenuItem(
  label: string,
  fn: () => void,
  previewKind?: PreviewKind,
  disabled = false,
  icon?: string,
): HTMLButtonElement {
  const item = document.createElement("button");
  item.type = "button";
  item.setAttribute("aria-label", label);
  item.setAttribute("role", "menuitem");
  item.disabled = disabled;
  if (disabled) item.setAttribute("aria-disabled", "true");
  Object.assign(item.style, {
    display: "flex",
    alignItems: "center",
    width: "100%",
    textAlign: "left",
    padding: "6px 14px",
    background: "transparent",
    border: "none",
    color: disabled ? "#bbb" : "#222",
    fontSize: "13px",
    cursor: disabled ? "default" : "pointer",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);

  const slot = document.createElement("span");
  Object.assign(slot.style, {
    flex: `0 0 ${kIconSlotPx}px`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? "0.4" : "1",
  } as CSSStyleDeclaration);
  setIconSlot(slot, icon, kItemIconColor);
  const text = document.createElement("span");
  text.textContent = label;
  text.style.flex = "1 1 auto";
  item.appendChild(slot);
  item.appendChild(text);

  item.addEventListener("mousedown", (e) => e.preventDefault());
  if (!disabled) {
    item.addEventListener("mouseenter", () => {
      item.style.background = "#eef6f8";
      if (previewKind) showDeletePreview(previewKind);
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
      if (previewKind) hideDeletePreview();
    });
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      if (previewKind) hideDeletePreview();
      // Every command must act on the cell the menu was opened for. Closing the
      // popup clears menuTargetCell, and getMenuCell would then fall back to
      // whatever cell carries .cell--selected — a different cell, because a
      // right-click on a cell with no editable child never selects it. So hold
      // the target across the call.
      const target = menuTargetCell;
      closeMenuPopup();
      menuTargetCell = target;
      try {
        fn();
      } finally {
        menuTargetCell = null;
      }
    });
  }
  return item;
}

// "Size" control for the selected row or column: a 3-way choice — Grow (fill),
// Hug (shrink to content), or a fixed measurement — mirroring the sidebar's
// Size control. `dim` selects whether it drives column widths or row heights.
function buildSizeControl(ctx: MenuCtx, dim: "column" | "row"): HTMLElement {
  const table = ctx.table;
  const growIcon = dim === "column" ? columnGrowIcon : rowGrowIcon;
  const hugIcon = dim === "column" ? columnHugIcon : rowHugIcon;
  const index = dim === "column" ? ctx.col : ctx.row;

  const read = (): string => {
    if (!table) return "hug";
    try {
      const c = new BloomTable(table);
      const raw = (dim === "column" ? c.getColumnWidth(index) : c.getRowHeight(index)) || "hug";
      return typeof raw === "string" ? raw.trim() : raw;
    } catch {
      return "hug";
    }
  };
  const write = (value: string) => {
    if (!table) return;
    try {
      const c = new BloomTable(table);
      if (dim === "column") c.setColumnWidth(index, value);
      else c.setRowHeight(index, value);
      render(table);
    } catch {}
  };

  const grow = makeIconToggle(growIcon, "Grow", false, () => {
    write("fill");
    refresh();
  });
  const hug = makeIconToggle(hugIcon, "Hug", false, () => {
    write("hug");
    refresh();
  });
  const fixed = makeTextToggle("mm", "Fixed size", false, () => {
    // Keep an existing fixed value if present; otherwise default to 10mm.
    const cur = read();
    write(cur && /(px|mm)$/i.test(cur) ? cur : "10mm");
    refresh();
  });

  // Fixed sizes can carry long float tails (e.g. a drag-resize writing
  // 89.99999618530273px); trim them for display only — the stored value keeps
  // full precision. px rounds to whole pixels; mm keeps one decimal (1mm is
  // ~3.8px, so whole-mm rounding would misreport meaningfully).
  const roundedLabel = (s: string): string => {
    const m = s.match(/^(-?\d+(?:\.\d+)?)(px|mm)$/i);
    if (!m) return s;
    const n = parseFloat(m[1]);
    const isPx = m[2].toLowerCase() === "px";
    return `${isPx ? Math.round(n) : Math.round(n * 10) / 10}${m[2]}`;
  };

  // Re-derive the active option (and the fixed-size label) from the table after
  // every change, since the menu stays open and isn't rebuilt on edit.
  const refresh = () => {
    const current = read();
    const mode: "grow" | "hug" | "fixed" =
      current === "fill" ? "grow" : /(px|mm)$/i.test(current) ? "fixed" : "hug";
    fixed.textContent = mode === "fixed" ? roundedLabel(current) : "mm";
    setToggleActive(grow, mode === "grow");
    setToggleActive(hug, mode === "hug");
    setToggleActive(fixed, mode === "fixed");
  };
  refresh();

  return makeControlRow("Size", [grow, hug, fixed]);
}

// ----- Section builders -----
function buildMenuCtx(cell: HTMLElement | null): MenuCtx {
  const table = (cell?.closest(".bloom-table") as HTMLElement | null) ?? overlayTable;
  let row = 0,
    col = 0,
    rowCount = 1,
    colCount = 1;
  if (table) {
    try {
      const info = getTableInfo(table);
      rowCount = info.rowCount;
      colCount = info.columnCount;
    } catch {}
  }
  if (cell && table) {
    try {
      const pos = getRowAndColumn(table, cell);
      row = pos.row;
      col = pos.column;
    } catch {}
  }
  return { table, cell, row, col, rowCount, colCount };
}

// Scope plumbing shared by the formatting/content-type builders: the cells a
// command targets, and the value they all agree on (undefined when mixed).
function scopeCells(ctx: MenuCtx, scope: FormattingScope) {
  const table = ctx.table;
  const cells = () => (table ? getCellsInScope(table, scope, ctx.cell) : []);
  const common = <T>(get: (c: HTMLElement) => T): T | undefined => {
    const list = cells();
    if (!list.length) return undefined;
    const first = get(list[0]);
    return list.every((c) => get(c) === first) ? first : undefined;
  };
  return { table, cells, seed: cells()[0], common };
}

// The Content Type chooser: an icon toggle per registered type, applied to
// every cell in the scope. Its own section in all four menus.
function buildContentTypeControls(ctx: MenuCtx, scope: FormattingScope): HTMLElement[] {
  const { table, cells, seed, common } = scopeCells(ctx, scope);
  if (!table || !seed) return [];
  const ctButtons: HTMLButtonElement[] = [];
  const refreshContent = () => {
    const cur = common((c) => getCurrentContentTypeId(c));
    ctButtons.forEach((b) => setToggleActive(b, !!cur && b.dataset.ctId === cur));
  };
  for (const opt of contentTypeOptions()) {
    const b = makeIconToggle(opt.icon, opt.englishName, false, () => {
      applyContentType(table, cells(), opt.id);
      refreshContent();
    });
    b.dataset.ctId = opt.id;
    ctButtons.push(b);
  }
  refreshContent();
  return [makeControlRow("Content Type", ctButtons)];
}

// The Content Type chooser as its own divider-separated section.
function buildContentTypeSection(ctx: MenuCtx, scope: FormattingScope): HTMLElement[] {
  const controls = buildContentTypeControls(ctx, scope);
  return controls.length ? [makeDivider(), ...controls] : [];
}

// The formatting controls shared by all four menus: Alignment, Padding,
// Fill + Border color, Corners. Each control applies to every cell in the
// given scope (the cell / its row / its column / the whole table), so the
// last command wins regardless of which menu it came from. Toggles light up
// only when every cell in the scope agrees (mixed state shows none active).
function buildFormattingControls(ctx: MenuCtx, scope: FormattingScope): HTMLElement[] {
  const els: HTMLElement[] = [];
  const { table, cells, seed, common } = scopeCells(ctx, scope);
  if (!table || !seed) return els;

  // Text alignment: label followed by left/center/right toggles.
  const aligns: { id: CellAlign; icon: string; title: string }[] = [
    { id: "start", icon: alignLeftIcon, title: "Left" },
    { id: "center", icon: alignCenterIcon, title: "Center" },
    { id: "end", icon: alignRightIcon, title: "Right" },
  ];
  const alignButtons: HTMLButtonElement[] = [];
  const refreshAlign = () => {
    const cur = common((c) => getCellAlign(c) || "center");
    alignButtons.forEach((b) => setToggleActive(b, !!cur && b.dataset.align === cur));
  };
  for (const a of aligns) {
    const b = makeIconToggle(a.icon, a.title, false, () => {
      applyAlignment(table, cells(), a.id);
      refreshAlign();
    });
    b.dataset.align = a.id;
    alignButtons.push(b);
  }
  els.push(makeControlRow("Alignment", alignButtons));
  refreshAlign();

  // Padding. Seeds from the scope's common value, or the first cell when mixed.
  els.push(
    makeSliderRow(
      "Padding between border and text",
      0,
      40,
      common((c) => firstPx(getCellPadding(c))) ?? firstPx(getCellPadding(seed)),
      "px",
      (v) => applyPadding(table, cells(), v),
    ),
  );

  // Fill and Border color side by side. Fill's table scope falls back to the
  // container color so a legacy table-level background still shows as current.
  // (common() maps "no cell has a fill" to null, which must reach the table
  // fallback — don't coalesce it to "" before the ?? chain.)
  const fillValue =
    common((c) => getCellBackground(c)) ??
    (scope === "table" ? getTableBackground(table) : null) ??
    "";
  els.push(
    makeColorPairRow([
      {
        label: "Fill",
        value: fillValue,
        onInput: (color) => applyFill(table, scope, cells(), color || null),
      },
      {
        label: "Border color",
        value: representativeBorderColorHex(seed),
        onInput: (color) => applyBorderColor(table, scope, cells(), color),
      },
    ]),
  );

  // Border style and weight, mirroring the sidebar's choices. The shown value
  // is the one every perimeter edge of every cell in the scope agrees on.
  const cellEdgeCommon = <T>(pick: (e: { weight: number; style: BorderStyle }) => T) =>
    common((c) => {
      const m = getCellPerimeterValueMap(c);
      const vals = [m.top, m.right, m.bottom, m.left].map(pick);
      return vals.every((v) => v === vals[0]) ? vals[0] : ("mixed" as const);
    });

  // Style and weight are coupled in the model (style "none" zeroes the
  // weight, weight 0 turns the style off, and either one can re-arm the
  // other), so every change refreshes BOTH toggle rows.
  const styleButtons: HTMLButtonElement[] = [];
  const weightButtons: HTMLButtonElement[] = [];
  const refreshBorderToggles = () => {
    const curStyle = cellEdgeCommon((e) => e.style);
    styleButtons.forEach((b) =>
      setToggleActive(b, curStyle !== undefined && curStyle !== "mixed" && b.dataset.style === curStyle),
    );
    const curWeight = cellEdgeCommon((e) => e.weight);
    weightButtons.forEach((b) =>
      setToggleActive(
        b,
        curWeight !== undefined && curWeight !== "mixed" && Number(b.dataset.weight) === curWeight,
      ),
    );
  };
  for (const style of ["none", "solid", "dashed", "dotted", "double"] as BorderStyle[]) {
    const b = makeBorderStyleToggle(style, () => {
      applyBorderStyle(table, scope, cells(), style);
      refreshBorderToggles();
    });
    styleButtons.push(b);
  }
  els.push(makeControlRow("Border Style", styleButtons));
  for (const weight of [0, 1, 2, 4] as BorderWeight[]) {
    const b = makeBorderWeightToggle(weight, () => {
      applyBorderWeight(table, scope, cells(), weight);
      refreshBorderToggles();
    });
    weightButtons.push(b);
  }
  els.push(makeControlRow("Border Weight", weightButtons));
  refreshBorderToggles();

  // Corners: corner radius (0/4/8/16) applied per cell.
  const cornerButtons: HTMLButtonElement[] = [];
  const refreshCorners = () => {
    const cur = common((c) => getCellCorners(c)?.radius ?? 0);
    cornerButtons.forEach((b) => setToggleActive(b, cur !== undefined && Number(b.dataset.radius) === cur));
  };
  for (const radius of [0, 4, 8, 16]) {
    const b = makeCornerToggle(radius, false, () => {
      applyCorners(table, cells(), radius);
      refreshCorners();
    });
    b.dataset.radius = String(radius);
    cornerButtons.push(b);
  }
  els.push(makeControlRow("Corners", cornerButtons));
  refreshCorners();

  return els;
}

// The formatting controls as a labeled sub-section (divider + "Format" header),
// used by all four menus.
function buildFormattingSection(ctx: MenuCtx, scope: FormattingScope): HTMLElement[] {
  const controls = buildFormattingControls(ctx, scope);
  if (!controls.length) return [];
  return [makeDivider(), makeMenuHeader("Format"), ...controls];
}

// Format transfer, per scope. The Table menu keeps Copy/Paste properties (the
// clipboard is plain data, so it can carry formatting across pages and
// documents). The Cell/Row/Column menus instead offer "Paint format": it
// snapshots this scope's cells and enters a mode where every subsequent click
// stamps that pattern onto the clicked cell's matching scope.
function buildCopyPasteSection(ctx: MenuCtx, scope: FormattingScope): HTMLElement[] {
  const { table, cells, seed } = scopeCells(ctx, scope);
  if (!table || !seed) return [];
  if (scope === "table") {
    return [
      makeDivider(),
      makeMenuItem("Copy properties", () => copyProperties(cells()), undefined, false, kCopyIconSvg),
      makeMenuItem(
        "Paste properties",
        () => pasteProperties(table, cells()),
        undefined,
        !hasCopiedProperties(),
        kPasteIconSvg,
      ),
    ];
  }
  return [
    makeDivider(),
    makeMenuItem(
      "Paint format",
      () => enterPaintFormatMode(table, scope, cells()),
      undefined,
      false,
      kPaintIconSvg,
    ),
  ];
}

// Paint Format mode lives in paint-format.ts; re-exported here so existing
// importers (attach.ts, tests) keep working.
export { enterPaintFormatMode, exitPaintFormatMode, isPaintFormatModeActive } from "./paint-format";

function buildCellSection(ctx: MenuCtx): HTMLElement[] {
  const els: HTMLElement[] = [makeMenuHeader("Cell")];
  const cell = ctx.cell;

  // Content Type is its own section, then the shared Format section.
  els.push(...buildContentTypeControls(ctx, "cell"));
  els.push(...buildFormattingSection(ctx, "cell"));

  els.push(...buildCopyPasteSection(ctx, "cell"));

  // Divider, then the span commands.
  els.push(makeDivider());

  // Merge / Split (cell span). Merge needs a column to the right to absorb;
  // Split needs an existing horizontal span to reduce.
  const spanX = cell ? getSpan(cell).x || 1 : 1;
  const canMerge = !!cell && ctx.col + spanX < ctx.colCount;
  const canSplit = spanX > 1;
  els.push(
    makeMenuItem("Merge with cell to the right", () => menuMergeCell(), undefined, !canMerge, cellMergeIcon),
  );
  els.push(makeMenuItem("Split", () => menuSplitCell(), undefined, !canSplit, cellSplitIcon));
  return els;
}

function buildRowSection(ctx: MenuCtx): HTMLElement[] {
  return [
    makeMenuHeader("Row"),
    // 1) adds
    makeMenuItem("Add Row Above", () => menuAddRow(0), undefined, false, kAddRowAboveIconSvg),
    makeMenuItem("Add Row Below", () => menuAddRow(1), undefined, false, kAddRowBelowIconSvg),
    // 2) moves
    makeMenuItem("Move Row Up", () => menuMoveRow(-1), undefined, ctx.row <= 0, kMoveUpIconSvg),
    makeMenuItem(
      "Move Row Down",
      () => menuMoveRow(1),
      undefined,
      ctx.row >= ctx.rowCount - 1,
      kMoveDownIconSvg,
    ),
    // 3) size
    makeDivider(),
    buildSizeControl(ctx, "row"),
    // 4) content type + formatting, applied to every cell in the row
    ...buildContentTypeSection(ctx, "row"),
    ...buildFormattingSection(ctx, "row"),
    ...buildCopyPasteSection(ctx, "row"),
    // 5) duplicate/delete, the last commands in the menu
    makeDivider(),
    makeMenuItem("Duplicate Row", menuDuplicateRow, undefined, false, kCopyIconSvg),
    makeMenuItem("Delete Row", tryRemoveRow, "row", false, kTrashIconSvg),
    // 6) hint
    makeInfoNote("Right click on a cell for Cell menu"),
  ];
}

function buildColumnSection(ctx: MenuCtx): HTMLElement[] {
  return [
    makeMenuHeader("Column"),
    // 1) adds
    makeMenuItem("Add Column Left", () => menuAddColumn(0), undefined, false, kAddColumnLeftIconSvg),
    makeMenuItem("Add Column Right", () => menuAddColumn(1), undefined, false, kAddColumnRightIconSvg),
    // 2) moves
    makeMenuItem("Move Left", () => menuMoveColumn(-1), undefined, ctx.col <= 0, kMoveLeftIconSvg),
    makeMenuItem(
      "Move Right",
      () => menuMoveColumn(1),
      undefined,
      ctx.col >= ctx.colCount - 1,
      kMoveRightIconSvg,
    ),
    // 3) size
    makeDivider(),
    buildSizeControl(ctx, "column"),
    // 4) content type + formatting, applied to every cell in the column
    ...buildContentTypeSection(ctx, "column"),
    ...buildFormattingSection(ctx, "column"),
    ...buildCopyPasteSection(ctx, "column"),
    // 5) duplicate/delete, the last commands in the menu
    makeDivider(),
    makeMenuItem("Duplicate Column", menuDuplicateColumn, undefined, false, kCopyIconSvg),
    makeMenuItem("Delete Column", tryRemoveColumn, "column", false, columnDeleteIcon),
    // 6) hint
    makeInfoNote("Right click on a cell for Cell menu"),
  ];
}

function buildTableSection(ctx: MenuCtx): HTMLElement[] {
  const els: HTMLElement[] = [makeMenuHeader("Table")];
  const table = ctx.table;
  if (table) {
    // Content type + formatting, applied to every cell in the table (the
    // Format section includes the Fill and Border color controls that used to
    // live directly in this section).
    els.push(...buildContentTypeSection(ctx, "table"));
    els.push(...buildFormattingSection(ctx, "table"));

    // Spacing sliders follow the Format section (right after Corners).
    els.push(
      makeSliderRow(
        "Horizontal space between cells",
        0,
        40,
        firstPx(getGapX(table)[0]),
        "px",
        (v) => {
          setGapX(table, `${v}px`);
          render(table);
        },
      ),
    );
    els.push(
      makeSliderRow(
        "Vertical space between cells",
        0,
        40,
        firstPx(getGapY(table)[0]),
        "px",
        (v) => {
          setGapY(table, `${v}px`);
          render(table);
        },
      ),
    );

    els.push(...buildCopyPasteSection(ctx, "table"));
  }
  els.push(makeDivider());
  els.push(makeMenuItem("Copy Table", menuCopyTable, undefined, false, kCopyIconSvg));
  els.push(makeMenuItem("Cut Table", menuCutTable, undefined, false, kCutIconSvg));
  els.push(makeDivider());
  els.push(makeMenuItem("Delete Table", menuDeleteTable, undefined, false, kTrashIconSvg));
  return els;
}

const sectionBuilders: Record<SectionName, (ctx: MenuCtx) => HTMLElement[]> = {
  cell: buildCellSection,
  row: buildRowSection,
  column: buildColumnSection,
  table: buildTableSection,
};

// ----- Popup lifecycle -----
function onDocMouseDownForMenu(e: MouseEvent): void {
  const t = e.target as Node | null;
  if (!t) return;
  if (
    (menuPopup && menuPopup.contains(t)) ||
    (colMenuPill && colMenuPill.contains(t)) ||
    (rowMenuPill && rowMenuPill.contains(t)) ||
    (tablePillTL && tablePillTL.contains(t))
  ) {
    return;
  }
  closeMenuPopup();
}

function onKeyDownForMenu(e: KeyboardEvent): void {
  if (e.key === "Escape") closeMenuPopup();
}

function closeMenuPopup(): void {
  if (menuPopup) {
    menuPopup.remove();
    menuPopup = null;
  }
  menuOpenId = null;
  menuTargetCell = null;
  document.removeEventListener("mousedown", onDocMouseDownForMenu, true);
  document.removeEventListener("keydown", onKeyDownForMenu, true);
}

// Open a pill's single-section menu (toggling closed if already open).
function togglePillMenu(kind: MenuKind, pill: HTMLButtonElement, id: string): void {
  if (menuPopup && menuOpenId === id) {
    closeMenuPopup();
    return;
  }
  const sel = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  openMenu([kind], { pill, kind }, id, sel);
}

type MenuAnchor =
  | { pill: HTMLButtonElement; kind: MenuKind }
  | { x: number; y: number };

function openMenu(
  sections: SectionName[],
  anchor: MenuAnchor,
  id: string,
  targetCell: HTMLElement | null,
): void {
  closeMenuPopup();
  menuTargetCell = targetCell;
  const ctx = buildMenuCtx(targetCell);

  const popup = document.createElement("div");
  popup.setAttribute("data-btable-menu", sections.join("+"));
  // Appended to <body>; tag it so prepare-for-save strips it.
  popup.setAttribute("data-table-overlay", "menu");
  popup.setAttribute("role", "menu");
  Object.assign(popup.style, {
    position: "fixed",
    zIndex: "2147483647",
    minWidth: "200px",
    background: "#fff",
    color: "#222",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: "8px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    padding: "4px 0",
    fontSize: "13px",
    fontFamily: "system-ui, sans-serif",
    userSelect: "none",
  } as CSSStyleDeclaration);

  sections.forEach((name, i) => {
    if (i > 0) popup.appendChild(makeDivider());
    for (const el of sectionBuilders[name](ctx)) popup.appendChild(el);
  });

  document.body.appendChild(popup);
  menuPopup = popup;
  menuOpenId = id;
  if ("pill" in anchor) positionMenuAtPill(popup, anchor.pill, anchor.kind);
  else positionMenuAtPoint(popup, anchor.x, anchor.y);

  document.addEventListener("mousedown", onDocMouseDownForMenu, true);
  document.addEventListener("keydown", onKeyDownForMenu, true);
}

function positionMenuAtPill(popup: HTMLDivElement, pill: HTMLButtonElement, kind: MenuKind): void {
  const r = pill.getBoundingClientRect();
  // The row pill sits left of its row; open to its right. Column/table pills sit
  // above/at a corner; drop the menu down from them.
  positionMenuAtPoint(popup, kind === "row" ? r.right + 4 : r.left, kind === "row" ? r.top : r.bottom + 4);
}

function positionMenuAtPoint(popup: HTMLDivElement, x: number, y: number): void {
  const pw = popup.offsetWidth || 200;
  const ph = popup.offsetHeight || 0;
  const left = Math.max(4, Math.min(x, window.innerWidth - pw - 4));
  const top = Math.max(4, Math.min(y, window.innerHeight - ph - 4));
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

// --- Menu operation handlers (operate on the menu's target cell / table) ---
function getMenuCell(): HTMLElement | null {
  return menuTargetCell ?? document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
}
function getMenuTable(): HTMLElement | null {
  const cell = getMenuCell();
  return (cell?.closest(".bloom-table") as HTMLElement | null) ?? overlayTable;
}

// Insert a column relative to the current cell. offset 0 = left (before),
// offset 1 = right (after). With no selection, falls back to the table edge.
function menuAddColumn(offset: number): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) controller.addColumnAt(getRowAndColumn(table, cell).column + offset);
    else controller.addColumnAt(offset === 0 ? 0 : getTableInfo(table).columnCount);
    scheduleOverlayReposition();
  } catch {}
}

// Insert a row relative to the current cell. offset 0 = above (before),
// offset 1 = below (after). With no selection, falls back to the table edge.
function menuAddRow(offset: number): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) controller.addRowAt(getRowAndColumn(table, cell).row + offset);
    else controller.addRowAt(offset === 0 ? 0 : getTableInfo(table).rowCount);
    scheduleOverlayReposition();
  } catch {}
}

function menuMoveRow(delta: number): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table || !cell) return;
  try {
    const { row } = getRowAndColumn(table, cell);
    const to = row + delta;
    if (to < 0 || to >= getTableInfo(table).rowCount) return;
    new BloomTable(table).moveRowAt(row, to);
    scheduleOverlayReposition();
  } catch {}
}

function menuMoveColumn(delta: number): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table || !cell) return;
  try {
    const { column } = getRowAndColumn(table, cell);
    const to = column + delta;
    if (to < 0 || to >= getTableInfo(table).columnCount) return;
    new BloomTable(table).moveColumnAt(column, to);
    scheduleOverlayReposition();
  } catch {}
}

function menuDuplicateRow(): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table || !cell) return;
  try {
    const { row } = getRowAndColumn(table, cell);
    new BloomTable(table).duplicateRowAt(row);
    scheduleOverlayReposition();
  } catch {}
}

function menuDuplicateColumn(): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table || !cell) return;
  try {
    const { column } = getRowAndColumn(table, cell);
    new BloomTable(table).duplicateColumnAt(column);
    scheduleOverlayReposition();
  } catch {}
}

function menuMergeCell(): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table || !cell) return;
  try {
    const controller = new BloomTable(table);
    const s = controller.getSpan(cell);
    controller.setSpan(cell, (s.x || 1) + 1, s.y || 1);
    scheduleOverlayReposition();
  } catch {}
}

function menuSplitCell(): void {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table || !cell) return;
  try {
    const controller = new BloomTable(table);
    const s = controller.getSpan(cell);
    controller.setSpan(cell, Math.max(1, (s.x || 1) - 1), s.y || 1);
    scheduleOverlayReposition();
  } catch {}
}

function menuCopyTable(): void {
  const table = getMenuTable();
  if (!table) return;
  try {
    void navigator.clipboard?.writeText(table.outerHTML);
  } catch {}
}

function menuCutTable(): void {
  const table = getMenuTable();
  if (!table) return;
  try {
    void navigator.clipboard?.writeText(table.outerHTML);
  } catch {}
  removeTable(table);
}

function menuDeleteTable(): void {
  const table = getMenuTable();
  if (!table) return;
  removeTable(table);
}

function removeTable(table: HTMLElement): void {
  hideEdgeOverlays();
  table.remove();
}

// Marks the table the pointer is near (the same active zone that reveals the
// pills). bloom-table-edit.css gates the edit-time chrome — selection outline,
// selected-cell tint, boundary hints — on this class, so all of it disappears
// together when the mouse leaves the table.
const kPointerNearClass = "bloom-pointer-near";

function showEdgeOverlays(table: HTMLElement) {
  // While painting formats, the pills stay hidden no matter which path
  // (focusin, contextmenu, proximity gate) tries to raise them.
  if (isPaintFormatModeActive()) return;
  if (overlayTable && overlayTable !== table) overlayTable.classList.remove(kPointerNearClass);
  table.classList.add(kPointerNearClass);
  overlayTable = table;
  ensureEdgeOverlays();
  // The clusters target the current row/column, so they only make sense when
  // one of THIS table's own cells is selected (a nested table's selection
  // doesn't count — its own overlays handle it).
  const hasSelection = !!ownSelectedCell(table);
  if (colCluster) colCluster.style.display = hasSelection ? "flex" : "none";
  if (rowCluster) rowCluster.style.display = hasSelection ? "flex" : "none";
  // Table pills and the "+" add buttons are table-level, so they show whenever
  // the table is active (regardless of whether a cell is selected).
  if (tablePillTL) tablePillTL.style.display = "flex";
  if (colAddBtn) colAddBtn.style.display = "flex";
  if (rowAddBtn) rowAddBtn.style.display = "flex";
  // Apply anchor-based positioning
  applyAnchorPositioning(table);
}

// Entering Paint Format must drop the pills; paint-format.ts can't import
// hideEdgeOverlays directly (that would be a circular import), so it takes
// the callback. Function declarations hoist, so registering here at module
// scope is safe.
setPaintFormatOverlayHider(hideEdgeOverlays);

function hideEdgeOverlays() {
  overlayTable?.classList.remove(kPointerNearClass);
  if (colCluster) colCluster.style.display = "none";
  if (rowCluster) rowCluster.style.display = "none";
  if (tablePillTL) tablePillTL.style.display = "none";
  if (colAddBtn) colAddBtn.style.display = "none";
  if (rowAddBtn) rowAddBtn.style.display = "none";
  closeMenuPopup();
  overlayTable = null;
  hideDeletePreview();
  hideAddPreview();
}

function scheduleOverlayReposition() {
  if (repositionRaf) cancelAnimationFrame(repositionRaf);
  repositionRaf = requestAnimationFrame(() => {
    repositionEdgeOverlays();
  });
}

function repositionEdgeOverlays() {
  // Only ever reposition the table the overlays are already on. Adopting a
  // table here (the selected cell's, or the document's first) made a plain
  // scroll or resize reveal an arbitrary table's pills with the pointer nowhere
  // near it; showEdgeOverlays (focus / proximity gate) is the only entry point
  // allowed to decide which table is active.
  const targetTable = overlayTable;
  if (!targetTable) return;
  if (!document.body.contains(targetTable)) {
    hideEdgeOverlays();
    return;
  }

  // Ensure wrappers remain configured for the current table anchor
  applyAnchorPositioning(targetTable);

  // If a delete preview is visible, reposition/update it to track row/column bounds
  if (deletePreviewVisible) {
    updateDeletePreviewGeometry();
  }
  // If an add preview is visible, reposition/update it as well
  if (addPreviewVisible) {
    updateAddPreviewGeometry();
  }
}

// ===== Pointer-proximity visibility gate (expanded "active zone") =====
// We want the affordances hidden whenever the cursor isn't at the table — but the
// affordances themselves live in a gutter *outside* the table's cell content
// (corner pills sit ~14px out and span ~50px, edge "+" buttons ~8px out).
// Hiding on a literal table
// `mouseleave` would fire the instant the cursor crossed into that gutter to reach
// one — the classic "reach gap".
//
// Instead we gate on the cursor's position relative to an EXPANDED zone: the union
// of the table's visible-cell rects grown by kActiveZonePadding. That padding is
// comfortably larger than the farthest affordance offset (~64px at the corners),
// so moving toward any affordance keeps the cursor inside the zone. It's pure
// geometry evaluated on mousemove — there is no leave event and therefore no gap.
const kActiveZonePadding = 70; // px beyond cell-content bounds; must exceed the farthest affordance offset

let gateMouseX = 0;
let gateMouseY = 0;
let gateRaf = 0;
let gateInstalled = false; // independent of `installed` so the listener is added exactly once

// Union of the table's visible cell rects (viewport coords); null when the
// table has no laid-out cells. Shared by the proximity gate,
// applyAnchorPositioning, and the add-preview geometry.
function visibleCellBounds(
  table: HTMLElement,
): { minL: number; minT: number; maxR: number; maxB: number } | null {
  let minL = Infinity,
    minT = Infinity,
    maxR = -Infinity,
    maxB = -Infinity;
  for (const child of Array.from(table.children)) {
    if (!(child instanceof HTMLElement) || !child.classList.contains("bloom-cell")) continue;
    const r = child.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.left < minL) minL = r.left;
    if (r.top < minT) minT = r.top;
    if (r.right > maxR) maxR = r.right;
    if (r.bottom > maxB) maxB = r.bottom;
  }
  if (!isFinite(minL) || !isFinite(maxR)) return null;
  return { minL, minT, maxR, maxB };
}

function pointerInActiveZone(table: HTMLElement, x: number, y: number): boolean {
  const b = visibleCellBounds(table);
  if (!b) return false;
  const pad = kActiveZonePadding;
  return x >= b.minL - pad && x <= b.maxR + pad && y >= b.minT - pad && y <= b.maxB + pad;
}

function updateProximityGate(): void {
  // While painting formats, the pills stay out of the way entirely.
  if (isPaintFormatModeActive()) {
    if (overlayTable) hideEdgeOverlays();
    return;
  }
  // Keep the affordances up while a menu is open — the popup commonly extends
  // past the active zone, so the cursor would read as "outside" while the user
  // is still interacting with it.
  if (menuPopup) return;

  // Prefer the table already targeted (cheap, and avoids re-running showEdgeOverlays
  // every frame while hovering). Otherwise scan all tables so a first hover — before
  // any cell is focused — can reveal the table-level affordances too.
  let near: HTMLElement | null = null;
  const matches = Array.from(document.querySelectorAll<HTMLElement>(".bloom-table")).filter((t) =>
    pointerInActiveZone(t, gateMouseX, gateMouseY),
  );
  if (matches.length) {
    // Stay with the current table, except that a table nested inside it wins
    // when the pointer is over it — the nested zone lies entirely inside the
    // outer's, so the outer would otherwise capture the pointer forever.
    const sticky =
      overlayTable && document.body.contains(overlayTable) && matches.includes(overlayTable)
        ? overlayTable
        : null;
    const candidates = sticky ? matches.filter((t) => t === sticky || sticky.contains(t)) : matches;
    // Innermost candidate: the one that contains no other candidate.
    near = candidates.find((t) => !candidates.some((o) => o !== t && t.contains(o))) ?? candidates[0];
  }

  if (near) {
    // Re-show even for the current table if its pointer-near class is missing
    // (e.g. a re-render replaced the class list while the table stayed active).
    if (near !== overlayTable || !near.classList.contains(kPointerNearClass)) {
      showEdgeOverlays(near);
    }
  } else if (overlayTable) {
    hideEdgeOverlays();
  }
}

// Named (not inline) so resetTableSizeButtons can remove it again: an
// anonymous closure here would keep driving the gate after a reset, rebuilding
// the very overlay DOM the reset just cleared.
function onMouseMoveForProximityGate(e: MouseEvent): void {
  gateMouseX = e.clientX;
  gateMouseY = e.clientY;
  // Coalesce bursts of mousemove into one evaluation per frame.
  if (typeof requestAnimationFrame !== "function") {
    updateProximityGate();
    return;
  }
  if (gateRaf) return;
  gateRaf = requestAnimationFrame(() => {
    gateRaf = 0;
    updateProximityGate();
  });
}

function installProximityGate(): void {
  if (gateInstalled) return;
  gateInstalled = true;
  document.addEventListener("mousemove", onMouseMoveForProximityGate, { passive: true });
}

// Removes anchor names that were NOT minted this session from `root` and its
// descendants. Called on attach: content loaded from a save (or pasted in)
// can carry anchor names baked by a previous session, and those collide with
// this session's counter (which restarts at 0), making pills anchor to the
// wrong cell. Names minted this session are left alone (re-attach case).
export function scrubStaleAnchorNames(root: HTMLElement): void {
  const scrub = (el: HTMLElement) => {
    const name = el.dataset.btableAnchorName;
    if (!name || mintedAnchorNames.has(name)) return;
    el.style.removeProperty("anchor-name");
    delete el.dataset.btableAnchorName;
  };
  scrub(root);
  root.querySelectorAll<HTMLElement>("[data-btable-anchor-name]").forEach(scrub);
}

// Create or retrieve a unique anchor-name for an element. Only names minted in
// THIS session may be reused: content loaded from saved/undo HTML can carry
// stale anchor names (removeTableEditingArtifacts strips them, but hosts may
// have older saves, and history restores raw innerHTML), and a stale
// --btable-cell-N would collide with a freshly minted one, anchoring the pills
// to whichever other element holds the same name.
function getElementAnchorName(el: HTMLElement, key: string, prefix: string): string {
  const existing = (el.dataset as any)[key] as string | undefined;
  if (existing && mintedAnchorNames.has(existing)) return existing;
  const name = `--${prefix}-${++anchorCounter}`;
  mintedAnchorNames.add(name);
  (el.style as any).anchorName = name;
  el.style.setProperty("anchor-name", name);
  (el.dataset as any)[key] = name;
  return name;
}

// The selected cell belonging to THIS table (direct child), or null. A
// descendant query would also find a selected cell inside a nested table.
function ownSelectedCell(table: HTMLElement): HTMLElement | null {
  for (const el of Array.from(table.children)) {
    if (
      el instanceof HTMLElement &&
      el.classList.contains("bloom-cell") &&
      el.classList.contains("cell--selected")
    ) {
      return el;
    }
  }
  return null;
}

function getCellAt(table: HTMLElement, targetRow: number, targetCol: number): HTMLElement | null {
  // One grid model instead of a per-child getRowAndColumn rescan; null on
  // miss (out of range, or the DOM has no cell at that position).
  return buildGrid(table).cellAt(targetRow, targetCol) ?? null;
}

// Anchor the two contextual clusters (and the corner handle) to the current
// selection. The column cluster sits above the selected column; the row cluster
// sits to the left of the selected row.
function applyAnchorPositioning(table: HTMLElement) {
  // Repositioning re-decides visibility; while Paint Format is active the
  // overlays must stay hidden no matter what triggers a reposition.
  if (isPaintFormatModeActive()) {
    hideEdgeOverlays();
    return;
  }
  const gap = 8; // px
  let rows = 0,
    cols = 0;
  try {
    const info = getTableInfo(table);
    rows = info.rowCount;
    cols = info.columnCount;
  } catch {}

  // Resolve the selected cell's row/column; clusters anchor to the edge cell of
  // that line (top cell for the column, first cell for the row). The selected
  // cell must be one of THIS table's own cells — a querySelector would also
  // match a cell of a nested table, whose position can't be resolved against
  // this table, and the pills would silently anchor to cell (0,0).
  const selected = ownSelectedCell(table);
  let selRow = 0,
    selCol = 0;
  if (selected) {
    try {
      const pos = getRowAndColumn(table, selected);
      selRow = pos.row;
      selCol = pos.column;
    } catch {}
  }
  const colAnchorCell = selected && rows && cols ? getCellAt(table, 0, selCol) : null;
  const rowAnchorCell = selected && rows && cols ? getCellAt(table, selRow, 0) : null;

  const anchorTo = (
    prox: ProximityDiv | null,
    cell: HTMLElement | null,
    side: "top" | "left",
  ) => {
    if (!prox || !cell) return;
    const el = prox.element;
    el.style.position = "fixed";
    const a = getElementAnchorName(cell, "btableAnchorName", "btable-cell");
    (el.style as any).positionAnchor = a;
    el.style.setProperty("position-anchor", a);
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    if (side === "top") {
      // Above the column, centered on its horizontal midline.
      (el.style as any).top = `calc(anchor(top) - ${gap}px)`;
      (el.style as any).left = `anchor(center)`;
      el.style.transform = "translate(-50%, -100%)";
    } else {
      // Left of the row, centered on its vertical midline.
      (el.style as any).left = `calc(anchor(left) - ${gap}px)`;
      (el.style as any).top = `anchor(center)`;
      el.style.transform = "translate(-100%, -50%)";
    }
  };

  // Clusters only make sense anchored to a selected row/column. Re-evaluate
  // their visibility on EVERY reposition (not just showEdgeOverlays): an
  // operation that clears the selection or removes the anchored cell must hide
  // the "..." pill, otherwise anchorTo() early-returns and leaves it stranded
  // mid-table (the "phantom" affordance).
  if (colCluster) colCluster.style.display = colAnchorCell ? "flex" : "none";
  if (rowCluster) rowCluster.style.display = rowAnchorCell ? "flex" : "none";
  anchorTo(proxColCluster, colAnchorCell, "top");
  anchorTo(proxRowCluster, rowAnchorCell, "left");

  // The table-level affordances are positioned relative to the table's *cell
  // content* bounds (not the layout box, which can be much larger than the
  // hugging cells): the union rect of the visible cells. A spanning cell's
  // rect covers the area its skipped neighbours would, so this is robust to
  // spans too.
  const b = visibleCellBounds(table);
  const haveBounds = b !== null;
  const placePill = (prox: ProximityDiv | null, left: number, top: number, transform: string) => {
    if (!prox) return;
    const el = prox.element;
    el.style.position = "fixed";
    el.style.removeProperty("position-anchor");
    (el.style as any).positionAnchor = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.transform = transform;
  };
  // The table-level affordances (corner pills, "+" buttons) are
  // only meaningful when the table has rendered cells. Hide them when bounds are
  // degenerate so they don't strand mid-viewport during a transient relayout.
  if (tablePillTL) tablePillTL.style.display = haveBounds ? "flex" : "none";
  if (colAddBtn) colAddBtn.style.display = haveBounds ? "flex" : "none";
  if (rowAddBtn) rowAddBtn.style.display = haveBounds ? "flex" : "none";
  if (b) {
    const { minL, minT, maxR, maxB } = b;
    // "+" add buttons hug the table edges, centered on the table's content box.
    const midX = (minL + maxR) / 2;
    const midY = (minT + maxB) / 2;

    // Row "+" below the table, horizontally centered.
    placePill(proxRowAdd, midX, maxB + gap, "translate(-50%, 0)");
    // Column "+" to the right of the table, vertically centered.
    placePill(proxColAdd, maxR + gap, midY, "translate(0, -50%)");

    // Table pill: sits *below* the table so that opening its menu (which drops
    // downward) doesn't cover the table contents being edited. It shares the
    // band below the table with the row "+" add button (centered there), so
    // slide the pill sideways to clear it — preferring left, and falling back
    // to the right only when the left position would run off the table's edge.
    let tablePillX = midX;
    if (tablePillTL && rowAddBtn) {
      const tablePillW = tablePillTL.getBoundingClientRect().width || 50;
      const rowAddW = rowAddBtn.getBoundingClientRect().width || 30;
      const minClear = tablePillW / 2 + rowAddW / 2 + 8; // keep an 8px gap
      const leftPos = midX - minClear;
      tablePillX = leftPos >= minL ? leftPos : midX + minClear;
      // Don't let the shifted pill drift past the table's own edges.
      tablePillX = Math.max(minL, Math.min(maxR, tablePillX));
    }
    placePill(proxTablePillTL, tablePillX, maxB + gap, "translate(-50%, 0)");
  }

}

// The table-edge "+" buttons always append at the far edge of the table,
// regardless of which cell is selected. (Use the row/column menus to insert
// relative to the current cell.) The new row/column inherits ALL settings of
// the adjacent one — the last row/column, not the selected one.
function tryInsertColumnRight() {
  const cell = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  const table = (cell?.closest(".bloom-table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const widths = getColumnWidths(table);
    new BloomTable(table).addColumnAt(widths.length, widths.length > 0 ? widths.length - 1 : undefined);
    scheduleOverlayReposition();
  } catch {}
}

function tryInsertRowBelow() {
  const cell = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  const table = (cell?.closest(".bloom-table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const heights = getRowHeights(table);
    new BloomTable(table).addRowAt(heights.length, heights.length > 0 ? heights.length - 1 : undefined);
    scheduleOverlayReposition();
  } catch {}
}

function tryRemoveColumn() {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) {
      const { column } = getRowAndColumn(table, cell);
      controller.removeColumnAt(column);
    }
    scheduleOverlayReposition();
  } catch {}
}

function tryRemoveRow() {
  const cell = getMenuCell();
  const table = getMenuTable();
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) {
      const { row } = getRowAndColumn(table, cell);
      controller.removeRowAt(row);
    }
    scheduleOverlayReposition();
  } catch {}
}

// ===== Delete Hover Preview =====
function ensureDeletePreviewDiv(): HTMLDivElement {
  if (deletePreviewDiv) return deletePreviewDiv;
  const div = document.createElement("div");
  Object.assign(div.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: "0px",
    height: "0px",
    pointerEvents: "none",
    zIndex: "2147483646", // just below the buttons
    display: "none",
  } as CSSStyleDeclaration);
  // Create an SVG with two diagonal lines (red X)
  div.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none">
      <line x1="0" y1="0" x2="100%" y2="100%" stroke="#e53935" stroke-width="2" stroke-linecap="round" />
      <line x1="100%" y1="0" x2="0" y2="100%" stroke="#e53935" stroke-width="2" stroke-linecap="round" />
    </svg>`;
  div.setAttribute("data-table-overlay", "delete-preview");
  document.body.appendChild(div);
  deletePreviewDiv = div;
  return div;
}

// The cell the delete preview must measure: the very cell tryRemoveRow /
// tryRemoveColumn will act on, and only when it belongs to the table the
// overlays are tracking. A document-wide `.cell--selected` lookup could return a
// cell of another (e.g. nested) table, which getRowAndColumn then rejects with a
// throw from inside a mouseenter handler.
function deletePreviewCell(): HTMLElement | null {
  const table = overlayTable;
  if (!table) return null;
  const cell = menuTargetCell ?? ownSelectedCell(table);
  if (!cell || cell.parentElement !== table) return null;
  return cell;
}

function showDeletePreview(kind: PreviewKind) {
  if (!overlayTable) return;
  if (!deletePreviewCell()) return;
  currentPreviewKind = kind;
  const div = ensureDeletePreviewDiv();
  deletePreviewVisible = true;
  updateDeletePreviewGeometry();
  div.style.display = "block";
}

function hideDeletePreview() {
  deletePreviewVisible = false;
  currentPreviewKind = null;
  if (deletePreviewDiv) deletePreviewDiv.style.display = "none";
}

function updateDeletePreviewGeometry() {
  if (!deletePreviewVisible || !overlayTable || !deletePreviewDiv) return;
  const target = deletePreviewCell();
  if (!target) {
    hideDeletePreview();
    return;
  }
  const { row, column } = getRowAndColumn(overlayTable, target);
  // Find all visible cells and compute bounds for the target row/column
  const cells: HTMLElement[] = Array.from(overlayTable.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("bloom-cell"),
  );
  let minLeft = Infinity,
    maxRight = -Infinity,
    minTop = Infinity,
    maxBottom = -Infinity;
  for (const cell of cells) {
    const { row: r, column: c } = getRowAndColumn(overlayTable, cell);
    const match = currentPreviewKind === "row" ? r === row : c === column;
    if (!match) continue;
    const rect = cell.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.left < minLeft) minLeft = rect.left;
    if (rect.right > maxRight) maxRight = rect.right;
    if (rect.top < minTop) minTop = rect.top;
    if (rect.bottom > maxBottom) maxBottom = rect.bottom;
  }
  if (!isFinite(minLeft) || !isFinite(maxRight) || !isFinite(minTop) || !isFinite(maxBottom)) {
    hideDeletePreview();
    return;
  }
  const left = Math.round(window.scrollX + minLeft);
  const top = Math.round(window.scrollY + minTop);
  const width = Math.round(maxRight - minLeft);
  const height = Math.round(maxBottom - minTop);
  Object.assign(deletePreviewDiv.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    display: "block",
  } as CSSStyleDeclaration);
}

// ===== Add Hover Preview (pulsing bar) =====
let addPreviewDiv: HTMLDivElement | null = null;
let addPreviewVisible = false;
let currentAddKind: PreviewKind | null = null;
let currentAddPosition: "above" | "below" | "left" | "right" | null = null;

function ensureAddPreviewDiv(): HTMLDivElement {
  if (addPreviewDiv) return addPreviewDiv;
  const div = document.createElement("div");
  Object.assign(div.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: "0px",
    height: "0px",
    pointerEvents: "none",
    zIndex: "2147483646",
    display: "none",
    backgroundColor: kBloomBlue,
    opacity: "0.6",
    animation: "btable-pulse 2.8s ease-in-out infinite",
    borderRadius: "3px",
  } as CSSStyleDeclaration);
  div.setAttribute("data-table-overlay", "add-preview");
  document.body.appendChild(div);
  addPreviewDiv = div;
  return div;
}

function showAddPreview(kind: PreviewKind, position: "above" | "below" | "left" | "right") {
  if (!overlayTable) return;
  currentAddKind = kind;
  currentAddPosition = position;
  const div = ensureAddPreviewDiv();
  addPreviewVisible = true;
  updateAddPreviewGeometry();
  div.style.display = "block";
}

function hideAddPreview() {
  addPreviewVisible = false;
  currentAddKind = null;
  currentAddPosition = null;
  if (addPreviewDiv) addPreviewDiv.style.display = "none";
}

function updateAddPreviewGeometry() {
  if (!addPreviewVisible || !overlayTable || !addPreviewDiv) return;
  if (!currentAddKind || !currentAddPosition) return;
  // The edge "+" buttons always append at the FAR edge of the table, whatever is
  // selected (see tryInsertRowBelow / tryInsertColumnRight), so the preview bar
  // spans the whole table and sits on the table's own boundary. Measuring the
  // selected row/column instead drew the bar in the wrong place, and threw when
  // the selected cell belonged to a different table than overlayTable.
  const b = visibleCellBounds(overlayTable);
  if (!b) {
    hideAddPreview();
    return;
  }
  const { minL: minLeft, maxR: maxRight, minT: minTop, maxB: maxBottom } = b;

  if (currentAddKind === "row") {
    const boundary = currentAddPosition === "above" ? minTop : maxBottom;
    const left = Math.round(window.scrollX + minLeft);
    const width = Math.round(maxRight - minLeft);
    const top = Math.round(window.scrollY + boundary - kAddPreviewThickness / 2);
    const height = kAddPreviewThickness;
    Object.assign(addPreviewDiv.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      display: "block",
    } as CSSStyleDeclaration);
  } else {
    const boundary = currentAddPosition === "left" ? minLeft : maxRight;
    const top = Math.round(window.scrollY + minTop);
    const height = Math.round(maxBottom - minTop);
    const left = Math.round(window.scrollX + boundary - kAddPreviewThickness / 2);
    const width = kAddPreviewThickness;
    Object.assign(addPreviewDiv.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      display: "block",
    } as CSSStyleDeclaration);
  }
}
