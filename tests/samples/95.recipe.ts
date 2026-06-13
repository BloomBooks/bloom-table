// UI build recipe for sample 95 — the full composite, as ONE nested table. Outer is a 1×4
// vertical stack (no border, small gap):
//   row0 header  → 1×3 [pad | "yada" title | double-bordered "Y y" box]
//   row1 block   → 4×5 word block: centered vertical divider + two full-width rules; padded,
//                  left-aligned word cells; a short spacer row between the two rules
//   row2 grids   → 1×2 [4×3 grid | 2×3 grid]
//   row3 caption → 2×3 left-aligned caption text
import {
  selectCell,
  deleteColumn,
  deleteRow,
  insertColumnRight,
  insertRowBelow,
  columnSize,
  rowSize,
  columnSizeFixed,
  rowSizeFixed,
  gapX,
  gapY,
  clearBorders,
  cellBorders,
  tableBorders,
  contentType,
  pad,
  align,
  enter,
  up,
  type,
  type Command,
} from "./ui/dsl";

const ALL: ("top" | "right" | "bottom" | "left" | "inner")[] = ["top", "right", "bottom", "left", "inner"];

// A fully-bordered grid of `cols`×`rows` (42px tracks), filled row-major from `cells`.
// Assumes the current table is the freshly-created nested 2×2 to grow.
function grid(cols: number, rows: number, cells: string[]): Command[] {
  const out: Command[] = [];
  for (let i = 0; i < cols - 2; i++) out.push(selectCell(0, 0), insertColumnRight());
  for (let i = 0; i < rows - 2; i++) out.push(selectCell(0, 0), insertRowBelow());
  for (let c = 0; c < cols; c++) out.push(columnSizeFixed(c, "42px"));
  for (let r = 0; r < rows; r++) out.push(rowSizeFixed(r, "40px"));
  out.push(tableBorders(ALL, "solid", 1));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push(type(r, c, cells[r * cols + c]));
  return out;
}

const recipe: Command[] = [
  // Outer 1×4 stack.
  selectCell(0, 0),
  deleteColumn(),
  selectCell(0, 0),
  insertRowBelow(),
  selectCell(0, 0),
  insertRowBelow(),
  clearBorders(),
  gapY("8px"),
  contentType(0, 0, "table"),
  contentType(1, 0, "table"),
  contentType(2, 0, "table"),
  contentType(3, 0, "table"),

  // ROW 0 — header: pad | title | double box.
  enter(0, 0),
  selectCell(0, 0),
  deleteRow(),
  selectCell(0, 0),
  insertColumnRight(),
  clearBorders(),
  columnSizeFixed(0, "96px"),
  columnSizeFixed(1, "100px"),
  columnSizeFixed(2, "96px"),
  rowSize(0, "hug"),
  type(0, 1, "yada"),
  contentType(0, 2, "table"),
  enter(0, 2),
  selectCell(0, 0),
  deleteRow(),
  selectCell(0, 0),
  deleteColumn(),
  columnSizeFixed(0, "88px"),
  rowSizeFixed(0, "44px"),
  tableBorders(["top", "right", "bottom", "left"], "double", 4),
  type(0, 0, "Y y"),
  up(),
  up(),

  // ROW 1 — word block (4 cols × 5 rows).
  enter(1, 0),
  selectCell(0, 0),
  insertColumnRight(),
  selectCell(0, 0),
  insertColumnRight(),
  selectCell(0, 0),
  insertRowBelow(),
  selectCell(0, 0),
  insertRowBelow(),
  selectCell(0, 0),
  insertRowBelow(),
  clearBorders(),
  columnSizeFixed(0, "60px"),
  columnSizeFixed(1, "86px"),
  columnSizeFixed(2, "86px"),
  columnSizeFixed(3, "60px"),
  rowSize(0, "hug"),
  rowSize(1, "hug"),
  rowSize(2, "hug"),
  rowSize(3, "hug"),
  rowSizeFixed(4, "6px"),
  // Divider (col1 right) for the four word rows.
  cellBorders(0, 1, ["right"], "solid", 1),
  cellBorders(1, 1, ["right"], "solid", 1),
  cellBorders(2, 1, ["right"], "solid", 1),
  cellBorders(3, 1, ["right"], "solid", 1),
  // Line 1 — bottom of row 3, full width, weight 2.
  cellBorders(3, 0, ["bottom"], "solid", 2),
  cellBorders(3, 1, ["bottom"], "solid", 2),
  cellBorders(3, 2, ["bottom"], "solid", 2),
  cellBorders(3, 3, ["bottom"], "solid", 2),
  // Line 2 — bottom of spacer row 4, full width, weight 2.
  cellBorders(4, 0, ["bottom"], "solid", 2),
  cellBorders(4, 1, ["bottom"], "solid", 2),
  cellBorders(4, 2, ["bottom"], "solid", 2),
  cellBorders(4, 3, ["bottom"], "solid", 2),
  // Padding + left alignment on the word cells (columns 1 & 2, rows 0–3).
  pad(0, 1, "6px 16px"),
  pad(0, 2, "6px 16px"),
  pad(1, 1, "6px 16px"),
  pad(1, 2, "6px 16px"),
  pad(2, 1, "6px 16px"),
  pad(2, 2, "6px 16px"),
  pad(3, 1, "6px 16px"),
  pad(3, 2, "6px 16px"),
  align(0, 1, "start"),
  align(0, 2, "start"),
  align(1, 1, "start"),
  align(1, 2, "start"),
  align(2, 1, "start"),
  align(2, 2, "start"),
  align(3, 1, "start"),
  align(3, 2, "start"),
  type(0, 1, "yada"),
  type(0, 2, "y"),
  type(1, 1, "ya-da"),
  type(1, 2, "ya"),
  type(2, 1, "ya"),
  type(2, 2, "ya-da"),
  type(3, 1, "y"),
  type(3, 2, "yada"),
  up(),

  // ROW 2 — two grids side by side.
  enter(2, 0),
  selectCell(0, 0),
  deleteRow(),
  clearBorders(),
  gapX("40px"),
  columnSize(0, "hug"),
  columnSize(1, "hug"),
  rowSize(0, "hug"),
  contentType(0, 0, "table"),
  contentType(0, 1, "table"),
  enter(0, 0),
  ...grid(4, 3, ["a", "d", "y", "a", "d", "y", "a", "d", "y", "a", "d", "y"]),
  up(),
  enter(0, 1),
  ...grid(2, 3, ["a", "ya", "ya", "da", "da", "a"]),
  up(),
  up(),

  // ROW 3 — captions.
  enter(3, 0),
  selectCell(0, 0),
  insertRowBelow(),
  clearBorders(),
  gapX("20px"),
  columnSizeFixed(0, "168px"),
  columnSize(1, "hug"),
  rowSize(0, "hug"),
  rowSize(1, "hug"),
  rowSize(2, "hug"),
  align(0, 0, "start"),
  align(0, 1, "start"),
  align(1, 0, "start"),
  align(1, 1, "start"),
  align(2, 0, "start"),
  align(2, 1, "start"),
  type(0, 0, "y a d a"),
  type(0, 1, "y a a"),
  type(1, 0, "ya-da"),
  type(1, 1, "ya-a"),
  type(2, 0, "yada"),
  type(2, 1, "yaa"),
  up(),
];

export default recipe;
