export function attachTextEditing(tableDiv: HTMLElement): void {
  if (!tableDiv) throw new Error("Table element is required");

  // when the usr presses "Enter" and we're inside of a contenteditable div, we don't want to just
  // add divs like the browser does, we want to add paragraph
  tableDiv.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLDivElement) {
      event.preventDefault();
      //   const target = event.target as HTMLDivElement;
      //   const newParagraph = document.createElement("p");
      //   newParagraph.textContent = "";
      //   target.appendChild(newParagraph);
      //   newParagraph.focus();
      const selection = window.getSelection();
      if (!selection) throw new Error("No selection found");
      if (!selection.rangeCount) return;

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
    }
  });
}