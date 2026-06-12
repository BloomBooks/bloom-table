export function migrateTable(tableDiv: HTMLElement): void {
  if (!tableDiv) throw new Error("Table element is required");

  // make sure that every div.cell that has a first child that is a div.table
  // is selectable by setting its tabindex to -1
  const cells = tableDiv.querySelectorAll("div.cell");
  cells.forEach((cell) => {
    const firstChild = cell.firstElementChild;
    if (firstChild && firstChild.classList.contains("table")) {
      cell.setAttribute("tabindex", "-1");
    }
  });
}