// Four edge "+" buttons shown around the visible bounds of the selected table.
// Right/Left insert columns; Top/Bottom insert rows.

import { BloomTable } from "./BloomTable";
import { getTableInfo, getRowAndColumn } from "./structure";
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
  snapshotCellProperties,
  paintProperties,
  type CopiedCellProperties,
} from "./formatting-commands";
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

// Inline SVG icons (MUI "Add" and "Delete" glyph paths) so the core attach
// path stays free of React / MUI. fill:currentColor lets the button color
// drive the glyph color.
const kAddIconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" style="width:18px;height:18px;display:block;fill:currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
// Inline glyphs (16px, fill:currentColor) for menu items that have no toolbar
// icon: directional move arrows, copy, and delete-table.
const kIconAttr = `viewBox="0 0 24 24" width="16" height="16" style="width:16px;height:16px;display:block;fill:currentColor"`;
// Directional "add" glyphs: a "+" paired with the edge line the new row/column
// lands against. The "+" sits on the side the line is being added.
const kAddRowAboveIconSvg = `<svg ${kIconAttr}><rect x="10.5" y="2" width="3" height="11" rx="0.5"/><rect x="6" y="6" width="12" height="3" rx="0.5"/><rect x="3" y="19" width="18" height="2.5" rx="1"/></svg>`;
const kAddRowBelowIconSvg = `<svg ${kIconAttr}><rect x="3" y="2.5" width="18" height="2.5" rx="1"/><rect x="10.5" y="11" width="3" height="11" rx="0.5"/><rect x="6" y="15" width="12" height="3" rx="0.5"/></svg>`;
const kAddColumnLeftIconSvg = `<svg ${kIconAttr}><rect x="6" y="6" width="3" height="12" rx="0.5"/><rect x="1.5" y="10.5" width="12" height="3" rx="0.5"/><rect x="19" y="3" width="2.5" height="18" rx="1"/></svg>`;
const kAddColumnRightIconSvg = `<svg ${kIconAttr}><rect x="2.5" y="3" width="2.5" height="18" rx="1"/><rect x="15" y="6" width="3" height="12" rx="0.5"/><rect x="10.5" y="10.5" width="12" height="3" rx="0.5"/></svg>`;
const kMoveUpIconSvg = `<svg ${kIconAttr}><path d="M12 4l-7 7h4v7h6v-7h4z"/></svg>`;
const kMoveDownIconSvg = `<svg ${kIconAttr}><path d="M12 20l7-7h-4V6H9v7H5z"/></svg>`;
const kMoveLeftIconSvg = `<svg ${kIconAttr}><path d="M4 12l7-7v4h7v6h-7v4z"/></svg>`;
const kMoveRightIconSvg = `<svg ${kIconAttr}><path d="M20 12l-7-7v4H6v6h7v4z"/></svg>`;
const kCopyIconSvg = `<svg ${kIconAttr}><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
// MUI "ContentPaste" glyph, for Paste properties.
const kPasteIconSvg = `<svg ${kIconAttr}><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>`;
const kCutIconSvg = `<svg ${kIconAttr}><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/></svg>`;
const kTrashIconSvg = `<svg ${kIconAttr}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const kInfoIconSvg = `<svg ${kIconAttr}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;
// MUI "FormatPaint" glyph (paint roller), for Paint format.
const kPaintRollerPath =
  "M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4z";
const kPaintIconSvg = `<svg ${kIconAttr}><path d="${kPaintRollerPath}"/></svg>`;

let installed = false;
// Unique ID source for anchor names, plus the set of names minted this
// session (names found in loaded HTML but absent here are stale and must not
// be reused — see getElementAnchorName).
let anchorCounter = 0;
const mintedAnchorNames = new Set<string>();

// Reset function for testing
export function resetTableSizeButtons(): void {
  exitPaintFormatMode();
  installed = false;
  overlayTable = null;
  // Fresh "session" for anchor names, so tests exercise the same collision
  // rules a real page reload does.
  anchorCounter = 0;
  mintedAnchorNames.clear();

  // Reset cluster elements
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

  if (repositionRaf) {
    cancelAnimationFrame(repositionRaf);
    repositionRaf = 0;
  }
}

export function ensureTableSizeButtons(): void {
  if (installed) return;
  installed = true;

  ensureEdgeOverlays();

  document.addEventListener(
    "focusin",
    (event) => {
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
    },
    true,
  );

  // Right-click on a cell opens the combined Cell/Row/Column/Table menu.
  document.addEventListener(
    "contextmenu",
    (event) => {
      const target = event.target as HTMLElement | null;
      const cell = target?.closest(".bloom-cell") as HTMLElement | null;
      if (!cell) return; // not on a table cell — leave the native menu alone
      const table = cell.closest(".bloom-table") as HTMLElement | null;
      if (!table) return;
      event.preventDefault();
      showEdgeOverlays(table);
      openMenu(
        ["cell"],
        { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY },
        "context",
        cell,
      );
    },
    true,
  );

  window.addEventListener("resize", scheduleOverlayReposition, {
    passive: true,
  });
  window.addEventListener("scroll", scheduleOverlayReposition, {
    passive: true,
  });
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

type OverlayKind = "add";
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
  kind: OverlayKind,
  side: OverlaySide,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  const label = kAddOverlayLabel[side];
  btn.setAttribute("aria-label", label);
  btn.title = label;
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
  void kind;
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
  if (!colAddBtn) colAddBtn = makeOverlay(tryInsertColumnRight, kAddIconSvg, "add", "right");
  if (!rowAddBtn) rowAddBtn = makeOverlay(tryInsertRowBelow, kAddIconSvg, "add", "bottom");
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

// ===== "..." pill menus =====
// A menu is composed of one or more of these sections. Pills open a single
// section; right-clicking a cell opens all four (Cell, Row, Column, Table).
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

const kIconSlotPx = 22; // reserved left gutter so labels align with/without icons

// Base pill styling shared by the row/column "..." pills and the table pill.
function stylePill(btn: HTMLButtonElement): void {
  Object.assign(btn.style, {
    position: "static",
    height: "20px",
    minWidth: "30px",
    padding: "0 8px",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.3)",
    backgroundColor: "#2D8294",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "700",
    lineHeight: "1",
    letterSpacing: "1px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    cursor: "pointer",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  btn.setAttribute("aria-haspopup", "menu");
  // Don't steal selection/focus from the current cell when opening the menu.
  btn.addEventListener("mousedown", (e) => e.preventDefault());
}

// A pill showing an orientation glyph (table / row / column). `iconStyle` lets
// each caller preserve its glyph's aspect ratio (the row glyph is wide, the
// column glyph is tall).
function makeGlyphPill(label: string, iconSrc: string, iconStyle: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML = `<img src="${iconSrc}" alt="" style="${iconStyle}" />`;
  stylePill(btn);
  return btn;
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

// Bold, no-op section header. Indented to align with item labels (past gutter).
function makeMenuHeader(text: string): HTMLDivElement {
  const h = document.createElement("div");
  h.textContent = text;
  Object.assign(h.style, {
    padding: `8px 14px 3px ${14 + kIconSlotPx}px`,
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#888",
  } as CSSStyleDeclaration);
  return h;
}

// A thin horizontal divider between sections.
function makeDivider(): HTMLDivElement {
  const d = document.createElement("div");
  Object.assign(d.style, {
    height: "1px",
    background: "rgba(0,0,0,0.1)",
    margin: "4px 0",
  } as CSSStyleDeclaration);
  return d;
}

// Color for the black line icons in the left gutter of menu items.
const kItemIconColor = "#333";

// Fill an element with an icon recolored to `color`. Accepts inline SVG markup
// (uses currentColor) or a URL (recolored via CSS mask, since the toolbar SVGs
// are white and would otherwise be invisible on the white menu).
function setIconSlot(el: HTMLElement, icon: string | undefined, color: string): void {
  el.innerHTML = "";
  if (!icon) return;
  if (icon.trim().startsWith("<svg")) {
    el.style.color = color;
    el.innerHTML = icon;
    return;
  }
  const m = document.createElement("span");
  Object.assign(m.style, {
    display: "block",
    width: "16px",
    height: "16px",
    backgroundColor: color,
  } as CSSStyleDeclaration);
  m.style.setProperty("mask-image", `url("${icon}")`);
  m.style.setProperty("-webkit-mask-image", `url("${icon}")`);
  for (const prop of ["mask-size", "-webkit-mask-size"]) m.style.setProperty(prop, "contain");
  for (const prop of ["mask-repeat", "-webkit-mask-repeat"]) m.style.setProperty(prop, "no-repeat");
  for (const prop of ["mask-position", "-webkit-mask-position"]) m.style.setProperty(prop, "center");
  el.appendChild(m);
}

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
      closeMenuPopup();
      fn();
    });
  }
  return item;
}

// A non-interactive hint row: a Bloom-blue info icon followed by muted text.
// Does nothing on click (it's a plain div, not a menuitem button).
function makeInfoNote(text: string): HTMLDivElement {
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "6px 14px",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  const slot = document.createElement("span");
  Object.assign(slot.style, {
    flex: `0 0 ${kIconSlotPx}px`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as CSSStyleDeclaration);
  setIconSlot(slot, kInfoIconSvg, kBloomBlue);
  const label = document.createElement("span");
  label.textContent = text;
  Object.assign(label.style, {
    flex: "1 1 auto",
    fontSize: "12px",
    color: "#666",
  } as CSSStyleDeclaration);
  row.appendChild(slot);
  row.appendChild(label);
  return row;
}

// A control group: the command label on one line, then its chooser buttons on
// the line below (indented to align under the label text).
function makeControlRow(label: string, controls: HTMLElement[]): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.padding = "4px 14px";
  wrap.style.boxSizing = "border-box";

  const labelLine = document.createElement("div");
  Object.assign(labelLine.style, { display: "flex", alignItems: "center" } as CSSStyleDeclaration);
  const slot = document.createElement("span");
  slot.style.flex = `0 0 ${kIconSlotPx}px`;
  const text = document.createElement("span");
  text.textContent = label;
  Object.assign(text.style, { fontSize: "13px", color: "#222" } as CSSStyleDeclaration);
  labelLine.appendChild(slot);
  labelLine.appendChild(text);

  const controlsLine = document.createElement("div");
  Object.assign(controlsLine.style, {
    display: "flex",
    gap: "4px",
    paddingLeft: `${kIconSlotPx}px`,
    marginTop: "2px",
  } as CSSStyleDeclaration);
  controls.forEach((c) => controlsLine.appendChild(c));

  wrap.appendChild(labelLine);
  wrap.appendChild(controlsLine);
  return wrap;
}

function setToggleActive(btn: HTMLButtonElement, active: boolean): void {
  btn.style.background = active ? "#d7ecf1" : "transparent";
  btn.style.borderColor = active ? "#2D8294" : "transparent";
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

// A small icon button used inside control rows (content type, alignment).
function makeIconToggle(icon: string, title: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.setAttribute("aria-label", title);
  Object.assign(b.style, {
    width: "28px",
    height: "24px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  setIconSlot(b, icon, kBloomBlue);
  setToggleActive(b, active);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// A text-labeled toggle button matching makeIconToggle (used for the "fixed
// size" option in the Size control, where the label is a measurement).
function makeTextToggle(text: string, title: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.setAttribute("aria-label", title);
  b.textContent = text;
  Object.assign(b.style, {
    minWidth: "28px",
    height: "24px",
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    fontSize: "12px",
    color: kBloomBlue,
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  setToggleActive(b, active);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// Shared shell for the border style/weight sample-line toggles.
function makeSampleToggle(title: string, sample: HTMLElement, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.setAttribute("aria-label", title);
  Object.assign(b.style, {
    width: "32px",
    height: "24px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  b.appendChild(sample);
  setToggleActive(b, false);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// The "none" indicator's stroke: the same gray used for the swatch box
// outline, so the diagonal reads as part of the box.
const kNoneStroke = "rgba(0,0,0,0.2)";

// A white background crossed by a 1px diagonal from bottom-left to top-right
// (gradient bands run perpendicular to the gradient direction, so "to bottom
// right" yields a bottom-left -> top-right line).
const noneDiagonal = `linear-gradient(to bottom right, #fff calc(50% - 0.5px), ${kNoneStroke} calc(50% - 0.5px), ${kNoneStroke} calc(50% + 0.5px), #fff calc(50% + 0.5px))`;

// The classic "none" sample: an outlined white box with a diagonal line in
// the same gray and width as its outline. Shared by the fill swatch and the
// border style/weight "none" toggles.
function makeNoneSample(width: number, height: number): HTMLElement {
  const box = document.createElement("span");
  Object.assign(box.style, {
    width: `${width}px`,
    height: `${height}px`,
    display: "block",
    boxSizing: "border-box",
    border: `1px solid ${kNoneStroke}`,
    borderRadius: "2px",
    background: noneDiagonal,
  } as CSSStyleDeclaration);
  return box;
}

// A border-style toggle showing a sample line in that style ("none" shows the
// crossed-out box), mirroring the sidebar's Style choices.
function makeBorderStyleToggle(style: string, onClick: () => void): HTMLButtonElement {
  let sample: HTMLElement;
  if (style === "none") {
    sample = makeNoneSample(22, 14);
  } else {
    sample = document.createElement("span");
    Object.assign(sample.style, {
      width: "22px",
      height: "0",
      borderTop: `2px ${style} ${kItemIconColor}`,
      display: "block",
    } as CSSStyleDeclaration);
  }
  const title = style === "none" ? "None" : style[0].toUpperCase() + style.slice(1);
  const b = makeSampleToggle(title, sample, onClick);
  b.dataset.style = style;
  return b;
}

// A border-weight toggle showing a line of that thickness ("0" shows the
// crossed-out box), mirroring the sidebar's Weight choices.
function makeBorderWeightToggle(weight: number, onClick: () => void): HTMLButtonElement {
  let sample: HTMLElement;
  if (weight) {
    sample = document.createElement("span");
    Object.assign(sample.style, {
      width: "22px",
      height: `${weight}px`,
      background: kItemIconColor,
      display: "block",
    } as CSSStyleDeclaration);
  } else {
    sample = makeNoneSample(22, 14);
  }
  const b = makeSampleToggle(weight ? `${weight}` : "0 (None)", sample, onClick);
  b.dataset.weight = String(weight);
  return b;
}

// A corner-radius toggle: a small box with left+top borders and a rounded
// top-left corner, mirroring the sidebar's corner sample buttons.
function makeCornerToggle(radius: number, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = `${radius}`;
  b.setAttribute("aria-label", `Corner radius ${radius}`);
  Object.assign(b.style, {
    width: "28px",
    height: "24px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  const sample = document.createElement("span");
  const r = Math.max(0, Math.min(radius, 18));
  Object.assign(sample.style, {
    width: "18px",
    height: "18px",
    borderLeft: `2px solid ${kItemIconColor}`,
    borderTop: `2px solid ${kItemIconColor}`,
    borderTopLeftRadius: `${r}px`,
    boxSizing: "border-box",
    display: "block",
  } as CSSStyleDeclaration);
  b.appendChild(sample);
  setToggleActive(b, active);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
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

// Parse the leading number from a CSS length (e.g. "6px" -> 6). 0 if absent.
function firstPx(s: string | null | undefined): number {
  const n = parseFloat((s ?? "").trim());
  return isNaN(n) ? 0 : n;
}


// A labeled range slider on its own row. Interacting with it does not close the
// menu (the slider lives inside the popup, which the outside-click guard skips).
function makeSliderRow(
  label: string,
  min: number,
  max: number,
  value: number,
  unit: string,
  onInput: (v: number) => void,
): HTMLDivElement {
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.setAttribute("aria-label", label);
  input.style.flex = "1 1 auto";
  // Tint the thumb/track with the Bloom primary color instead of the UA blue.
  input.style.accentColor = kBloomBlue;

  const readout = document.createElement("span");
  readout.textContent = `${value}${unit}`;
  Object.assign(readout.style, {
    fontSize: "12px",
    color: "#555",
    minWidth: "34px",
    textAlign: "right",
  } as CSSStyleDeclaration);

  input.addEventListener("input", () => {
    const v = Number(input.value);
    readout.textContent = `${v}${unit}`;
    onInput(v);
  });
  return makeControlRow(label, [input, readout]);
}

// A native color picker input. Does not close the menu. A native color input
// cannot display "no color", so when the value is unset (empty or non-hex)
// the swatch is covered with the classic no-color indicator — white with a
// red diagonal line — until the user picks a color.
function makeColorInput(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const isSet = /^#[0-9a-fA-F]{6}$/.test(value);
  const input = document.createElement("input");
  input.type = "color";
  input.value = isSet ? value : "#ffffff";
  input.setAttribute("aria-label", label);
  Object.assign(input.style, {
    width: "40px",
    height: "24px",
    padding: "0",
    border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: "4px",
    cursor: "pointer",
    background: "transparent",
  } as CSSStyleDeclaration);
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "relative",
    display: "inline-flex",
    width: "40px",
    height: "24px",
  } as CSSStyleDeclaration);
  wrap.appendChild(input);
  const noColor = document.createElement("div");
  Object.assign(noColor.style, {
    position: "absolute",
    inset: "1px",
    borderRadius: "3px",
    pointerEvents: "none", // clicks fall through to the input
    background: noneDiagonal,
    display: isSet ? "none" : "block",
  } as CSSStyleDeclaration);
  wrap.appendChild(noColor);
  input.addEventListener("input", () => {
    noColor.style.display = "none";
    onInput(input.value);
  });
  return wrap;
}

type ColorEntry = { label: string; value: string; onInput: (v: string) => void };

// Two labeled color pickers side by side on one row (Fill | Border color).
function makeColorPairRow(entries: [ColorEntry, ColorEntry]): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.padding = "4px 14px";
  wrap.style.boxSizing = "border-box";
  const line = document.createElement("div");
  Object.assign(line.style, {
    display: "flex",
    gap: "16px",
    paddingLeft: `${kIconSlotPx}px`,
  } as CSSStyleDeclaration);
  for (const e of entries) {
    const col = document.createElement("div");
    Object.assign(col.style, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    } as CSSStyleDeclaration);
    const caption = document.createElement("span");
    caption.textContent = e.label;
    Object.assign(caption.style, { fontSize: "13px", color: "#222" } as CSSStyleDeclaration);
    col.appendChild(caption);
    col.appendChild(makeColorInput(e.label, e.value, e.onInput));
    line.appendChild(col);
  }
  wrap.appendChild(line);
  return wrap;
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

// ===== Paint Format mode =====
// Entered from a Cell/Row/Column menu's "Paint format". Every subsequent
// click stamps the snapshot onto the clicked cell's matching scope, in any
// bloom-table on the page (a row/column pattern cycles when sizes differ).
// Escape or the slashed-roller badge at the source table's top-left exits.
let paintMode: {
  scope: "cell" | "row" | "column";
  pattern: CopiedCellProperties[];
  table: HTMLElement;
  badge: HTMLDivElement;
} | null = null;

export function isPaintFormatModeActive(): boolean {
  return !!paintMode;
}

// Roller cursor while the mode is active. Cells carry inline cursor styles,
// so the rule needs !important to win; the badge opts back out to a pointer.
const kPaintCursorUrl = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'><path d='${kPaintRollerPath}' fill='%23222' stroke='%23fff' stroke-width='0.75'/></svg>") 4 4, copy`;
let paintStyleInstalled = false;
function ensurePaintFormatStyle(): void {
  if (paintStyleInstalled) return;
  paintStyleInstalled = true;
  const style = document.createElement("style");
  style.setAttribute("data-table-overlay", "paint-format-style");
  style.textContent = `
    body.bloom-paint-format, body.bloom-paint-format * { cursor: ${kPaintCursorUrl} !important; }
    body.bloom-paint-format .bloom-paint-format-badge, body.bloom-paint-format .bloom-paint-format-badge * { cursor: pointer !important; }
  `;
  document.head.appendChild(style);
}

function makePaintFormatBadge(): HTMLDivElement {
  const badge = document.createElement("div");
  badge.className = "bloom-paint-format-badge";
  badge.title = "Exit Paint Format (Esc)";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Exit Paint Format");
  Object.assign(badge.style, {
    position: "absolute",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    border: "1px solid #bbb",
    borderRadius: "6px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
    zIndex: "2147483647",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  // The roller with a red slash: "you are painting; click to stop".
  badge.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" style="display:block"><path d="${kPaintRollerPath}" fill="#444"/><line x1="3" y1="3" x2="21" y2="21" stroke="#d32f2f" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  badge.addEventListener("mousedown", (e) => e.preventDefault());
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    exitPaintFormatMode();
  });
  return badge;
}

// The badge sits just outside the source table's top-left corner (clamped to
// the viewport when the table touches the page edge).
function positionPaintBadge(): void {
  if (!paintMode) return;
  if (!document.body.contains(paintMode.table)) {
    exitPaintFormatMode();
    return;
  }
  const rect = paintMode.table.getBoundingClientRect();
  const size = 28;
  const margin = 4;
  const left = Math.max(0, window.scrollX + rect.left - size - margin);
  const top = Math.max(0, window.scrollY + rect.top - size - margin);
  paintMode.badge.style.left = `${left}px`;
  paintMode.badge.style.top = `${top}px`;
}

// Capture-phase handler for pointerdown/mousedown/click while painting: a
// click on any cell is consumed entirely (no selection change, no caret) and
// stamps the pattern once, on pointerdown. Clicks elsewhere behave normally
// and leave the mode active.
function onPaintPointerDown(e: Event): void {
  if (!paintMode) return;
  const target = e.target as HTMLElement | null;
  if (!target || !(target instanceof Element)) return;
  if (paintMode.badge.contains(target)) return;
  const cell = target.closest?.(".bloom-cell") as HTMLElement | null;
  const table = cell?.closest(".bloom-table") as HTMLElement | null;
  if (!cell || !table || cell.classList.contains("bloom-skip")) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.type !== "pointerdown") return;
  const targets =
    paintMode.scope === "cell" ? [cell] : getCellsInScope(table, paintMode.scope, cell);
  paintProperties(table, targets, paintMode.pattern);
  positionPaintBadge();
}

function onPaintKeyDown(e: KeyboardEvent): void {
  if (e.key !== "Escape") return;
  e.stopPropagation();
  exitPaintFormatMode();
}

export function enterPaintFormatMode(
  table: HTMLElement,
  scope: "cell" | "row" | "column",
  sourceCells: HTMLElement[],
): void {
  if (!sourceCells.length) return;
  exitPaintFormatMode();
  ensurePaintFormatStyle();
  const badge = makePaintFormatBadge();
  document.body.appendChild(badge);
  paintMode = {
    scope,
    pattern: sourceCells.map((c) => snapshotCellProperties(c)),
    table,
    badge,
  };
  document.body.classList.add("bloom-paint-format");
  document.addEventListener("pointerdown", onPaintPointerDown, true);
  document.addEventListener("mousedown", onPaintPointerDown, true);
  document.addEventListener("click", onPaintPointerDown, true);
  document.addEventListener("keydown", onPaintKeyDown, true);
  window.addEventListener("scroll", positionPaintBadge, true);
  window.addEventListener("resize", positionPaintBadge);
  hideEdgeOverlays(); // pills stay out of the way while painting
  positionPaintBadge();
}

export function exitPaintFormatMode(): void {
  if (!paintMode) return;
  paintMode.badge.remove();
  paintMode = null;
  document.body.classList.remove("bloom-paint-format");
  document.removeEventListener("pointerdown", onPaintPointerDown, true);
  document.removeEventListener("mousedown", onPaintPointerDown, true);
  document.removeEventListener("click", onPaintPointerDown, true);
  document.removeEventListener("keydown", onPaintKeyDown, true);
  window.removeEventListener("scroll", positionPaintBadge, true);
  window.removeEventListener("resize", positionPaintBadge);
}

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
  if (paintMode) return;
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
  let targetTable = overlayTable;

  if (!targetTable) {
    const table =
      (document.querySelector(".bloom-cell.cell--selected") as HTMLElement | null)?.closest(".bloom-table") ||
      (document.querySelector(".bloom-table") as HTMLElement | null);
    if (table) {
      targetTable = table as HTMLElement;
      overlayTable = targetTable; // Update the stored reference
    } else {
      return;
    }
  }

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

// Union of the table's visible cell rects (viewport coords). Mirrors the bounds
// math in applyAnchorPositioning; null when the table has no laid-out cells.
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
  if (paintMode) {
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
    // (repositionEdgeOverlays can adopt a table into overlayTable without
    // going through showEdgeOverlays, e.g. on a scroll before any focus).
    if (near !== overlayTable || !near.classList.contains(kPointerNearClass)) {
      showEdgeOverlays(near);
    }
  } else if (overlayTable) {
    hideEdgeOverlays();
  }
}

function installProximityGate(): void {
  if (gateInstalled) return;
  gateInstalled = true;
  document.addEventListener(
    "mousemove",
    (e) => {
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
    },
    { passive: true },
  );
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
  const children = Array.from(table.children) as HTMLElement[];
  for (const el of children) {
    if (!el.classList || !el.classList.contains("bloom-cell")) continue;
    try {
      const { row, column } = getRowAndColumn(table, el);
      if (row === targetRow && column === targetCol) return el;
    } catch {}
  }
  return null;
}

// Anchor the two contextual clusters (and the corner handle) to the current
// selection. The column cluster sits above the selected column; the row cluster
// sits to the left of the selected row.
function applyAnchorPositioning(table: HTMLElement) {
  // Repositioning re-decides visibility; while Paint Format is active the
  // overlays must stay hidden no matter what triggers a reposition.
  if (paintMode) {
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
  // hugging cells). Compute the union rect of the visible cells; a spanning
  // cell's rect covers the area its skipped neighbours would, so this is robust
  // to spans too.
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
  const haveBounds = isFinite(minL) && isFinite(maxR);
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
  if (haveBounds) {
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
    const widths = (table.getAttribute("data-column-widths") || "")
      .split(",")
      .filter((x) => x.length > 0);
    new BloomTable(table).addColumnAt(widths.length, widths.length > 0 ? widths.length - 1 : undefined);
    scheduleOverlayReposition();
  } catch {}
}

function tryInsertRowBelow() {
  const cell = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  const table = (cell?.closest(".bloom-table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const heights = (table.getAttribute("data-row-heights") || "")
      .split(",")
      .filter((x) => x.length > 0);
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

function showDeletePreview(kind: PreviewKind) {
  if (!overlayTable) return;
  const selected = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  if (!selected) return;
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
  const selected = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  if (!selected) {
    hideDeletePreview();
    return;
  }
  const { row, column } = getRowAndColumn(overlayTable, selected);
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
  const selected = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  if (!selected) return;
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
  const selected = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  if (!selected) {
    hideAddPreview();
    return;
  }
  const { row, column } = getRowAndColumn(overlayTable, selected);
  const cells: HTMLElement[] = Array.from(overlayTable.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("bloom-cell"),
  );
  let minLeft = Infinity,
    maxRight = -Infinity,
    minTop = Infinity,
    maxBottom = -Infinity;
  for (const cell of cells) {
    const { row: r, column: c } = getRowAndColumn(overlayTable, cell);
    const match = currentAddKind === "row" ? r === row : c === column;
    if (!match) continue;
    const rect = cell.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.left < minLeft) minLeft = rect.left;
    if (rect.right > maxRight) maxRight = rect.right;
    if (rect.top < minTop) minTop = rect.top;
    if (rect.bottom > maxBottom) maxBottom = rect.bottom;
  }
  if (!isFinite(minLeft) || !isFinite(maxRight) || !isFinite(minTop) || !isFinite(maxBottom)) {
    hideAddPreview();
    return;
  }

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
