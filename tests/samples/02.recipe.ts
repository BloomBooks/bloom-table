// UI build recipe for sample 02 — three text columns separated by two interior vertical
// rules (no frame, no horizontal lines); columns 1 & 2 left-aligned, column 3 centered.
// Built from the blank 2×2 using only toolbar actions. See ui/DSL.md.
import {
  selectCell,
  insertColumnRight,
  insertRowBelow,
  clearBorders,
  cellBorders,
  align,
  type,
  type Command,
} from "./ui/dsl";

const recipe: Command[] = [
  // Grow the blank 2×2 to 3 columns × 4 rows (new tracks default to "hug").
  selectCell(0, 0),
  insertColumnRight(),
  selectCell(0, 0),
  insertRowBelow(),
  selectCell(0, 0),
  insertRowBelow(),

  // Strip the default (all-solid) borders, then draw only the two interior verticals as the
  // right border of every cell in columns 0 and 1.
  clearBorders(),
  cellBorders(0, 0, ["right"], "solid", 1),
  cellBorders(1, 0, ["right"], "solid", 1),
  cellBorders(2, 0, ["right"], "solid", 1),
  cellBorders(3, 0, ["right"], "solid", 1),
  cellBorders(0, 1, ["right"], "solid", 1),
  cellBorders(1, 1, ["right"], "solid", 1),
  cellBorders(2, 1, ["right"], "solid", 1),
  cellBorders(3, 1, ["right"], "solid", 1),

  // Left-align columns 0 and 1 (column 2 keeps the default centering).
  align(0, 0, "start"),
  align(1, 0, "start"),
  align(2, 0, "start"),
  align(3, 0, "start"),
  align(0, 1, "start"),
  align(1, 1, "start"),
  align(2, 1, "start"),
  align(3, 1, "start"),

  // Text.
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
];

export default recipe;
