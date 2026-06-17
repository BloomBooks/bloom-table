// Four edge "+" buttons shown around the visible bounds of the selected table.
// Right/Left insert columns; Top/Bottom insert rows.

import { BloomTable } from "./BloomTable";
import {
  addColumnAt,
  addRowAt,
  getTableInfo,
  getRowAndColumn,
  removeColumnAt,
  removeRowAt,
} from "./structure";
import { ProximityDiv } from "./ProximityDiv";
import { kBloomBlue } from "./constants";
import { tableHistoryManager } from "./history";
import { render } from "./table-renderer";
import {
  setupContentsOfCell,
  contentTypeOptions,
  getCurrentContentTypeId,
} from "./cell-contents";
import {
  getCellAlign,
  setCellAlign,
  getSpan,
  getGapX,
  setGapX,
  getGapY,
  setGapY,
  getCellBackground,
  setCellBackground,
  getTableBackground,
  setTableBackground,
  type CellAlign,
} from "./table-model";
import { representativeBorderColorHex } from "./color-utils";
import { getTableOuterBorderValueMap } from "./border-state";
import { applyOuterBorders, applyUniformInner, setDefaultBorder } from "./edge-utils";
// Toolbar icons reused on the menu (imported as URLs).
import columnDeleteIcon from "./components/icons/column-delete.svg";
import cellMergeIcon from "./components/icons/cell-merge.svg";
import cellSplitIcon from "./components/icons/cell-split.svg";
import alignLeftIcon from "./components/icons/align-left.svg";
import alignCenterIcon from "./components/icons/align-center.svg";
import alignRightIcon from "./components/icons/align-right.svg";
import cellContentTableIcon from "./components/icons/cell-content-table.svg";
import resizeTableIcon from "./components/icons/resize-table.svg";

// Inline SVG icons (MUI "Add" and "Delete" glyph paths) so the core attach
// path stays free of React / MUI. fill:currentColor lets the button color
// drive the glyph color.
const kAddIconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" style="width:18px;height:18px;display:block;fill:currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
// Inline glyphs (16px, fill:currentColor) for menu items that have no toolbar
// icon: directional move arrows, copy, and delete-table.
const kIconAttr = `viewBox="0 0 24 24" width="16" height="16" style="width:16px;height:16px;display:block;fill:currentColor"`;
const kAddItemIconSvg = `<svg ${kIconAttr}><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
const kMoveUpIconSvg = `<svg ${kIconAttr}><path d="M12 4l-7 7h4v7h6v-7h4z"/></svg>`;
const kMoveDownIconSvg = `<svg ${kIconAttr}><path d="M12 20l7-7h-4V6H9v7H5z"/></svg>`;
const kMoveLeftIconSvg = `<svg ${kIconAttr}><path d="M4 12l7-7v4h7v6h-7v4z"/></svg>`;
const kMoveRightIconSvg = `<svg ${kIconAttr}><path d="M20 12l-7-7v4H6v6h7v4z"/></svg>`;
const kCopyIconSvg = `<svg ${kIconAttr}><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
const kCutIconSvg = `<svg ${kIconAttr}><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/></svg>`;
const kTrashIconSvg = `<svg ${kIconAttr}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const kInfoIconSvg = `<svg ${kIconAttr}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;

let installed = false;
// Unique ID source for anchor names
let anchorCounter = 0;

// Reset function for testing
export function resetTableSizeButtons(): void {
  installed = false;
  cornerHandle = null;
  proxCornerHandle = null;
  overlayTable = null;

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
  tablePillBR = null;
  proxTablePillTL = null;
  proxTablePillBR = null;
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
  ensureCornerHandle();

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

// Table-level menu pills (table icon + "..."), shown at the table's top-left
// and bottom-right corners. Both open the same "Table" menu.
let tablePillTL: HTMLButtonElement | null = null;
let tablePillBR: HTMLButtonElement | null = null;
let proxTablePillTL: ProximityDiv | null = null;
let proxTablePillBR: ProximityDiv | null = null;

// The open popup menu; null when closed. menuOpenId identifies which trigger
// opened it (so clicking the same pill toggles it closed). menuTargetCell is the
// cell the menu acts on (the right-clicked cell, or the selected cell for pills).
let menuPopup: HTMLDivElement | null = null;
let menuOpenId: string | null = null;
let menuTargetCell: HTMLElement | null = null;

let overlayTable: HTMLElement | null = null;
let repositionRaf = 0;

// --- Corner drag affordance (lower-right grow/shrink handle) ---
let cornerHandle: HTMLDivElement | null = null;
let proxCornerHandle: ProximityDiv | null = null;
let cornerDragging = false;
let cornerInitialState: {
  innerHTML: string;
  attributes: Record<string, string>;
} | null = null;
let cornerDragTable: HTMLElement | null = null;
let cornerStartX = 0;
let cornerStartY = 0;
let cornerStartRows = 0;
let cornerStartCols = 0;
let cornerUpdateRaf = 0; // RAF handle for throttling updates
// Store initial selection state to restore after drag ends
let cornerInitialSelection: {
  activeCell: HTMLElement | null;
  selectedTable: HTMLElement | null;
} | null = null;

const kCornerUnitColPx = 20; // pixels per column step - reduced for better responsiveness
const kCornerUnitRowPx = 20; // pixels per row step - reduced for better responsiveness

function ensureCornerHandle() {
  // If an existing handle is present but detached (e.g., test reset document.body), recreate it
  if (cornerHandle && document.body.contains(cornerHandle)) return cornerHandle;
  if (proxCornerHandle && (!cornerHandle || !document.body.contains(proxCornerHandle.element))) {
    try {
      proxCornerHandle.destroy();
    } catch {}
    proxCornerHandle = null;
  }
  cornerHandle = null;
  const el = document.createElement("div");
  el.setAttribute("data-btable-corner-handle", "");
  Object.assign(el.style, {
    width: "14px",
    height: "14px",
    position: "static",
    cursor: "nwse-resize",
    display: "none",
    zIndex: "2147483647",
  } as CSSStyleDeclaration);
  el.innerHTML = `<img src="${resizeTableIcon}" alt="" draggable="false" style="width:14px;height:14px;display:block;pointer-events:none" />`;

  // Mouse interactions
  const onMouseDown = (e: MouseEvent) => {
    console.log("🟢 Corner handle mousedown", {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const table =
      (document.querySelector(".bloom-cell.cell--selected") as HTMLElement | null)?.closest(".bloom-table") ||
      overlayTable ||
      (document.querySelector(".bloom-table") as HTMLElement | null);
    if (!table) {
      console.log("🔴 No table found for corner drag");
      return;
    }

    console.log("🎯 Found table for corner drag", { table: table.tagName });

    e.preventDefault();
    e.stopPropagation();

    // Store initial selection state to restore after drag
    const initialActiveCell =
      document.querySelector(".bloom-cell.cell--selected") || document.activeElement?.closest(".bloom-cell");
    const initialSelectedTable = initialActiveCell?.closest(".bloom-table");
    cornerInitialSelection = {
      activeCell: initialActiveCell as HTMLElement | null,
      selectedTable: initialSelectedTable as HTMLElement | null,
    };
    console.log("💾 Stored initial selection", {
      hasActiveCell: !!cornerInitialSelection.activeCell,
      hasSelectedTable: !!cornerInitialSelection.selectedTable,
    });

    // Capture start and initial counts
    cornerDragging = true;
    cornerDragTable = table as HTMLElement;

    // Ensure overlayTable points to our target table throughout the drag
    overlayTable = cornerDragTable;
    console.log("🎯 Set overlayTable to cornerDragTable for stable targeting");

    cornerStartX = e.clientX;
    cornerStartY = e.clientY;
    try {
      const info = getTableInfo(table as HTMLElement);
      cornerStartRows = info.rowCount;
      cornerStartCols = info.columnCount;
      console.log("📊 Initial table state", {
        startRows: cornerStartRows,
        startCols: cornerStartCols,
        startX: cornerStartX,
        startY: cornerStartY,
      });
    } catch (err) {
      console.log("🔴 Error getting table info:", err);
      cornerStartRows = 0;
      cornerStartCols = 0;
    }
    cornerInitialState = snapshotTable(table as HTMLElement);
    console.log("📸 Table snapshot taken");

    // Install global listeners once per drag
    console.log("👂 Installing mousemove and mouseup listeners");
    document.addEventListener("mousemove", handleCornerDragMove);
    document.addEventListener("mouseup", handleCornerDragUp, { once: true });
    document.addEventListener("mouseup", handleCornerDragUp, { once: true });
  };
  el.addEventListener("mousedown", onMouseDown);

  // Wrap with ProximityDiv so opacity eases in near cursor
  const prox = new ProximityDiv(document.body, el);
  cornerHandle = el;
  proxCornerHandle = prox;
  return el;
}

function snapshotTable(table: HTMLElement): {
  innerHTML: string;
  attributes: Record<string, string>;
} {
  const attributes: Record<string, string> = {};
  for (let i = 0; i < table.attributes.length; i++) {
    const a = table.attributes[i];
    attributes[a.name] = a.value || "";
  }
  return { innerHTML: table.innerHTML, attributes };
}

function restoreTable(
  table: HTMLElement,
  state: { innerHTML: string; attributes: Record<string, string> },
) {
  // Remove all current attributes
  const toRemove: string[] = [];
  for (let i = 0; i < table.attributes.length; i++) {
    toRemove.push(table.attributes[i].name);
  }
  toRemove.forEach((n) => table.removeAttribute(n));
  // Restore saved
  Object.entries(state.attributes).forEach(([n, v]) => table.setAttribute(n, v));
  table.innerHTML = state.innerHTML;
}

function handleCornerDragMove(e: MouseEvent) {
  console.log("🔵 handleCornerDragMove called", {
    cornerDragging,
    cornerDragTable: !!cornerDragTable,
    clientX: e.clientX,
    clientY: e.clientY,
  });

  if (!cornerDragging || !cornerDragTable) {
    console.log("🔴 Early return - not dragging or no table");
    return;
  }
  e.preventDefault();

  const dx = e.clientX - cornerStartX;
  const dy = e.clientY - cornerStartY;
  const targetCols = Math.max(1, cornerStartCols + Math.floor(dx / kCornerUnitColPx));
  const targetRows = Math.max(1, cornerStartRows + Math.floor(dy / kCornerUnitRowPx));

  console.log("📐 Drag calculations", {
    dx,
    dy,
    cornerStartCols,
    cornerStartRows,
    targetCols,
    targetRows,
    unitColPx: kCornerUnitColPx,
    unitRowPx: kCornerUnitRowPx,
    "dx/unitColPx": dx / kCornerUnitColPx,
    "dy/unitRowPx": dy / kCornerUnitRowPx,
    "floor(dx/unitColPx)": Math.floor(dx / kCornerUnitColPx),
    "floor(dy/unitRowPx)": Math.floor(dy / kCornerUnitRowPx),
  });

  const info = getTableInfo(cornerDragTable);
  console.log("🔢 Current table info", {
    currentCols: info.columnCount,
    currentRows: info.rowCount,
  });

  // During drag, we always use the stored table reference - no need to check DOM selection
  console.log("🎯 Using stored cornerDragTable for all operations (no DOM selection dependency)");

  let colChanges = 0;
  let rowChanges = 0;

  console.log("🎯 Change analysis", {
    needColIncrease: info.columnCount < targetCols,
    needColDecrease: info.columnCount > targetCols && info.columnCount > 1,
    needRowIncrease: info.rowCount < targetRows,
    needRowDecrease: info.rowCount > targetRows && info.rowCount > 1,
    colDiff: targetCols - info.columnCount,
    rowDiff: targetRows - info.rowCount,
  });

  // Adjust columns
  while (info.columnCount < targetCols) {
    console.log("➕ Adding column", {
      currentCols: info.columnCount,
      targetCols,
    });
    addColumnAt(cornerDragTable, info.columnCount, true);
    info.columnCount++;
    colChanges++;
  }
  while (info.columnCount > targetCols && info.columnCount > 1) {
    console.log("➖ Removing column", {
      currentCols: info.columnCount,
      targetCols,
    });
    removeColumnAt(cornerDragTable, info.columnCount - 1, true);
    info.columnCount--;
    colChanges++;
  }
  // Adjust rows
  while (info.rowCount < targetRows) {
    console.log("➕ Adding row", { currentRows: info.rowCount, targetRows });
    addRowAt(cornerDragTable, info.rowCount, true);
    info.rowCount++;
    rowChanges++;
  }
  while (info.rowCount > targetRows && info.rowCount > 1) {
    console.log("➖ Removing row", { currentRows: info.rowCount, targetRows });
    removeRowAt(cornerDragTable, info.rowCount - 1, true);
    info.rowCount--;
    rowChanges++;
  }

  console.log("⚡ Table adjustments", {
    colChanges,
    rowChanges,
    newCols: info.columnCount,
    newRows: info.rowCount,
  });

  // Throttle expensive visual updates using RAF, but fallback to immediate execution in tests
  if (cornerUpdateRaf) {
    console.log("🚫 Canceling previous RAF");
    cancelAnimationFrame(cornerUpdateRaf);
    cornerUpdateRaf = 0;
  }

  const updateVisuals = () => {
    console.log("🎨 Running visual update");
    if (!cornerDragTable) {
      console.log("🔴 No table in visual update");
      return;
    }

    try {
      render(cornerDragTable);
      console.log("✅ Render completed");
    } catch (err) {
      console.log("🔴 Render error:", err);
    }
    // Skip overlay repositioning during drag to prevent DOM timing issues
    console.log("⏸️ Skipping overlay reposition during active drag");
    cornerUpdateRaf = 0;
  };

  // In test environments (like happy-dom), requestAnimationFrame may not work properly
  // So we check if we're in a test environment and execute immediately
  if (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function" &&
    !window.location.href.includes("vitest")
  ) {
    console.log("🔄 Scheduling RAF update");
    cornerUpdateRaf = requestAnimationFrame(updateVisuals);
  } else {
    console.log("⚡ Running immediate update");
    updateVisuals();
  }
}

function handleCornerDragUp() {
  console.log("🛑 Corner drag up - ending drag session");

  if (!cornerDragging || !cornerDragTable) {
    console.log("🔴 Not dragging or no table on mouseup");
    return;
  }

  // Cancel any pending RAF update
  if (cornerUpdateRaf) {
    console.log("🚫 Canceling pending RAF update");
    cancelAnimationFrame(cornerUpdateRaf);
    cornerUpdateRaf = 0;
  }

  console.log("🚮 Removing mousemove listener");
  // Remove the move listener installed at drag start
  document.removeEventListener("mousemove", handleCornerDragMove);

  const table = cornerDragTable;
  const saved = cornerInitialState;
  const savedSelection = cornerInitialSelection;

  // Reset drag state but keep overlayTable pointing to our target
  cornerDragging = false;
  cornerDragTable = null;
  cornerInitialState = null;
  cornerInitialSelection = null;

  // Important: Keep overlayTable pointing to our target table so overlays don't get confused
  overlayTable = table;
  console.log("🔄 Drag state reset, overlayTable preserved for target table");

  // Restore selection to the table we were working with
  if (savedSelection && table) {
    console.log("🔄 Restoring selection to table after drag", {
      hadActiveCell: !!savedSelection.activeCell,
      hadSelectedTable: !!savedSelection.selectedTable,
      tableCellCount: table.querySelectorAll(".bloom-cell").length,
    });

    try {
      // Find the first cell in the potentially resized table
      const firstCell = table.querySelector(".bloom-cell") as HTMLElement;
      if (firstCell) {
        // Explicitly clear any existing selection before setting new one
        document
          .querySelectorAll(".bloom-cell.cell--selected")
          .forEach((el) => el.classList.remove("cell--selected"));
        document
          .querySelectorAll(".bloom-table.table--selected")
          .forEach((el) => el.classList.remove("table--selected"));

        // Apply selection classes directly to ensure they're set
        firstCell.classList.add("cell--selected");
        table.classList.add("table--selected");

        // Also focus to ensure proper interaction state
        const editable = firstCell.querySelector<HTMLElement>("[contenteditable]");
        if (editable) {
          editable.focus();
          console.log("✅ Selection restored to table via editable focus + direct class setting", {
            cellClasses: firstCell.className,
            tableClasses: table.className,
            activeElement:
              document.activeElement?.tagName + "." + document.activeElement?.className,
          });
        } else {
          firstCell.focus();
          console.log("✅ Selection restored to table via cell focus + direct class setting", {
            cellClasses: firstCell.className,
            tableClasses: table.className,
            activeElement:
              document.activeElement?.tagName + "." + document.activeElement?.className,
          });
        }
      } else {
        console.log("🔴 No cells found in table for selection restoration");
      }

      // Add a slight delay then verify the final state
      setTimeout(() => {
        const finalSelectedCell = document.querySelector(".bloom-cell.cell--selected");
        const finalSelectedTable = document.querySelector(".bloom-table.table--selected");
        const finalActiveElement = document.activeElement;

        console.log("🔍 Final selection state after restoration", {
          hasSelectedCell: !!finalSelectedCell,
          hasSelectedTable: !!finalSelectedTable,
          selectedTableMatchesOurTable: finalSelectedTable === table,
          activeElementTag: finalActiveElement?.tagName,
          activeElementClass: (finalActiveElement as HTMLElement)?.className,
          activeElementInOurTable:
            !!finalActiveElement?.closest(".bloom-table") && finalActiveElement?.closest(".bloom-table") === table,
        });

        if (!finalSelectedCell || finalSelectedTable !== table) {
          console.log("⚠️ Selection restoration may have failed!", {
            expectedTable: table,
            actualSelectedTable: finalSelectedTable,
            allSelectedCells: document.querySelectorAll(".bloom-cell.cell--selected").length,
            allSelectedTables: document.querySelectorAll(".bloom-table.table--selected").length,
          });
        }

        // Now that drag is complete and selection is restored, reposition overlays
        scheduleOverlayReposition();
        console.log("📍 Scheduled overlay reposition after drag completion");
      }, 10);
    } catch (err) {
      console.log("🔴 Error restoring selection:", err);
    }
  }

  // Finalize to history as a single undoable action
  if (saved) {
    const info = getTableInfo(table);
    const label = `Resize Table to ${info.rowCount}×${info.columnCount}`;
    console.log("📝 Adding history entry:", label);
    const noop = () => {};
    const undoOp = (g: HTMLElement) => restoreTable(g, saved);
    tableHistoryManager.addHistoryEntry(table, label, noop, undoOp);
  } else {
    console.log("🔴 No saved state for history");
  }
}

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

function makePill(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "⋯"; // horizontal ellipsis "⋯"
  btn.setAttribute("aria-label", label);
  btn.title = label;
  stylePill(btn);
  return btn;
}

// A wider pill showing a 2x2 table glyph followed by the "..." affordance.
function makeTablePill(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML = `<img src="${cellContentTableIcon}" width="16" height="16" alt="" style="display:block" /><span style="font-size:16px;line-height:1">⋯</span>`;
  stylePill(btn);
  return btn;
}

function ensureMenuPills(): void {
  if (!colMenuPill) {
    colMenuPill = makePill("Column menu");
    colMenuPill.setAttribute("data-btable-menu-pill", "column");
    colMenuPill.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePillMenu("column", colMenuPill!, "pill:column");
    });
  }
  if (!rowMenuPill) {
    rowMenuPill = makePill("Row menu");
    rowMenuPill.setAttribute("data-btable-menu-pill", "row");
    rowMenuPill.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePillMenu("row", rowMenuPill!, "pill:row");
    });
  }
}

function ensureTablePills(): void {
  const make = (id: string) => {
    const pill = makeTablePill("Table menu");
    pill.setAttribute("data-btable-menu-pill", "table");
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePillMenu("table", pill, id);
    });
    return pill;
  };
  // The table pills are the menu entry points and live at the table corners,
  // far from where the cursor usually is — keep them clearly visible at rest
  // (rather than fading to near-invisible) so they're discoverable.
  if (!tablePillTL) {
    tablePillTL = make("pill:table:tl");
    proxTablePillTL = new ProximityDiv(document.body, tablePillTL, { minOpacity: 0.6 });
  }
  if (!tablePillBR) {
    tablePillBR = make("pill:table:br");
    proxTablePillBR = new ProximityDiv(document.body, tablePillBR, { minOpacity: 0.6 });
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

// Parse the leading number from a CSS length (e.g. "6px" -> 6). 0 if absent.
function firstPx(s: string | null | undefined): number {
  const n = parseFloat((s ?? "").trim());
  return isNaN(n) ? 0 : n;
}

// Direct-child cells of a table (DOM order).
function tableCells(table: HTMLElement): HTMLElement[] {
  return Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
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

// A labeled native color picker on its own row. Does not close the menu.
function makeColorRow(
  label: string,
  value: string,
  onInput: (v: string) => void,
): HTMLDivElement {
  const input = document.createElement("input");
  input.type = "color";
  // The native picker only accepts #rrggbb; ignore non-hex values (shows black).
  input.value = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
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
  input.addEventListener("input", () => onInput(input.value));
  return makeControlRow(label, [input]);
}

// Re-color every border of the table while preserving the current weights and
// styles (mirrors the React panel's table border-color behavior).
function applyTableBorderColor(table: HTMLElement, color: string): void {
  const base = getTableOuterBorderValueMap(table);
  applyOuterBorders(
    table,
    {
      top: { weight: base.top.weight, style: base.top.style, color },
      right: { weight: base.right.weight, style: base.right.style, color },
      bottom: { weight: base.bottom.weight, style: base.bottom.style, color },
      left: { weight: base.left.weight, style: base.left.style, color },
    },
    color,
  );
  applyUniformInner(
    table,
    "innerH",
    { weight: base.innerH.weight, style: base.innerH.style, color } as any,
    color,
  );
  applyUniformInner(
    table,
    "innerV",
    { weight: base.innerV.weight, style: base.innerV.style, color } as any,
    color,
  );
  setDefaultBorder(
    table,
    { weight: base.innerH.weight, style: base.innerH.style, color } as any,
    color,
  );
  render(table);
}

// Color the table's surface by filling every cell. We never color the container
// div (it's sized larger than the cells, so its color would bleed outside).
function applyTableFill(table: HTMLElement, color: string | null): void {
  setTableBackground(table, null);
  tableCells(table).forEach((cell) => setCellBackground(cell, color || null));
  render(table);
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

function buildCellSection(ctx: MenuCtx): HTMLElement[] {
  const els: HTMLElement[] = [makeMenuHeader("Cell")];
  const cell = ctx.cell;

  // Content type: label followed by an icon toggle per registered type.
  const ctButtons: HTMLButtonElement[] = [];
  const refreshContent = () => {
    const cur = cell ? getCurrentContentTypeId(cell) : undefined;
    ctButtons.forEach((b) => setToggleActive(b, b.dataset.ctId === cur));
  };
  for (const opt of contentTypeOptions()) {
    const cur = cell ? getCurrentContentTypeId(cell) : undefined;
    const b = makeIconToggle(opt.icon, opt.englishName, cur === opt.id, () => {
      if (!cell) return;
      setupContentsOfCell(cell, opt.id, true);
      if (ctx.table) render(ctx.table);
      refreshContent();
    });
    b.dataset.ctId = opt.id;
    ctButtons.push(b);
  }
  els.push(makeControlRow("Content", ctButtons));

  // Text alignment: label followed by left/center/right toggles.
  const aligns: { id: CellAlign; icon: string; title: string }[] = [
    { id: "start", icon: alignLeftIcon, title: "Left" },
    { id: "center", icon: alignCenterIcon, title: "Center" },
    { id: "end", icon: alignRightIcon, title: "Right" },
  ];
  const alignButtons: HTMLButtonElement[] = [];
  const refreshAlign = () => {
    const cur = cell ? getCellAlign(cell) || "center" : "center";
    alignButtons.forEach((b) => setToggleActive(b, b.dataset.align === cur));
  };
  for (const a of aligns) {
    const cur = cell ? getCellAlign(cell) || "center" : "center";
    const b = makeIconToggle(a.icon, a.title, cur === a.id, () => {
      if (!cell) return;
      setCellAlign(cell, a.id);
      if (ctx.table) render(ctx.table);
      refreshAlign();
    });
    b.dataset.align = a.id;
    alignButtons.push(b);
  }
  els.push(makeControlRow("Alignment", alignButtons));

  // Merge / Split (cell span). Merge needs a column to the right to absorb;
  // Split needs an existing horizontal span to reduce.
  const spanX = cell ? getSpan(cell).x || 1 : 1;
  const canMerge = !!cell && ctx.col + spanX < ctx.colCount;
  const canSplit = spanX > 1;
  els.push(makeMenuItem("Merge", () => menuMergeCell(), undefined, !canMerge, cellMergeIcon));
  els.push(makeMenuItem("Split", () => menuSplitCell(), undefined, !canSplit, cellSplitIcon));
  return els;
}

function buildRowSection(ctx: MenuCtx): HTMLElement[] {
  return [
    makeMenuHeader("Row"),
    // 1) adds
    makeMenuItem("Add Row Above", () => menuAddRow(0), undefined, false, kAddItemIconSvg),
    makeMenuItem("Add Row Below", () => menuAddRow(1), undefined, false, kAddItemIconSvg),
    // 2) moves
    makeMenuItem("Move Row Up", () => menuMoveRow(-1), undefined, ctx.row <= 0, kMoveUpIconSvg),
    makeMenuItem(
      "Move Row Down",
      () => menuMoveRow(1),
      undefined,
      ctx.row >= ctx.rowCount - 1,
      kMoveDownIconSvg,
    ),
    // 3) divider, 4) delete
    makeDivider(),
    makeMenuItem("Delete Row", tryRemoveRow, "row", false, kTrashIconSvg),
    // 5) hint
    makeInfoNote("Right click on a cell for Cell menu"),
  ];
}

function buildColumnSection(ctx: MenuCtx): HTMLElement[] {
  return [
    makeMenuHeader("Column"),
    // 1) adds
    makeMenuItem("Add Column Left", () => menuAddColumn(0), undefined, false, kAddItemIconSvg),
    makeMenuItem("Add Column Right", () => menuAddColumn(1), undefined, false, kAddItemIconSvg),
    // 2) moves
    makeMenuItem("Move Left", () => menuMoveColumn(-1), undefined, ctx.col <= 0, kMoveLeftIconSvg),
    makeMenuItem(
      "Move Right",
      () => menuMoveColumn(1),
      undefined,
      ctx.col >= ctx.colCount - 1,
      kMoveRightIconSvg,
    ),
    // 3) divider, 4) delete
    makeDivider(),
    makeMenuItem("Delete Column", tryRemoveColumn, "column", false, columnDeleteIcon),
    // 5) hint
    makeInfoNote("Right click on a cell for Cell menu"),
  ];
}

function buildTableSection(ctx: MenuCtx): HTMLElement[] {
  const els: HTMLElement[] = [makeMenuHeader("Table")];
  const table = ctx.table;
  if (table) {
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

    const firstCell = tableCells(table)[0];
    const borderColor = firstCell ? representativeBorderColorHex(firstCell) : "#000000";
    els.push(
      makeColorRow("Border color", borderColor, (color) => applyTableBorderColor(table, color)),
    );

    const fillValue = (firstCell && getCellBackground(firstCell)) ?? getTableBackground(table) ?? "";
    els.push(makeColorRow("Fill", fillValue, (color) => applyTableFill(table, color)));
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
    (tablePillTL && tablePillTL.contains(t)) ||
    (tablePillBR && tablePillBR.contains(t))
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

function showEdgeOverlays(table: HTMLElement) {
  overlayTable = table;
  ensureEdgeOverlays();
  // The clusters target the current row/column, so they only make sense when a
  // cell is selected.
  const hasSelection = !!table.querySelector(".bloom-cell.cell--selected");
  if (colCluster) colCluster.style.display = hasSelection ? "flex" : "none";
  if (rowCluster) rowCluster.style.display = hasSelection ? "flex" : "none";
  // Table pills and the "+" add buttons are table-level, so they show whenever
  // the table is active (regardless of whether a cell is selected).
  if (tablePillTL) tablePillTL.style.display = "flex";
  if (tablePillBR) tablePillBR.style.display = "flex";
  if (colAddBtn) colAddBtn.style.display = "flex";
  if (rowAddBtn) rowAddBtn.style.display = "flex";
  if (cornerHandle) cornerHandle.style.display = "block";
  // Apply anchor-based positioning
  applyAnchorPositioning(table);
}

function hideEdgeOverlays() {
  if (colCluster) colCluster.style.display = "none";
  if (rowCluster) rowCluster.style.display = "none";
  if (tablePillTL) tablePillTL.style.display = "none";
  if (tablePillBR) tablePillBR.style.display = "none";
  if (colAddBtn) colAddBtn.style.display = "none";
  if (rowAddBtn) rowAddBtn.style.display = "none";
  if (cornerHandle) cornerHandle.style.display = "none";
  closeMenuPopup();
  overlayTable = null;
  hideDeletePreview();
  hideAddPreview();
}

function scheduleOverlayReposition() {
  // Skip overlay repositioning during corner drag to avoid DOM access issues
  if (cornerDragging) {
    console.log("⏸️ Skipping overlay reposition during corner drag");
    return;
  }

  if (repositionRaf) cancelAnimationFrame(repositionRaf);
  repositionRaf = requestAnimationFrame(() => {
    repositionEdgeOverlays();
  });
}

function repositionEdgeOverlays() {
  // During corner drag, always use the stored cornerDragTable to avoid selection issues
  let targetTable = overlayTable;

  if (cornerDragging && cornerDragTable) {
    console.log("🎯 Using stored cornerDragTable for overlay positioning during drag");
    targetTable = cornerDragTable;
    // During active drag, skip complex repositioning to avoid DOM timing issues
    return;
  } else if (!targetTable) {
    // Only derive from selected cell when not dragging
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
// (corner pills sit ~14px out and span ~50px, edge "+" buttons ~8px out, the
// resize handle straddles the lower-right corner). Hiding on a literal table
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
  // Don't fight an in-progress corner drag, and keep the affordances up while a
  // menu is open — the popup commonly extends past the active zone, so the cursor
  // would read as "outside" while the user is still interacting with it.
  if (cornerDragging || menuPopup) return;

  // Prefer the table already targeted (cheap, and avoids re-running showEdgeOverlays
  // every frame while hovering). Otherwise scan all tables so a first hover — before
  // any cell is focused — can reveal the table-level affordances too.
  let near: HTMLElement | null = null;
  if (
    overlayTable &&
    document.body.contains(overlayTable) &&
    pointerInActiveZone(overlayTable, gateMouseX, gateMouseY)
  ) {
    near = overlayTable;
  } else {
    for (const t of Array.from(document.querySelectorAll<HTMLElement>(".bloom-table"))) {
      if (pointerInActiveZone(t, gateMouseX, gateMouseY)) {
        near = t;
        break;
      }
    }
  }

  if (near) {
    if (near !== overlayTable) showEdgeOverlays(near);
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

// Create or retrieve a unique anchor-name for an element
function getElementAnchorName(el: HTMLElement, key: string, prefix: string): string {
  const existing = (el.dataset as any)[key] as string | undefined;
  if (existing) return existing;
  const name = `--${prefix}-${++anchorCounter}`;
  (el.style as any).anchorName = name;
  el.style.setProperty("anchor-name", name);
  (el.dataset as any)[key] = name;
  return name;
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
  const gap = 8; // px
  let rows = 0,
    cols = 0;
  try {
    const info = getTableInfo(table);
    rows = info.rowCount;
    cols = info.columnCount;
  } catch {}

  // Resolve the selected cell's row/column; clusters anchor to the edge cell of
  // that line (top cell for the column, first cell for the row).
  const selected = table.querySelector<HTMLElement>(".bloom-cell.cell--selected");
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

  // Table pills sit diagonally outside the corners of the table's *cell content*
  // (not the layout box, which can be much larger than hugging cells). Compute
  // the union rect of the visible cells; a spanning cell's rect covers the area
  // its skipped neighbours would, so this is robust to spans too.
  const cornerGap = 14; // px outward from the corner
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
  // The table-level affordances (corner pills, "+" buttons, resize handle) are
  // only meaningful when the table has rendered cells. Hide them when bounds are
  // degenerate so they don't strand mid-viewport during a transient relayout.
  if (tablePillTL) tablePillTL.style.display = haveBounds ? "flex" : "none";
  if (tablePillBR) tablePillBR.style.display = haveBounds ? "flex" : "none";
  if (colAddBtn) colAddBtn.style.display = haveBounds ? "flex" : "none";
  if (rowAddBtn) rowAddBtn.style.display = haveBounds ? "flex" : "none";
  if (haveBounds) {
    placePill(proxTablePillTL, minL - cornerGap, minT - cornerGap, "translate(-100%, -100%)");
    placePill(proxTablePillBR, maxR + cornerGap, maxB + cornerGap, "translate(0, 0)");

    // "+" add buttons hug the table edges, centered on the table's content box.
    const midX = (minL + maxR) / 2;
    const midY = (minT + maxB) / 2;
    // Row "+" below the table, horizontally centered.
    placePill(proxRowAdd, midX, maxB + gap, "translate(-50%, 0)");
    // Column "+" to the right of the table, vertically centered.
    placePill(proxColAdd, maxR + gap, midY, "translate(0, -50%)");
  }

  // Corner (resize) handle straddles the bottom-right corner of the cell content.
  if (proxCornerHandle && haveBounds) {
    const el = proxCornerHandle.element;
    el.style.position = "fixed";
    el.style.removeProperty("position-anchor");
    (el.style as any).positionAnchor = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.left = `${Math.round(maxR - 8)}px`;
    el.style.top = `${Math.round(maxB - 8)}px`;
    el.style.transform = "translate(0, 0)";
  }
}

// The table-edge "+" buttons always append at the far edge of the table,
// regardless of which cell is selected. (Use the row/column menus to insert
// relative to the current cell.)
function tryInsertColumnRight() {
  const cell = document.querySelector<HTMLElement>(".bloom-cell.cell--selected");
  const table = (cell?.closest(".bloom-table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const widths = (table.getAttribute("data-column-widths") || "")
      .split(",")
      .filter((x) => x.length > 0);
    new BloomTable(table).addColumnAt(widths.length);
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
    new BloomTable(table).addRowAt(heights.length);
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
