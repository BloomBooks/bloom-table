// UI build recipe for sample 05 — three double-bordered boxes stacked with vertical gaps.
// Built from the blank 2×2: reduce to one column, three rows, fixed sizes, a row gap, and a
// uniform double border (the gap turns the shared edges into each box's facing borders).
import {
  selectCell,
  deleteColumn,
  insertRowBelow,
  columnSizeFixed,
  rowSizeFixed,
  gapY,
  tableBorders,
  type,
  type Command,
} from "./ui/dsl";

const recipe: Command[] = [
  selectCell(0, 0),
  deleteColumn(), // 2×2 → 1 column, 2 rows
  selectCell(0, 0),
  insertRowBelow(), // → 1 column, 3 rows

  columnSizeFixed(0, "120px"),
  rowSizeFixed(0, "74px"),
  rowSizeFixed(1, "74px"),
  rowSizeFixed(2, "74px"),
  gapY("18px"),

  // Double border on every edge; with the row gap each box is fully double-bordered.
  tableBorders(["top", "right", "bottom", "left", "inner"], "double", 4),

  type(0, 0, "S s"),
  type(1, 0, "I i"),
  type(2, 0, "N n"),
];

export default recipe;
