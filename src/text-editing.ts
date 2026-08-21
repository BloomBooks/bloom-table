// Tables can nest, so a keydown inside a nested cell bubbles through every
// ancestor table div. Each table is attached in its own right, so without a
// guard the same Enter would be handled once per ancestor, inserting one
// paragraph nested inside another. We keep the listener per table, remember it
// so attaching twice is a no-op and detaching can remove it, and have the
// handler bail out when the event belongs to a nearer table.
const attachedTables = new WeakMap<HTMLElement, (event: KeyboardEvent) => void>();

// `instanceof HTMLElement` fails when the table lives in an iframe document
// while the library is loaded in the parent (Bloom's hosting model), so
// duck-type instead.
function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  const element = target as HTMLElement | null;
  if (!element || element.nodeType !== 1) return false;
  if (element.isContentEditable === true) return true;
  // Non-browser DOM implementations (happy-dom, which the tests run in) don't
  // compute isContentEditable, so fall back to the nearest explicit
  // contenteditable attribute.
  let node: HTMLElement | null = element;
  while (node) {
    const attribute = node.getAttribute?.("contenteditable");
    if (attribute !== null && attribute !== undefined) return attribute !== "false";
    node = node.parentElement;
  }
  return false;
}

export function attachTextEditing(tableDiv: HTMLElement): void {
  if (!tableDiv) throw new Error("Table element is required");
  if (attachedTables.has(tableDiv)) return; // already attached

  // when the user presses "Enter" and we're inside of a contenteditable div, we don't want to just
  // add divs like the browser does, we want to add paragraph
  const handler = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    // Let Shift+Enter (soft break) and any other modified Enter through to the
    // browser and to other handlers.
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    // Only rewrite Enter when the caret is actually in editable content. Cells
    // themselves are focusable divs (tabIndex = -1) and image/video cells hold
    // no contenteditable at all; hijacking Enter there would insert a paragraph
    // at wherever the document's selection happened to be, possibly in another
    // cell or outside the table.
    if (!isEditableTarget(event.target)) return;
    // A nested table's own handler has already dealt with this event; the
    // ancestor tables must not insert a second paragraph. (If the nearer table
    // has no handler of its own, this table still does the work.)
    const nearestTable = event.target.closest<HTMLElement>(".bloom-table");
    if (nearestTable && nearestTable !== tableDiv && attachedTables.has(nearestTable)) return;

    const selection = window.getSelection();
    if (!selection) return;
    if (!selection.rangeCount) return;

    event.preventDefault();

    const range = selection.getRangeAt(0);
    const p = document.createElement("p");
    p.innerHTML = "<br>"; // placeholder for new line
    range.deleteContents();
    range.insertNode(p);

    // move caret inside new paragraph
    range.setStart(p, 0);
    range.setEnd(p, 0);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  attachedTables.set(tableDiv, handler);
  tableDiv.addEventListener("keydown", handler);
}

export function detachTextEditing(tableDiv: HTMLElement): void {
  if (!tableDiv) throw new Error("Table element is required");
  const handler = attachedTables.get(tableDiv);
  if (!handler) return;
  attachedTables.delete(tableDiv);
  tableDiv.removeEventListener("keydown", handler);
}
