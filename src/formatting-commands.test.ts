import { describe, it, expect, beforeEach } from "vite-plus/test";
import { attachTable } from "./attach";
import { tableHistoryManager } from "./history";
import { resetTableSizeButtons } from "./table-size-buttons";
import {
  getCellsInScope,
  applyContentType,
  applyAlignment,
  applyPadding,
  applyCorners,
  applyFill,
  applyBorderColor,
  applyBorderStyle,
  applyBorderWeight,
  copyProperties,
  pasteProperties,
  hasCopiedProperties,
} from "./formatting-commands";
import {
  getCellAlign,
  getCellBackground,
  getCellCorners,
  getCellPadding,
  setSpan,
} from "./table-model";
import { getCurrentContentTypeId, kTableCellContentChangedEvent } from "./cell-contents";
import { render, buildRenderModel } from "./table-renderer";

// A 2x2 table matching the attribute model the renderer reads. Attached so
// history-backed commands (content type) actually run.
function makeTable(): { table: HTMLElement; cells: HTMLElement[] } {
  document.body.innerHTML = `
    <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
      <div class="bloom-cell"><div contenteditable="true">r0c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r0c1</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c0</div></div>
      <div class="bloom-cell"><div contenteditable="true">r1c1</div></div>
    </div>`;
  const table = document.querySelector(".bloom-table") as HTMLElement;
  attachTable(table);
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  return { table, cells };
}

beforeEach(() => {
  tableHistoryManager.reset?.();
  document.body.innerHTML = "";
  resetTableSizeButtons();
});

describe("getCellsInScope", () => {
  it("resolves cell, row, column, and table scopes", () => {
    const { table, cells } = makeTable();
    expect(getCellsInScope(table, "cell", cells[1])).toEqual([cells[1]]);
    expect(getCellsInScope(table, "row", cells[1])).toEqual([cells[0], cells[1]]);
    expect(getCellsInScope(table, "column", cells[2])).toEqual([cells[0], cells[2]]);
    expect(getCellsInScope(table, "table", null)).toEqual(cells);
  });

  it("returns no cells for row/column/cell scope without a reference cell", () => {
    const { table } = makeTable();
    expect(getCellsInScope(table, "row", null)).toEqual([]);
    expect(getCellsInScope(table, "column", null)).toEqual([]);
    expect(getCellsInScope(table, "cell", null)).toEqual([]);
  });

  it("includes a spanning cell in every column it covers", () => {
    const { table, cells } = makeTable();
    // cells[0] spans both columns of row 0.
    setSpan(cells[0], { x: 2, y: 1 });
    render(table);
    const colB = getCellsInScope(table, "column", cells[3]); // column 1
    expect(colB).toContain(cells[0]);
    expect(colB).toContain(cells[3]);
  });

  it("includes a vertically spanning cell in every row it covers", () => {
    const { table, cells } = makeTable();
    // cells[0] spans both rows of column 0.
    setSpan(cells[0], { x: 1, y: 2 });
    render(table);
    const row1 = getCellsInScope(table, "row", cells[3]); // row 1
    expect(row1).toContain(cells[0]);
    expect(row1).toContain(cells[3]);
  });

  it("excludes bloom-skip cells from every scope", () => {
    const { table, cells } = makeTable();
    cells[1].classList.add("bloom-skip");
    expect(getCellsInScope(table, "table", null)).toEqual([cells[0], cells[2], cells[3]]);
    expect(getCellsInScope(table, "row", cells[0])).toEqual([cells[0]]);
  });
});

describe("last command wins across menus", () => {
  it("fill: cell, then row overwrites it, then cell wins again", () => {
    const { table, cells } = makeTable();

    applyFill(table, "cell", getCellsInScope(table, "cell", cells[0]), "red");
    expect(getCellBackground(cells[0])).toBe("red");

    applyFill(table, "row", getCellsInScope(table, "row", cells[0]), "blue");
    expect(getCellBackground(cells[0])).toBe("blue");
    expect(getCellBackground(cells[1])).toBe("blue");
    expect(getCellBackground(cells[2])).toBe(null); // other row untouched

    applyFill(table, "cell", getCellsInScope(table, "cell", cells[0]), "green");
    expect(getCellBackground(cells[0])).toBe("green");
    expect(getCellBackground(cells[1])).toBe("blue"); // rest of row keeps row fill
  });

  it("table fill overwrites cell and row fills, and clears the container color", () => {
    const { table, cells } = makeTable();
    table.setAttribute("data-bg", "#123456");
    applyFill(table, "cell", [cells[3]], "red");

    applyFill(table, "table", getCellsInScope(table, "table", null), "yellow");
    for (const c of cells) expect(getCellBackground(c)).toBe("yellow");
    expect(table.getAttribute("data-bg")).toBe(null);
  });

  it("alignment: column apply overwrites a cell's earlier choice", () => {
    const { table, cells } = makeTable();
    applyAlignment(table, [cells[0]], "start");
    applyAlignment(table, getCellsInScope(table, "column", cells[0]), "end");
    expect(getCellAlign(cells[0])).toBe("end");
    expect(getCellAlign(cells[2])).toBe("end");
    expect(getCellAlign(cells[1])).toBe(null); // other column untouched
  });

  it("padding: table apply overwrites a cell's earlier choice, cell wins after", () => {
    const { table, cells } = makeTable();
    applyPadding(table, [cells[1]], 4);
    applyPadding(table, getCellsInScope(table, "table", null), 12);
    for (const c of cells) expect(getCellPadding(c)).toBe("12px");
    applyPadding(table, [cells[1]], 4);
    expect(getCellPadding(cells[1])).toBe("4px");
    expect(getCellPadding(cells[0])).toBe("12px");
  });

  it("corners: row apply overwrites, radius 0 clears the attribute", () => {
    const { table, cells } = makeTable();
    applyCorners(table, [cells[0]], 8);
    applyCorners(table, getCellsInScope(table, "row", cells[0]), 4);
    expect(getCellCorners(cells[0])?.radius).toBe(4);
    expect(getCellCorners(cells[1])?.radius).toBe(4);
    expect(getCellCorners(cells[2])).toBe(null);
    applyCorners(table, getCellsInScope(table, "row", cells[0]), 0);
    expect(getCellCorners(cells[0])).toBe(null);
  });

  it("content type: row apply converts every cell, cell apply wins after", () => {
    const { table, cells } = makeTable();
    applyContentType(table, getCellsInScope(table, "row", cells[0]), "image");
    expect(getCurrentContentTypeId(cells[0])).toBe("image");
    expect(getCurrentContentTypeId(cells[1])).toBe("image");
    applyContentType(table, [cells[0]], "text");
    expect(getCurrentContentTypeId(cells[0])).toBe("text");
    expect(getCurrentContentTypeId(cells[1])).toBe("image");
  });

  it("border color: cell apply colors that cell's perimeter; table apply overrides it", () => {
    const { table, cells } = makeTable();

    applyBorderColor(table, "cell", getCellsInScope(table, "cell", cells[0]), "#ff0000");
    expect(cells[0].style.borderTopColor).toBe("#ff0000");
    // The far cell's own perimeter edges keep the default color. (Shared inner
    // edges are painted on one adjacent cell only, so we check the sides the
    // renderer assigns to this cell: its bottom and right perimeters.)
    expect(cells[3].style.borderBottomColor).not.toBe("#ff0000");

    applyBorderColor(table, "table", getCellsInScope(table, "table", null), "#0000ff");
    expect(cells[0].style.borderTopColor).toBe("#0000ff");
    expect(cells[0].style.borderLeftColor).toBe("#0000ff");
    expect(cells[3].style.borderBottomColor).toBe("#0000ff");
    expect(cells[3].style.borderRightColor).toBe("#0000ff");
    // Weight/style preserved by the re-color.
    expect(cells[0].style.borderTopStyle).toBe("solid");
  });

  it("border color: row apply recolors that row; other rows' perimeters keep theirs", () => {
    const { table, cells } = makeTable();
    applyBorderColor(table, "row", getCellsInScope(table, "row", cells[2]), "#00ff00");
    expect(cells[2].style.borderBottomColor).toBe("#00ff00");
    expect(cells[3].style.borderBottomColor).toBe("#00ff00");
    // Top row's top perimeter untouched.
    expect(cells[0].style.borderTopColor).not.toBe("#00ff00");
  });

  it("border style: row apply restyles, preserving weight and color", () => {
    const { table, cells } = makeTable();
    applyBorderColor(table, "table", getCellsInScope(table, "table", null), "#112233");
    applyBorderStyle(table, "row", getCellsInScope(table, "row", cells[0]), "dashed");
    expect(cells[0].style.borderTopStyle).toBe("dashed");
    expect(cells[1].style.borderTopStyle).toBe("dashed");
    expect(cells[0].style.borderTopWidth).toBe("1px");
    expect(cells[0].style.borderTopColor).toBe("#112233");
    // Bottom row's bottom perimeter untouched.
    expect(cells[2].style.borderBottomStyle).toBe("solid");
  });

  it("border weight: table apply rewrites thickness, style 'none' follows weight 0", () => {
    const { table, cells } = makeTable();
    applyBorderWeight(table, "table", getCellsInScope(table, "table", null), 4);
    expect(cells[0].style.borderTopWidth).toBe("4px");
    expect(cells[0].style.borderTopStyle).toBe("solid");

    applyBorderWeight(table, "cell", getCellsInScope(table, "cell", cells[0]), 0);
    expect(cells[0].style.borderTopWidth === "" || cells[0].style.borderTopWidth === "0px").toBe(
      true,
    );
    // Neighbor's outer perimeter keeps the 4px weight.
    expect(cells[3].style.borderBottomWidth).toBe("4px");
  });

  it("border style 'none' hides the edge; a later style makes it visible again", () => {
    const { table, cells } = makeTable();
    applyBorderStyle(table, "cell", getCellsInScope(table, "cell", cells[0]), "none");
    expect(cells[0].style.borderTopWidth === "" || cells[0].style.borderTopWidth === "0px").toBe(
      true,
    );
    applyBorderStyle(table, "cell", getCellsInScope(table, "cell", cells[0]), "dotted");
    expect(cells[0].style.borderTopStyle).toBe("dotted");
    expect(cells[0].style.borderTopWidth).toBe("1px"); // re-armed from 0
  });
});

describe("copy/paste properties", () => {
  it("copies one cell's formatting and stamps it onto a row", () => {
    const { table, cells } = makeTable();
    applyAlignment(table, [cells[0]], "end");
    applyPadding(table, [cells[0]], 12);
    applyFill(table, "cell", [cells[0]], "red");
    applyCorners(table, [cells[0]], 8);
    applyBorderColor(table, "cell", [cells[0]], "#ff0000");

    expect(copyProperties([cells[0]])).not.toBe(null);
    expect(hasCopiedProperties()).toBe(true);

    pasteProperties(table, getCellsInScope(table, "row", cells[2]));

    for (const c of [cells[2], cells[3]]) {
      expect(getCellAlign(c)).toBe("end");
      expect(getCellPadding(c)).toBe("12px");
      expect(getCellBackground(c)).toBe("red");
      expect(getCellCorners(c)?.radius).toBe(8);
      // The bottom perimeter is the side the renderer assigns to these cells.
      expect(c.style.borderBottomColor).toBe("#ff0000");
    }
    // The untouched cell keeps its defaults.
    expect(getCellBackground(cells[1])).toBe(null);
    expect(getCellAlign(cells[1])).toBe(null);
  });

  it("copies from a scope's first cell, and paste is per-target-cell (last command wins)", () => {
    const { table, cells } = makeTable();
    applyFill(table, "row", getCellsInScope(table, "row", cells[0]), "purple");

    copyProperties(getCellsInScope(table, "row", cells[0]));
    pasteProperties(table, [cells[2]]);
    expect(getCellBackground(cells[2])).toBe("purple");
    expect(getCellBackground(cells[3])).toBe(null);

    // A later direct command overwrites the pasted value.
    applyFill(table, "cell", [cells[2]], "green");
    expect(getCellBackground(cells[2])).toBe("green");
  });

  it("pasting from an unformatted cell clears the target's formatting", () => {
    const { table, cells } = makeTable();
    applyFill(table, "cell", [cells[0]], "red");
    applyAlignment(table, [cells[0]], "end");
    applyPadding(table, [cells[0]], 10);
    applyCorners(table, [cells[0]], 8);

    copyProperties([cells[3]]); // untouched cell
    pasteProperties(table, [cells[0]]);

    expect(getCellBackground(cells[0])).toBe(null);
    expect(getCellAlign(cells[0])).toBe(null);
    expect(getCellCorners(cells[0])).toBe(null);
  });

  it("copying an empty scope returns null and keeps the previous clipboard", () => {
    const { cells } = makeTable();
    expect(copyProperties([cells[0]])).not.toBe(null);
    expect(copyProperties([])).toBe(null);
    expect(hasCopiedProperties()).toBe(true);
  });

  it("copying a borderless column doesn't smuggle the neighbors' lines along", () => {
    // The alphabet-exercise shape: text and image columns alternate; the image
    // columns paint nothing (their h edges are none, and the solid v
    // boundaries are painted by the text neighbors, which complete
    // perimeters). Copying an image cell and pasting onto the last (image)
    // column must yield a borderless column — in particular no invented right
    // perimeter line — while the boundary shared with the text neighbor stays.
    const solid = { weight: 1, style: "solid", color: "#858585" };
    const none = { weight: 0, style: "none", color: "#000" };
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="hug,hug,hug,hug" data-row-heights="hug">
        <div class="bloom-cell"><div contenteditable="true">text</div></div>
        <div class="bloom-cell"><div contenteditable="true">img</div></div>
        <div class="bloom-cell"><div contenteditable="true">text</div></div>
        <div class="bloom-cell"><div contenteditable="true">img</div></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    table.setAttribute(
      "data-edges-v",
      JSON.stringify([[solid, solid, solid, solid, solid]]),
    );
    table.setAttribute(
      "data-edges-h",
      JSON.stringify([
        [solid, none, solid, none],
        [solid, none, solid, none],
      ]),
    );
    attachTable(table);
    const cells = Array.from(table.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
    );

    const copied = copyProperties([cells[1]]);
    expect(copied?.border.left.style).toBe("none");
    expect(copied?.border.right.style).toBe("none");

    pasteProperties(table, [cells[3]]);

    const cb = buildRenderModel(table).cellBorders;
    const visible = (b: { weight: number; style: string } | null | undefined) =>
      !!b && b.weight > 0 && b.style !== "none";
    // The pasted column paints nothing — especially no right perimeter.
    expect(visible(cb[3].top)).toBe(false);
    expect(visible(cb[3].right)).toBe(false);
    expect(visible(cb[3].bottom)).toBe(false);
    expect(visible(cb[3].left)).toBe(false);
    // The boundary with the text neighbor survives, painted by the text cell.
    expect(visible(cb[2].right)).toBe(true);
  });

  it("paste carries the content type: the target becomes an empty skeleton of it", () => {
    const { table, cells } = makeTable();
    applyContentType(table, [cells[0]], "image");
    expect(getCurrentContentTypeId(cells[0])).toBe("image");

    copyProperties([cells[0]]);
    pasteProperties(table, [cells[3]]);

    expect(getCurrentContentTypeId(cells[3])).toBe("image");
    expect(cells[3].querySelector("img")).not.toBe(null);
    // The source's content is not copied along; same-type targets are untouched.
    expect(cells[2].textContent).toBe("r1c0");
  });
});

describe("host notification for content-type rebuilds", () => {
  // An empty cell with no data-content-type (what saved or host-supplied HTML
  // looks like before anything has typed it) reports the default type, but
  // applying that same default type still rebuilds it — so the host must be
  // told, or it never wires its editor onto the contenteditable just created.
  function makeUntypedEmptyTable(): { table: HTMLElement; cells: HTMLElement[] } {
    document.body.innerHTML = `
      <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug">
        <div class="bloom-cell"></div>
        <div class="bloom-cell"></div>
      </div>`;
    const table = document.querySelector(".bloom-table") as HTMLElement;
    attachTable(table);
    const cells = Array.from(table.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
    );
    return { table, cells };
  }

  function recordNotifications(table: HTMLElement): HTMLElement[] {
    const seen: HTMLElement[] = [];
    table.addEventListener(kTableCellContentChangedEvent, (e) => {
      seen.push((e as CustomEvent).detail.cell as HTMLElement);
    });
    return seen;
  }

  it("applyContentType notifies for an empty untyped cell set to the default type", () => {
    const { table, cells } = makeUntypedEmptyTable();
    const seen = recordNotifications(table);

    applyContentType(table, [cells[0]], "text");

    expect(cells[0].querySelector("[contenteditable]")).not.toBe(null);
    expect(seen).toEqual([cells[0]]);
  });

  it("applyContentType stays quiet for a cell that already carries the type", () => {
    const { table, cells } = makeTable(); // cells already hold contenteditables
    applyContentType(table, cells, "text"); // stamps data-content-type
    const seen = recordNotifications(table);

    applyContentType(table, cells, "text");

    expect(seen).toEqual([]);
  });

  it("pasteProperties notifies for an empty untyped target stamped with the default type", () => {
    const { table, cells } = makeUntypedEmptyTable();
    applyContentType(table, [cells[0]], "text"); // give the source a real type
    const seen = recordNotifications(table);

    copyProperties([cells[0]]);
    pasteProperties(table, [cells[1]]);

    expect(cells[1].querySelector("[contenteditable]")).not.toBe(null);
    expect(seen).toEqual([cells[1]]);
  });
});

describe("undo integration", () => {
  it("a scope-wide fill is one undo step", () => {
    const { table, cells } = makeTable();
    applyFill(table, "row", getCellsInScope(table, "row", cells[0]), "red");
    expect(getCellBackground(cells[0])).toBe("red");

    tableHistoryManager.undo(table);

    // Undo restores innerHTML, so re-query the cells.
    const fresh = Array.from(table.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
    );
    expect(getCellBackground(fresh[0])).toBe(null);
    expect(getCellBackground(fresh[1])).toBe(null);
  });

  it("a scope-wide content type change is one undo step", () => {
    const { table, cells } = makeTable();
    applyContentType(table, getCellsInScope(table, "row", cells[0]), "image");

    tableHistoryManager.undo(table);

    const fresh = Array.from(table.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
    );
    expect(getCurrentContentTypeId(fresh[0])).toBe("text");
    expect(getCurrentContentTypeId(fresh[1])).toBe("text");
  });
});

describe("per-edge border colors", () => {
  it("a weight change preserves each edge's own color", () => {
    const { table, cells } = makeTable();
    applyBorderColor(table, "cell", [cells[0]], "#ff0000");
    applyBorderColor(table, "cell", [cells[1]], "#0000ff");
    // The shared inner edge is painted on cell 0's right side and now blue.
    expect(cells[0].style.borderRightColor).toBe("#0000ff");

    applyBorderWeight(table, "cell", [cells[0]], 4);

    expect(cells[0].style.borderTopWidth).toBe("4px");
    expect(cells[0].style.borderTopColor).toBe("#ff0000");
    // The blue shared edge did not get flattened to red by the weight change.
    expect(cells[0].style.borderRightColor).toBe("#0000ff");
  });
});
