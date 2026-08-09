// Removes all transient, edit-time-only artifacts that the table editing UI
// injects into the document, leaving only the durable table model behind
// (div.table + div.cell with their data-* attributes and the inline styles the
// renderer writes).
//
// Host apps that persist document.body.innerHTML (e.g. Bloom) MUST call this
// before saving: the edge add/delete buttons and the hover preview bars are
// appended to document.body (not inside the table), so
// they would otherwise be captured in the saved HTML. The per-cell hint colors
// and selection classes are also edit-only and are cleared here.

const kHintColorProps = [
  "--hint-top-color",
  "--hint-right-color",
  "--hint-bottom-color",
  "--hint-left-color",
];

export function removeTableEditingArtifacts(root: ParentNode = document): void {
  // Edge add/delete button groups. These are wrapped by a ProximityDiv (a
  // position:absolute wrapper appended to <body>), so we remove the wrapper too
  // if it is left empty.
  root
    .querySelectorAll("[data-overlay-group]")
    .forEach((el) => removeWithProximityWrapper(el));

  // Other tagged overlays appended directly to <body> (hover preview bars, the
  // delete-preview X, etc.).
  root.querySelectorAll("[data-table-overlay]").forEach((el) => el.remove());

  // Transient per-cell hint colors and selection classes left by the renderer
  // and the selection highlighter.
  root.querySelectorAll<HTMLElement>(".bloom-cell").forEach((cell) => {
    kHintColorProps.forEach((p) => cell.style.removeProperty(p));
    cell.classList.remove("cell--selected", "bloom-pulse-fill", "bloom-pulse-border");
  });
  root.querySelectorAll<HTMLElement>(".bloom-table").forEach((table) => {
    table.classList.remove("table--selected");
  });
}

function removeWithProximityWrapper(el: Element): void {
  const parent = el.parentElement;
  el.remove();
  // The ProximityDiv wrapper holds exactly this one child; drop it once empty.
  if (parent && parent !== document.body && parent.children.length === 0) {
    parent.remove();
  }
}
