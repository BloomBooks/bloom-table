import { describe, it, expect } from "vite-plus/test";
import { attachTextEditing, detachTextEditing } from "./text-editing";

function makeTable(): HTMLElement {
  const table = document.createElement("div");
  table.className = "bloom-table";
  return table;
}

function makeEditableCell(table: HTMLElement): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "bloom-cell";
  const editable = document.createElement("div");
  editable.setAttribute("contenteditable", "true");
  cell.appendChild(editable);
  table.appendChild(cell);
  return editable;
}

function putCaretIn(editable: HTMLElement) {
  const selection = window.getSelection()!;
  const range = document.createRange();
  range.setStart(editable, 0);
  range.setEnd(editable, 0);
  selection.removeAllRanges();
  selection.addRange(range);
}

function pressEnter(target: HTMLElement, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe("attachTextEditing", () => {
  it("inserts exactly one paragraph on Enter", () => {
    const table = makeTable();
    document.body.appendChild(table);
    const editable = makeEditableCell(table);
    attachTextEditing(table);
    putCaretIn(editable);

    const event = pressEnter(editable);

    expect(event.defaultPrevented).toBe(true);
    expect(editable.querySelectorAll("p").length).toBe(1);
    table.remove();
  });

  it("a nested table's Enter inserts only one paragraph, not one per ancestor table", () => {
    const outer = makeTable();
    document.body.appendChild(outer);
    const outerCell = document.createElement("div");
    outerCell.className = "bloom-cell";
    outer.appendChild(outerCell);
    const inner = makeTable();
    outerCell.appendChild(inner);
    const editable = makeEditableCell(inner);

    attachTextEditing(outer);
    attachTextEditing(inner);
    putCaretIn(editable);

    pressEnter(editable);

    expect(editable.querySelectorAll("p").length).toBe(1);
    expect(editable.querySelectorAll("p p").length).toBe(0);
    outer.remove();
  });

  it("attaching twice does not stack listeners", () => {
    const table = makeTable();
    document.body.appendChild(table);
    const editable = makeEditableCell(table);
    attachTextEditing(table);
    attachTextEditing(table);
    putCaretIn(editable);

    pressEnter(editable);

    expect(editable.querySelectorAll("p").length).toBe(1);
    table.remove();
  });

  it("detachTextEditing stops the handler from rewriting Enter", () => {
    const table = makeTable();
    document.body.appendChild(table);
    const editable = makeEditableCell(table);
    attachTextEditing(table);
    detachTextEditing(table);
    putCaretIn(editable);

    const event = pressEnter(editable);

    expect(event.defaultPrevented).toBe(false);
    expect(editable.querySelectorAll("p").length).toBe(0);
    table.remove();
  });

  it("ignores Enter on a focusable but non-editable div", () => {
    const table = makeTable();
    document.body.appendChild(table);
    const editable = makeEditableCell(table);
    const imageCell = document.createElement("div");
    imageCell.className = "bloom-cell";
    imageCell.tabIndex = -1;
    table.appendChild(imageCell);
    attachTextEditing(table);
    // Caret is left in the text cell while focus/keydown happens on the image cell.
    putCaretIn(editable);

    const event = pressEnter(imageCell);

    expect(event.defaultPrevented).toBe(false);
    expect(editable.querySelectorAll("p").length).toBe(0);
    expect(imageCell.querySelectorAll("p").length).toBe(0);
    table.remove();
  });

  it("lets Shift+Enter and Ctrl+Enter through", () => {
    const table = makeTable();
    document.body.appendChild(table);
    const editable = makeEditableCell(table);
    attachTextEditing(table);
    putCaretIn(editable);

    expect(pressEnter(editable, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(pressEnter(editable, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(editable.querySelectorAll("p").length).toBe(0);
    table.remove();
  });
});
