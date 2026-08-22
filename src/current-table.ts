// The "current table" and the click rules that move it.
//
// Tables nest: a cell can hold a whole table (data-content-type="table"). One
// table at a time is the current table — the table that owns the selected cell
// (the single cell carrying .cell--selected). All editing chrome ("+" buttons,
// row/column/table pills, menus) serves the current table and nothing else, so
// nothing here reads the pointer position: the pointer decides only whether
// that chrome is visible.
//
// Clicks move the current table one nesting level at a time:
//  - a single click selects the cell at the current table's level, so a click
//    that lands inside a nested table still selects the HOST cell;
//  - a double-click descends exactly one level;
//  - a click on a cell of an ancestor or of an unrelated table selects that
//    cell, which makes ITS table current — the exit gesture.
//
// This module holds no state and imports nothing, so every other module can
// use it without a cycle.

export const kCurrentTableClass = "bloom-current-table";

// The cell's own text editor, ignoring editors that belong to a nested table's
// cells. Returns null for a cell with no text of its own (image, video, or a
// cell hosting a table).
export function ownEditable(cell: HTMLElement): HTMLElement | null {
  // A bare `contenteditable` attribute is editable too ("" means true), so
  // match on anything but an explicit "false".
  const editors = cell.querySelectorAll<HTMLElement>(
    '[contenteditable]:not([contenteditable="false"])',
  );
  for (const editor of Array.from(editors)) {
    if (editor.closest(".bloom-cell") === cell) return editor;
  }
  return null;
}

// The table a cell belongs to. A cell is always a direct child of its table, so
// this never reaches past a nested table into its host's table.
export function ownerTable(cell: HTMLElement): HTMLElement | null {
  const parent = cell.parentElement;
  if (!parent) return null;
  return parent.classList.contains("bloom-table")
    ? parent
    : (parent.closest<HTMLElement>(".bloom-table") ?? null);
}

// The one selected cell in the document, or null.
export function selectedCell(root: Document | HTMLElement = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(".bloom-cell.cell--selected");
}

// The selected cell belonging to THIS table (a direct child), or null. A
// descendant query would also find a selected cell inside a nested table.
export function ownSelectedCell(table: HTMLElement): HTMLElement | null {
  for (const child of Array.from(table.children)) {
    if (
      child instanceof HTMLElement &&
      child.classList.contains("bloom-cell") &&
      child.classList.contains("cell--selected")
    ) {
      return child;
    }
  }
  return null;
}

// The table that owns the selected cell.
export function currentTable(): HTMLElement | null {
  const cell = selectedCell();
  return cell ? ownerTable(cell) : null;
}

export function isNestedTable(table: HTMLElement): boolean {
  return !!table.parentElement?.closest(".bloom-table");
}

// The cell a nested table lives in; null for a top-level table.
export function hostCellOf(table: HTMLElement): HTMLElement | null {
  return table.parentElement?.closest<HTMLElement>(".bloom-cell") ?? null;
}

// The table a cell hosts, if any.
export function nestedTableIn(cell: HTMLElement): HTMLElement | null {
  for (const child of Array.from(cell.children)) {
    if (child instanceof HTMLElement && child.classList.contains("bloom-table")) return child;
  }
  return null;
}

// The first cell of a table, skipping cells covered by a merged neighbour.
export function firstCellOf(table: HTMLElement): HTMLElement | null {
  for (const child of Array.from(table.children)) {
    if (
      child instanceof HTMLElement &&
      child.classList.contains("bloom-cell") &&
      !child.classList.contains("bloom-skip")
    ) {
      return child;
    }
  }
  return null;
}

// Every cell containing the event target, outermost first. For a click inside a
// nested table this is [host cell, nested cell, ...]; the entry at index i
// belongs to the table at nesting level i.
export function cellChain(target: HTMLElement | null): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let node: HTMLElement | null = target;
  while (node) {
    const cell = node.closest<HTMLElement>(".bloom-cell");
    if (!cell) break;
    chain.unshift(cell);
    node = cell.parentElement;
  }
  return chain;
}

// Where the current table sits in a click's chain, or -1 when the click landed
// in an unrelated table (a sibling, or a table the user has not entered).
function levelOfCurrentTable(chain: HTMLElement[], current: HTMLElement | null): number {
  if (!current) return -1;
  return chain.findIndex((cell) => ownerTable(cell) === current);
}

// The cell a single click selects: the one at the current table's level, or the
// outermost cell of the chain when the click landed outside the current table.
export function clickTargetCell(
  target: HTMLElement | null,
  current: HTMLElement | null = currentTable(),
): HTMLElement | null {
  const chain = cellChain(target);
  if (!chain.length) return null;
  const level = levelOfCurrentTable(chain, current);
  return level >= 0 ? chain[level] : chain[0];
}

// The cell a double-click selects: one nesting level in from the current table.
// Null when there is no deeper level, which leaves the browser's own
// double-click behavior (selecting a word) alone.
export function doubleClickTargetCell(
  target: HTMLElement | null,
  current: HTMLElement | null = currentTable(),
): HTMLElement | null {
  const chain = cellChain(target);
  if (!chain.length) return null;
  return chain[levelOfCurrentTable(chain, current) + 1] ?? null;
}

// Select a cell: focus its own text editor with the caret at the end, or the
// cell itself when it has no text of its own.
export function selectCell(cell: HTMLElement): void {
  const editor = ownEditable(cell);
  if (!editor) {
    if (!cell.hasAttribute("tabindex")) cell.setAttribute("tabindex", "-1");
    cell.focus();
    return;
  }
  editor.focus();
  const win = cell.ownerDocument.defaultView ?? window;
  const selection = win.getSelection?.();
  if (!selection) return;
  const range = cell.ownerDocument.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Mark the current table so the user can see which level the chrome serves.
// Only a NESTED current table is marked: a top-level table needs no signal,
// since its chrome is the only chrome there has ever been.
export function markCurrentTable(table: HTMLElement | null): void {
  document
    .querySelectorAll<HTMLElement>(`.${kCurrentTableClass}`)
    .forEach((el) => el.classList.remove(kCurrentTableClass));
  if (table && isNestedTable(table)) table.classList.add(kCurrentTableClass);
}
