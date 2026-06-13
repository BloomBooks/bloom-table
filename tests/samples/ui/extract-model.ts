// Canonical table-model extractor — the oracle for UI-built samples.
//
// Runs IN THE BROWSER via page.evaluate, so it must be fully self-contained (no imports,
// no closures over module scope). It reads the *resolved* state of an attached table:
// author-level data-* attributes plus the per-side border styles the renderer wrote inline.
// Because both the UI-built table and the validated NN.html go through the same attach +
// render, two tables are equivalent iff their extracted models deep-equal — independent of
// edge-encoding shorthand (concise vs full arrays), attribute order, or inline-style noise.

export interface CellModel {
  type: string;
  spanX: string;
  spanY: string;
  align: string;
  pad: string;
  corners: string;
  borders: { top: string; right: string; bottom: string; left: string };
  content: string | { img: string } | TableModel;
}
export interface TableModel {
  cols: string;
  rows: string;
  gapX: string;
  gapY: string;
  corners: string;
  cells: CellModel[];
}

// The function body below is serialized and executed in the page. Keep it dependency-free.
export function extractTableModelInPage(rootSelector: string): TableModel | null {
  const root = document.querySelector(rootSelector) as HTMLElement | null;

  const side = (cell: HTMLElement, p: "top" | "right" | "bottom" | "left"): string => {
    const s = cell.style;
    const style = s.getPropertyValue(`border-${p}-style`) || "none";
    const width = s.getPropertyValue(`border-${p}-width`) || "0px";
    if (style === "none" || parseFloat(width) === 0 || Number.isNaN(parseFloat(width)))
      return "none";
    const color = s.getPropertyValue(`border-${p}-color`) || "";
    return `${style} ${Math.round(parseFloat(width))}px ${color}`;
  };

  const model = (table: HTMLElement): TableModel => {
    const cells = Array.from(table.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
    );
    return {
      cols: table.getAttribute("data-column-widths") || "",
      rows: table.getAttribute("data-row-heights") || "",
      gapX: table.style.columnGap || "",
      gapY: table.style.rowGap || "",
      corners: table.getAttribute("data-corners") || "",
      cells: cells.map((cell): CellModel => {
        const nested = Array.from(cell.children).find(
          (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-table"),
        );
        const img = cell.querySelector("img");
        let content: string | { img: string } | TableModel;
        if (nested) content = model(nested);
        // Image identity (the src) isn't user-settable through the UI and isn't judgeable,
        // so an image cell is recorded by presence only.
        else if (img) content = { img: "[image]" };
        else content = (cell.textContent || "").replace(/\s+/g, " ").trim();
        return {
          type: cell.getAttribute("data-content-type") || "text",
          spanX: cell.getAttribute("data-span-x") || "1",
          spanY: cell.getAttribute("data-span-y") || "1",
          align: cell.getAttribute("data-align") || "center",
          pad: cell.getAttribute("data-pad") || "",
          corners: cell.getAttribute("data-corners") || "",
          borders: {
            top: side(cell, "top"),
            right: side(cell, "right"),
            bottom: side(cell, "bottom"),
            left: side(cell, "left"),
          },
          content,
        };
      }),
    };
  };

  return root ? model(root) : null;
}
