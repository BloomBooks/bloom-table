// Global selection highlighter: adds classes to the active cell and its table.
// - cell--selected (blue outline via CSS)
// - table--selected (purple outline via CSS)
// Selection persists when focus moves outside cells (e.g., into menus).
//
// Selecting a cell == focusing something inside it (the focusin handler below
// drives the classes; hosts like the toolbar also track the focused cell). To
// make the whole cell an easy click target — not just the small text box — a
// mousedown handler routes clicks anywhere in a cell to that cell's own
// editable (so you can type immediately), or to the cell element itself when it
// has no text (e.g. image/table cells). This keeps "selected" expressed through
// focus, which is the seam a future multi-cell selection model would build on.

let installed = false;

// The cell's own text editor, ignoring editors that belong to a nested table's
// cells. Returns null for non-text cells.
function ownEditable(cell: HTMLElement): HTMLElement | null {
  const editors = cell.querySelectorAll<HTMLElement>('[contenteditable="true"]');
  for (const ed of Array.from(editors)) {
    if (ed.closest(".bloom-cell") === cell) return ed;
  }
  return null;
}

function selectCellFromClick(target: HTMLElement): void {
  const cell = target.closest(".bloom-cell") as HTMLElement | null;
  if (!cell) return;

  // If the click already landed inside this cell's own editable, let the browser
  // place the caret normally.
  const editorUnderClick = target.closest('[contenteditable="true"]') as HTMLElement | null;
  if (editorUnderClick && editorUnderClick.closest(".bloom-cell") === cell) return;

  const editor = ownEditable(cell);
  if (editor) {
    editor.focus();
    // Put the caret at the end of the existing content so typing appends.
    const win = cell.ownerDocument.defaultView ?? window;
    const sel = win.getSelection?.();
    if (sel) {
      const range = cell.ownerDocument.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else {
    // No text to edit (image/video/nested-table cell): focus the cell itself so
    // it still becomes the selected cell.
    if (!cell.hasAttribute("tabindex")) cell.setAttribute("tabindex", "-1");
    cell.focus();
  }
}

export function ensureSelectionHighlighting(): void {
  if (installed) return;
  installed = true;

  // Click anywhere in a cell selects it (not just the inner text box).
  document.addEventListener(
    "mousedown",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const cell = target.closest(".bloom-cell") as HTMLElement | null;
      if (!cell) return;
      const editorUnderClick = target.closest('[contenteditable="true"]') as HTMLElement | null;
      // Only intervene when the click missed this cell's own editable; otherwise
      // leave native caret placement alone.
      if (editorUnderClick && editorUnderClick.closest(".bloom-cell") === cell) return;
      // We manage focus/caret ourselves, so suppress the default (which would do
      // nothing useful when clicking the cell's empty padding area).
      event.preventDefault();
      selectCellFromClick(target);
    },
    true,
  );

  document.addEventListener(
    "focusin",
    (event) => {
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

      // Mark the nearest table as selected, clear others
      const table = cell.closest(".bloom-table") as HTMLElement | null;
      if (!table) return;
      document
        .querySelectorAll<HTMLElement>(".bloom-table.table--selected")
        .forEach((g) => g.classList.remove("table--selected"));
      table.classList.add("table--selected");
    },
    true,
  );
}
