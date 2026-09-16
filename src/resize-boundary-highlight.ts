// The blue line that shows which row or column boundary a press would grab.
//
// Hovering within a few pixels of a cell's right or bottom edge already turns the
// cursor into a resize cursor. That says a drag would resize something, but not
// which line it would move, which is ambiguous wherever cells of different sizes
// meet. This draws that line.
//
// It lives apart from table-size-buttons.ts, which owns the other overlays,
// because drag-to-resize.ts must not import that module: importing it mounts the
// whole menu system.

import { kBloomBlue } from "./constants";

// Thick enough to read as a line the pointer is aiming at, thin enough that it
// does not hide the content on either side of the boundary.
const kThickness = 4;

let highlightDiv: HTMLDivElement | null = null;

// The element is created once and kept, but a host may replace the whole page
// body under us, which would leave the cached div detached; re-append it then.
function ensureHighlightDiv(): HTMLDivElement {
  if (highlightDiv && highlightDiv.isConnected) return highlightDiv;
  const div = highlightDiv ?? document.createElement("div");
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
    borderRadius: "2px",
  } as CSSStyleDeclaration);
  // prepare-for-save.ts strips every element carrying this attribute, so the
  // highlight can never reach saved content.
  div.setAttribute("data-table-overlay", "resize-boundary");
  document.body.appendChild(div);
  highlightDiv = div;
  return div;
}

// Union of the table's visible cell rects, in viewport coordinates; null when the
// table has no laid-out cells. table-size-buttons.ts imports this for its own
// overlays, so every overlay measures the table the same way.
export function visibleCellBounds(
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

/**
 * Draw the line a press at the current hover would move.
 *
 * `boundary` is that line's position in viewport coordinates: the y of a row's
 * bottom edge, or the x of a column's right edge. The line runs the whole way
 * across the table on the other axis. A table with no measurable cells hides the
 * highlight rather than drawing it somewhere arbitrary.
 */
export function showResizeBoundaryHighlight(
  table: HTMLElement,
  type: "row" | "column",
  boundary: number,
): void {
  const b = visibleCellBounds(table);
  if (!b) {
    hideResizeBoundaryHighlight();
    return;
  }
  const div = ensureHighlightDiv();
  if (type === "row") {
    Object.assign(div.style, {
      left: `${Math.round(window.scrollX + b.minL)}px`,
      top: `${Math.round(window.scrollY + boundary - kThickness / 2)}px`,
      width: `${Math.round(b.maxR - b.minL)}px`,
      height: `${kThickness}px`,
      display: "block",
    } as CSSStyleDeclaration);
  } else {
    Object.assign(div.style, {
      left: `${Math.round(window.scrollX + boundary - kThickness / 2)}px`,
      top: `${Math.round(window.scrollY + b.minT)}px`,
      width: `${kThickness}px`,
      height: `${Math.round(b.maxB - b.minT)}px`,
      display: "block",
    } as CSSStyleDeclaration);
  }
}

/** Take the line away. Safe to call when nothing is showing. */
export function hideResizeBoundaryHighlight(): void {
  if (highlightDiv) highlightDiv.style.display = "none";
}
