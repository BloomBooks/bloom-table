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

// Inline SVG icons (MUI "Add" and "Delete" glyph paths) so the core attach
// path stays free of React / MUI. fill:currentColor lets the button color
// drive the glyph color.
const kAddIconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" style="width:18px;height:18px;display:block;fill:currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
const kDeleteIconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" style="width:18px;height:18px;display:block;fill:currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

let installed = false;
// Unique ID source for anchor names
let anchorCounter = 0;

// Reset function for testing
export function resetTableSizeButtons(): void {
  installed = false;
  cornerHandle = null;
  proxCornerHandle = null;
  overlayTable = null;

  // Reset other overlay elements
  overlayRight = null;
  overlayLeft = null;
  overlayTop = null;
  overlayBottom = null;
  overlayRightDel = null;
  overlayLeftDel = null;
  overlayTopDel = null;
  overlayBottomDel = null;

  groupRight = null;
  groupLeft = null;
  groupTop = null;
  groupBottom = null;

  proxRightGroup = null;
  proxLeftGroup = null;
  proxTopGroup = null;
  proxBottomGroup = null;

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
      const cell = target.closest(".cell") as HTMLElement | null;
      if (!cell) {
        scheduleOverlayReposition();
        return;
      }
      const table = cell.closest(".table") as HTMLElement | null;
      if (!table) return;
      showEdgeOverlays(table);
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
}

// --- Small "+" overlays on four sides ---
// Add buttons
let overlayRight: HTMLButtonElement | null = null; // add column right
let overlayLeft: HTMLButtonElement | null = null; // add column left
let overlayTop: HTMLButtonElement | null = null; // add row above
let overlayBottom: HTMLButtonElement | null = null; // add row below
// Delete buttons
let overlayRightDel: HTMLButtonElement | null = null; // delete column
let overlayLeftDel: HTMLButtonElement | null = null; // delete column
let overlayTopDel: HTMLButtonElement | null = null; // delete row
let overlayBottomDel: HTMLButtonElement | null = null; // delete row

// Group containers (per side)
let groupRight: HTMLDivElement | null = null;
let groupLeft: HTMLDivElement | null = null;
let groupTop: HTMLDivElement | null = null;
let groupBottom: HTMLDivElement | null = null;

// Proximity wrappers for groups
let proxRightGroup: ProximityDiv | null = null;
let proxLeftGroup: ProximityDiv | null = null;
let proxTopGroup: ProximityDiv | null = null;
let proxBottomGroup: ProximityDiv | null = null;
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
    width: "16px",
    height: "16px",
    position: "static",
    border: "1px solid rgba(0,0,0,0.3)",
    borderRadius: "4px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.6) 0 30%, rgba(0,0,0,0.15) 30% 60%, rgba(255,255,255,0.6) 60% 100%)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
    cursor: "nwse-resize",
    display: "none",
    zIndex: "2147483647",
  } as CSSStyleDeclaration);

  // Mouse interactions
  const onMouseDown = (e: MouseEvent) => {
    console.log("🟢 Corner handle mousedown", {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const table =
      (document.querySelector(".cell.cell--selected") as HTMLElement | null)?.closest(".table") ||
      overlayTable ||
      (document.querySelector(".table") as HTMLElement | null);
    if (!table) {
      console.log("🔴 No table found for corner drag");
      return;
    }

    console.log("🎯 Found table for corner drag", { table: table.tagName });

    e.preventDefault();
    e.stopPropagation();

    // Store initial selection state to restore after drag
    const initialActiveCell =
      document.querySelector(".cell.cell--selected") || document.activeElement?.closest(".cell");
    const initialSelectedTable = initialActiveCell?.closest(".table");
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
      tableCellCount: table.querySelectorAll(".cell").length,
    });

    try {
      // Find the first cell in the potentially resized table
      const firstCell = table.querySelector(".cell") as HTMLElement;
      if (firstCell) {
        // Explicitly clear any existing selection before setting new one
        document
          .querySelectorAll(".cell.cell--selected")
          .forEach((el) => el.classList.remove("cell--selected"));
        document
          .querySelectorAll(".table.table--selected")
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
        const finalSelectedCell = document.querySelector(".cell.cell--selected");
        const finalSelectedTable = document.querySelector(".table.table--selected");
        const finalActiveElement = document.activeElement;

        console.log("🔍 Final selection state after restoration", {
          hasSelectedCell: !!finalSelectedCell,
          hasSelectedTable: !!finalSelectedTable,
          selectedTableMatchesOurTable: finalSelectedTable === table,
          activeElementTag: finalActiveElement?.tagName,
          activeElementClass: (finalActiveElement as HTMLElement)?.className,
          activeElementInOurTable:
            !!finalActiveElement?.closest(".table") && finalActiveElement?.closest(".table") === table,
        });

        if (!finalSelectedCell || finalSelectedTable !== table) {
          console.log("⚠️ Selection restoration may have failed!", {
            expectedTable: table,
            actualSelectedTable: finalSelectedTable,
            allSelectedCells: document.querySelectorAll(".cell.cell--selected").length,
            allSelectedTables: document.querySelectorAll(".table.table--selected").length,
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

type OverlayKind = "add" | "delete";
type OverlaySide = "right" | "left" | "top" | "bottom";

function makeOverlay(
  onClick: () => void,
  iconSvg: string,
  kind: OverlayKind,
  side: OverlaySide,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
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

  // Shape adjustments: Add buttons are bigger targets; Delete stays circular 24px.
  if (kind === "add") {
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
  } else {
    // delete: keep compact circle
    btn.style.width = "24px";
    btn.style.height = "24px";
    btn.style.borderRadius = "12px";
  }
  // Inject the icon as inline SVG for crisp rendering
  btn.innerHTML = iconSvg;
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => onClick());
  return btn;
}

function ensureGroupContainer(side: OverlaySide): HTMLDivElement {
  const existing =
    side === "right"
      ? groupRight
      : side === "left"
        ? groupLeft
        : side === "top"
          ? groupTop
          : groupBottom;
  if (existing) return existing;

  const div = document.createElement("div");
  div.setAttribute("data-overlay-group", side);
  Object.assign(div.style, {
    // Positioned by the ProximityDiv wrapper via anchor positioning
    position: "static",
    zIndex: "2147483647",
    display: "none",
    gap: "6px",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    // No transform here; centering handled on wrapper element
  } as any);
  // flex direction depends on side and we'll toggle display when showing
  div.style.flexDirection = side === "right" || side === "left" ? "column" : "row";
  (div.style as any).display = "none";
  document.body.appendChild(div);

  if (side === "right") groupRight = div;
  else if (side === "left") groupLeft = div;
  else if (side === "top") groupTop = div;
  else groupBottom = div;

  // Attach proximity to group
  const prox = new ProximityDiv(document.body, div);
  if (side === "right") proxRightGroup = prox;
  else if (side === "left") proxLeftGroup = prox;
  else if (side === "top") proxTopGroup = prox;
  else proxBottomGroup = prox;

  return div;
}

function ensureEdgeOverlays() {
  ensureOverlayStyles();
  // Use MUI Add/Delete icons. Placement conveys direction.
  if (!overlayRight)
    overlayRight = makeOverlay(tryInsertColumnRight, kAddIconSvg, "add", "right");
  if (!overlayLeft) overlayLeft = makeOverlay(tryInsertColumnLeft, kAddIconSvg, "add", "left");
  if (!overlayTop) overlayTop = makeOverlay(tryInsertRowAbove, kAddIconSvg, "add", "top");
  if (!overlayBottom)
    overlayBottom = makeOverlay(tryInsertRowBelow, kAddIconSvg, "add", "bottom");
  // Delete buttons
  if (!overlayRightDel)
    overlayRightDel = makeOverlay(tryRemoveColumn, kDeleteIconSvg, "delete", "right");
  if (!overlayLeftDel)
    overlayLeftDel = makeOverlay(tryRemoveColumn, kDeleteIconSvg, "delete", "left");
  if (!overlayTopDel) overlayTopDel = makeOverlay(tryRemoveRow, kDeleteIconSvg, "delete", "top");
  if (!overlayBottomDel)
    overlayBottomDel = makeOverlay(tryRemoveRow, kDeleteIconSvg, "delete", "bottom");
  // Create group containers and place buttons inside
  const rightGroup = ensureGroupContainer("right");
  const leftGroup = ensureGroupContainer("left");
  const topGroup = ensureGroupContainer("top");
  const bottomGroup = ensureGroupContainer("bottom");

  const addToGroup = (group: HTMLDivElement, ...buttons: (HTMLButtonElement | null)[]) => {
    for (const btn of buttons) {
      if (!btn) continue;
      // Make button participate in flex layout vs absolute
      btn.style.position = "static";
      btn.style.display = "flex";
      if (!group.contains(btn)) group.appendChild(btn);
    }
  };
  addToGroup(rightGroup, overlayRight, overlayRightDel);
  addToGroup(leftGroup, overlayLeft, overlayLeftDel);
  addToGroup(topGroup, overlayTop, overlayTopDel);
  addToGroup(bottomGroup, overlayBottom, overlayBottomDel);

  // Attach hover handlers once for delete previews
  const ensureHover = (btn: HTMLButtonElement | null, kind: PreviewKind) => {
    if (!btn) return;
    if ((btn as any)._hasPreviewHandlers) return;
    (btn as any)._hasPreviewHandlers = true;
    btn.addEventListener("mouseenter", () => showDeletePreview(kind));
    btn.addEventListener("mouseleave", hideDeletePreview);
  };
  ensureHover(overlayRightDel, "column");
  ensureHover(overlayLeftDel, "column");
  ensureHover(overlayTopDel, "row");
  ensureHover(overlayBottomDel, "row");

  // Attach hover handlers for ADD previews (show where the insertion will occur)
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
  ensureAddHover(overlayTop, "row", "above");
  ensureAddHover(overlayBottom, "row", "below");
  ensureAddHover(overlayLeft, "column", "left");
  ensureAddHover(overlayRight, "column", "right");
}

function showEdgeOverlays(table: HTMLElement) {
  overlayTable = table;
  ensureEdgeOverlays();
  if (groupRight) groupRight.style.display = "flex";
  if (groupLeft) groupLeft.style.display = "flex";
  if (groupTop) groupTop.style.display = "flex";
  if (groupBottom) groupBottom.style.display = "flex";
  if (cornerHandle) cornerHandle.style.display = "block";
  // Apply anchor-based positioning
  applyAnchorPositioning(table);
}

function hideEdgeOverlays() {
  if (groupRight) groupRight.style.display = "none";
  if (groupLeft) groupLeft.style.display = "none";
  if (groupTop) groupTop.style.display = "none";
  if (groupBottom) groupBottom.style.display = "none";
  if (cornerHandle) cornerHandle.style.display = "none";
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
      (document.querySelector(".cell.cell--selected") as HTMLElement | null)?.closest(".table") ||
      (document.querySelector(".table") as HTMLElement | null);
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
    if (!el.classList || !el.classList.contains("cell")) continue;
    try {
      const { row, column } = getRowAndColumn(table, el);
      if (row === targetRow && column === targetCol) return el;
    } catch {}
  }
  return null;
}

// Apply anchor-based placement to all overlay wrappers relative to the table
function applyAnchorPositioning(table: HTMLElement) {
  const gap = 8; // px
  let rows = 0,
    cols = 0;
  try {
    const info = getTableInfo(table);
    rows = info.rowCount;
    cols = info.columnCount;
  } catch {}

  const midRow = Math.max(0, Math.floor((rows - 1) / 2));
  const midCol = Math.max(0, Math.floor((cols - 1) / 2));

  // Resolve anchor cells for each overlay
  const rightCell = rows && cols ? getCellAt(table, midRow, cols - 1) : null; // middle row, last col
  const leftCell = rows && cols ? getCellAt(table, midRow, 0) : null; // middle row, first col
  const topCell = rows && cols ? getCellAt(table, 0, midCol) : null; // first row, middle col
  const bottomCell = rows && cols ? getCellAt(table, rows - 1, midCol) : null; // last row, middle col
  const cornerCell = rows && cols ? getCellAt(table, rows - 1, cols - 1) : null; // last cell

  const setWrapperToCell = (
    prox: ProximityDiv | null,
    cell: HTMLElement | null,
    side: OverlaySide,
  ) => {
    if (!prox || !cell) return;
    const el = prox.element;
    el.style.position = "fixed";
    const cellAnchor = getElementAnchorName(cell, "btableAnchorName", "btable-cell");
    (el.style as any).positionAnchor = cellAnchor;
    el.style.setProperty("position-anchor", cellAnchor);
    // Clear inline offsets first
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.transform = "";

    if (side === "right") {
      (el.style as any).left = `calc(anchor(right) + ${gap}px)`;
      (el.style as any).top = `anchor(center)`;
      el.style.transform = "translateY(-50%)";
    } else if (side === "left") {
      (el.style as any).left = `calc(anchor(left) - ${gap}px)`;
      (el.style as any).top = `anchor(center)`;
      el.style.transform = "translate(-100%, -50%)";
    } else if (side === "top") {
      (el.style as any).top = `calc(anchor(top) - ${gap}px)`;
      (el.style as any).left = `anchor(center)`;
      el.style.transform = "translate(-50%, -100%)";
    } else if (side === "bottom") {
      (el.style as any).top = `calc(anchor(bottom) + ${gap}px)`;
      (el.style as any).left = `anchor(center)`;
      el.style.transform = "translateX(-50%)";
    }
  };

  setWrapperToCell(proxRightGroup, rightCell, "right");
  setWrapperToCell(proxLeftGroup, leftCell, "left");
  setWrapperToCell(proxTopGroup, topCell, "top");
  setWrapperToCell(proxBottomGroup, bottomCell, "bottom");

  // Corner handle at bottom-right cell
  if (proxCornerHandle && cornerCell) {
    const el = proxCornerHandle.element;
    el.style.position = "fixed";
    const cellAnchor = getElementAnchorName(cornerCell, "btableAnchorName", "btable-cell");
    (el.style as any).positionAnchor = cellAnchor;
    el.style.setProperty("position-anchor", cellAnchor);
    el.style.left = `calc(anchor(right) - 8px)`;
    el.style.top = `calc(anchor(bottom) - 8px)`;
    el.style.transform = "translate(0, 0)";
  }
}

function tryInsertColumnRight() {
  const cell = document.querySelector<HTMLElement>(".cell.cell--selected");
  const table = (cell?.closest(".table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) {
      const { column } = getRowAndColumn(table, cell);
      controller.addColumnAt(column + 1);
    } else {
      const widths = (table.getAttribute("data-column-widths") || "")
        .split(",")
        .filter((x) => x.length > 0);
      controller.addColumnAt(widths.length);
    }
    scheduleOverlayReposition();
  } catch {}
}

function tryInsertColumnLeft() {
  const cell = document.querySelector<HTMLElement>(".cell.cell--selected");
  const table = (cell?.closest(".table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) {
      const { column } = getRowAndColumn(table, cell);
      controller.addColumnAt(column);
    } else {
      controller.addColumnAt(0);
    }
    scheduleOverlayReposition();
  } catch {}
}

function tryInsertRowAbove() {
  const cell = document.querySelector<HTMLElement>(".cell.cell--selected");
  const table = (cell?.closest(".table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) {
      const { row } = getRowAndColumn(table, cell);
      controller.addRowAt(row);
    } else {
      controller.addRowAt(0);
    }
    scheduleOverlayReposition();
  } catch {}
}

function tryInsertRowBelow() {
  const cell = document.querySelector<HTMLElement>(".cell.cell--selected");
  const table = (cell?.closest(".table") as HTMLElement | null) ?? overlayTable;
  if (!table) return;
  try {
    const controller = new BloomTable(table);
    if (cell) {
      const { row } = getRowAndColumn(table, cell);
      controller.addRowAt(row + 1);
    } else {
      const heights = (table.getAttribute("data-row-heights") || "")
        .split(",")
        .filter((x) => x.length > 0);
      controller.addRowAt(heights.length);
    }
    scheduleOverlayReposition();
  } catch {}
}

function tryRemoveColumn() {
  const cell = document.querySelector<HTMLElement>(".cell.cell--selected");
  const table = (cell?.closest(".table") as HTMLElement | null) ?? overlayTable;
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
  const cell = document.querySelector<HTMLElement>(".cell.cell--selected");
  const table = (cell?.closest(".table") as HTMLElement | null) ?? overlayTable;
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
  const selected = document.querySelector<HTMLElement>(".cell.cell--selected");
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
  const selected = document.querySelector<HTMLElement>(".cell.cell--selected");
  if (!selected) {
    hideDeletePreview();
    return;
  }
  const { row, column } = getRowAndColumn(overlayTable, selected);
  // Find all visible cells and compute bounds for the target row/column
  const cells: HTMLElement[] = Array.from(overlayTable.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("cell"),
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
  const selected = document.querySelector<HTMLElement>(".cell.cell--selected");
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
  const selected = document.querySelector<HTMLElement>(".cell.cell--selected");
  if (!selected) {
    hideAddPreview();
    return;
  }
  const { row, column } = getRowAndColumn(overlayTable, selected);
  const cells: HTMLElement[] = Array.from(overlayTable.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("cell"),
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
