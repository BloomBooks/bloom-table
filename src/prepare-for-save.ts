// Removes all transient, edit-time-only artifacts that the table editing UI
// injects into the document, leaving only the durable table model behind
// (div.table + div.cell with their data-* attributes and the inline styles the
// renderer writes).
//
// Host apps that persist document.body.innerHTML (e.g. Bloom) MUST call this
// before saving: the "+" add buttons, the row/column/table menu pills and their
// clusters, each pill's ProximityDiv wrapper, an open menu popup, the paint-format
// badge and the hover preview bars are all appended to document.body (not inside
// the table), so they would otherwise be captured in the saved HTML. The per-cell
// hint colors and selection classes are also edit-only and are cleared here.
//
// Anything appended outside the table must be tagged data-table-overlay at
// creation time; that attribute is the whole contract this function relies on.

// Legacy: older renderer versions wrote per-cell hint colors inline (boundary
// hints are pure CSS now). Keep stripping them so content saved by an old
// version comes out clean.
const kHintColorProps = [
  "--hint-top-color",
  "--hint-right-color",
  "--hint-bottom-color",
  "--hint-left-color",
];

export function removeTableEditingArtifacts(root: ParentNode = document): void {
  // Every piece of edit-time chrome outside the table is tagged
  // data-table-overlay at creation: the ProximityDiv wrappers appended to
  // <body> (which carry the "+" add buttons, the row/column/table menu pills
  // and the pill clusters), the open menu popup, the paint-format badge and
  // <style>, the hover preview bars and the pulse overlay. Removing a wrapper
  // takes its child with it; removing an already-detached child is a no-op.
  root.querySelectorAll("[data-table-overlay]").forEach((el) => el.remove());

  // Paint Format mode paints the cursor via a class on <body>. `root` may be
  // the document, the body itself, or a container above the table.
  root.querySelectorAll("body").forEach((b) => b.classList.remove("bloom-paint-format"));
  if (root instanceof Element) root.classList.remove("bloom-paint-format");

  // Transient per-cell hint colors and selection classes left by the renderer
  // and the selection highlighter.
  root.querySelectorAll<HTMLElement>(".bloom-cell").forEach((cell) => {
    kHintColorProps.forEach((p) => cell.style.removeProperty(p));
    cell.classList.remove("cell--selected", "bloom-pulse-fill", "bloom-pulse-border");
  });

  // Anchor names the pill-positioning code minted for cells. They are only
  // meaningful within the session that minted them; saved copies collide with
  // the next session's names (its counter restarts), anchoring the pills to
  // the wrong cell.
  root.querySelectorAll<HTMLElement>("[data-btable-anchor-name]").forEach((el) => {
    el.style.removeProperty("anchor-name");
    delete el.dataset.btableAnchorName;
  });
  root.querySelectorAll<HTMLElement>(".bloom-table").forEach((table) => {
    table.classList.remove("table--selected", "bloom-pointer-near");
  });
}
