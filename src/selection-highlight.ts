// Global selection highlighter: adds classes to the active cell and its table.
// - cell--selected (blue outline via CSS)
// - table--selected (purple outline via CSS)
// Selection persists when focus moves outside cells (e.g., into menus).

let installed = false;

export function ensureSelectionHighlighting(): void {
  if (installed) return;
  installed = true;

  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const cell = target.closest(".cell") as HTMLElement | null;
      if (!cell) {
        // Do not clear selection on non-cell focus; persistence desired.
        return;
      }

      // Move cell selection
      document
        .querySelectorAll<HTMLElement>(".cell.cell--selected")
        .forEach((el) => el.classList.remove("cell--selected"));
      cell.classList.add("cell--selected");

      // Mark the nearest table as selected, clear others
      const table = cell.closest(".table") as HTMLElement | null;
      if (!table) return;
      document
        .querySelectorAll<HTMLElement>(".table.table--selected")
        .forEach((g) => g.classList.remove("table--selected"));
      table.classList.add("table--selected");
    },
    true,
  );
}
