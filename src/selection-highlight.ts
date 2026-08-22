// Global selection highlighter: adds classes to the active cell and its table.
// - cell--selected (blue outline via CSS)
// - table--selected (purple outline via CSS)
// - bloom-current-table, on a NESTED table the user has entered
// Selection persists when focus moves outside cells (e.g., into menus).
//
// Selecting a cell == focusing something inside it (the focusin handler below
// drives the classes; hosts like the toolbar also track the focused cell). To
// make the whole cell an easy click target — not just the small text box — a
// mousedown handler routes clicks anywhere in a cell to that cell's own
// editable (so you can type immediately), or to the cell element itself when it
// has no text (e.g. image/table cells). This keeps "selected" expressed through
// focus, which is the seam a future multi-cell selection model would build on.
//
// Nesting: the cell a click selects is decided by current-table.ts, one nesting
// level at a time. A single click inside a nested table selects the HOST cell of
// that table; a double-click descends one level; a click on a cell of an
// ancestor or unrelated table selects that cell and hands its table the chrome.

import {
  clickTargetCell,
  currentTable,
  doubleClickTargetCell,
  firstCellOf,
  hostCellOf,
  markCurrentTable,
  nestedTableIn,
  ownerTable,
  selectCell,
  selectedCell,
} from "./current-table";

let installed = false;

// Content that comes with its own mousedown behavior: media the user may want to
// drag or scrub, and anything natively focusable or clickable. Clicking these
// still selects the cell, but we must not call preventDefault on them.
const OWN_MOUSEDOWN_BEHAVIOR_SELECTOR = [
  "img",
  "video",
  "audio",
  "iframe",
  "canvas",
  "embed",
  "object",
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  '[draggable="true"]',
].join(",");

// True when the click landed in the very editor of the cell we are selecting, so
// the browser's own caret placement is the right answer.
function clickIsInOwnEditor(target: HTMLElement, cell: HTMLElement): boolean {
  const editor = target.closest<HTMLElement>(
    '[contenteditable]:not([contenteditable="false"])',
  );
  return !!editor && editor.closest(".bloom-cell") === cell;
}

function onMouseDown(event: MouseEvent): void {
  // Only the primary button drives cell selection. A right-click must keep
  // its native focus/caret behavior before the context menu opens, and a
  // middle-click its own defaults (autoscroll, X11 primary-selection paste).
  if (event.button !== 0) return;
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const cell = clickTargetCell(target);
  if (!cell) return;
  // Leave native caret placement alone when the click is already in this cell's
  // own editable.
  if (clickIsInOwnEditor(target, cell)) return;
  // We manage focus/caret ourselves, so suppress the default (which would do
  // nothing useful when clicking the cell's empty padding area, and would put
  // the caret in a NESTED table's text when the click fell through a host
  // cell) — unless the click landed on content that needs its own mousedown,
  // such as an image being dragged or a video's controls.
  if (!target.closest(OWN_MOUSEDOWN_BEHAVIOR_SELECTOR)) event.preventDefault();
  selectCell(cell);
}

// A double-click enters the nested table under the pointer, one level per
// double-click. Registered in the BUBBLE phase on the document, so
// drag-to-resize (which listens on the table and stops propagation for an
// edge grab) keeps its auto-size double-click.
function onDoubleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const cell = doubleClickTargetCell(target);
  if (!cell || cell === selectedCell()) return;
  event.preventDefault();
  selectCell(cell);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Enter" && event.key !== "Escape") return;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  // A popup menu owns both keys while it is open (Escape closes it).
  if (document.querySelector("[data-btable-menu]")) return;
  const selected = selectedCell();
  if (!selected) return;

  if (event.key === "Enter") {
    // Enter on a selected cell that HOSTS a table enters that table. On a text
    // cell the caret is in the editor instead, and text-editing.ts inserts a
    // paragraph, so nothing here applies.
    if (document.activeElement !== selected) return;
    const nested = nestedTableIn(selected);
    const first = nested ? firstCellOf(nested) : null;
    if (!first) return;
    event.preventDefault();
    selectCell(first);
    return;
  }

  // Escape leaves a nested table: select the host cell one level up. Clicking a
  // cell of the outer table is the primary exit; this is the keyboard path.
  const table = ownerTable(selected);
  const host = table ? hostCellOf(table) : null;
  if (!host) return;
  event.preventDefault();
  selectCell(host);
}

function onFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const cell = target.closest(".bloom-cell") as HTMLElement | null;
  if (!cell) {
    // Do not clear selection on non-cell focus; persistence desired.
    return;
  }

  // Move cell selection
  document
    .querySelectorAll<HTMLElement>(".bloom-cell.cell--selected")
    .forEach((el) => el.classList.remove("cell--selected"));
  cell.classList.add("cell--selected");

  // Mark the owning table as selected, clear others
  const table = ownerTable(cell);
  if (!table) return;
  document
    .querySelectorAll<HTMLElement>(".bloom-table.table--selected")
    .forEach((g) => g.classList.remove("table--selected"));
  table.classList.add("table--selected");
  markCurrentTable(table);
}

export function ensureSelectionHighlighting(): void {
  if (installed) return;
  installed = true;

  // Click anywhere in a cell selects it (not just the inner text box).
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("dblclick", onDoubleClick);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn, true);
}

// The table the chrome must serve, re-exported so callers that only care about
// selection don't have to know about current-table.ts.
export { currentTable };
