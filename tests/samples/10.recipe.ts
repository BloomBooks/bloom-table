// UI build recipe for sample 10 — title + 3-column ruled block on the left, double-bordered
// box stack on the right, as ONE nested table.
//   outer 1×2 (no border, gap)
//     left cell  → stack 1×2 (no border, gap): [ "sinini" title | 3-col ruled block ]
//     right cell → boxes 1×3 (double border, gap)
import {
  selectCell,
  deleteRow,
  deleteColumn,
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
  align,
  enter,
  up,
  type,
  type Command,
} from "./ui/dsl";

const recipe: Command[] = [
  // Outer 1×2.
  selectCell(0, 0),
  deleteRow(),
  clearBorders(),
  gapX("56px"),
  contentType(0, 0, "table"),
  contentType(0, 1, "table"),

  // LEFT: a 1×2 stack — title above the ruled block.
  enter(0, 0),
  selectCell(0, 0),
  deleteColumn(), // 2×2 → 1 col, 2 rows
  clearBorders(),
  gapY("14px"),
  // Nested tables default to fill,fill — size this stack to hug while both rows are still text.
  columnSize(0, "hug"),
  rowSize(0, "hug"),
  rowSize(1, "hug"),
  type(0, 0, "sinini"), // title (centered by default)
  contentType(1, 0, "table"), // second row becomes the block

  // BLOCK: 3 columns × 4 rows, interior vertical rules only, cols 0–1 left-aligned.
  enter(1, 0),
  selectCell(0, 0),
  insertColumnRight(),
  selectCell(0, 0),
  insertRowBelow(),
  selectCell(0, 0),
  insertRowBelow(),
  // Size the block to hug (nested default is fill).
  columnSize(0, "hug"),
  columnSize(1, "hug"),
  columnSize(2, "hug"),
  rowSize(0, "hug"),
  rowSize(1, "hug"),
  rowSize(2, "hug"),
  rowSize(3, "hug"),
  clearBorders(),
  cellBorders(0, 0, ["right"], "solid", 1),
  cellBorders(1, 0, ["right"], "solid", 1),
  cellBorders(2, 0, ["right"], "solid", 1),
  cellBorders(3, 0, ["right"], "solid", 1),
  cellBorders(0, 1, ["right"], "solid", 1),
  cellBorders(1, 1, ["right"], "solid", 1),
  cellBorders(2, 1, ["right"], "solid", 1),
  cellBorders(3, 1, ["right"], "solid", 1),
  align(0, 0, "start"),
  align(1, 0, "start"),
  align(2, 0, "start"),
  align(3, 0, "start"),
  align(0, 1, "start"),
  align(1, 1, "start"),
  align(2, 1, "start"),
  align(3, 1, "start"),
  type(0, 0, "sinini"),
  type(0, 1, "sinini"),
  type(0, 2, "sinini"),
  type(1, 0, "si-ni-ni"),
  type(1, 1, "si-ni-ni"),
  type(1, 2, "si-ni-ni"),
  type(2, 0, "si"),
  type(2, 1, "si"),
  type(2, 2, "ni"),
  type(3, 0, "s"),
  type(3, 1, "i"),
  type(3, 2, "n"),
  up(), // back to stack
  up(), // back to outer

  // RIGHT: double-bordered box stack.
  enter(0, 1),
  selectCell(0, 0),
  deleteColumn(),
  selectCell(0, 0),
  insertRowBelow(),
  columnSizeFixed(0, "92px"),
  rowSizeFixed(0, "52px"),
  rowSizeFixed(1, "52px"),
  rowSizeFixed(2, "52px"),
  gapY("16px"),
  tableBorders(["top", "right", "bottom", "left", "inner"], "double", 4),
  type(0, 0, "S s"),
  type(1, 0, "I i"),
  type(2, 0, "N n"),
  up(),
];

export default recipe;
