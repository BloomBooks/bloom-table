// UI build recipe for sample 01 — a 2×2 border-only layout: top-left cell fully boxed,
// top-right boxed (no left), bottom-left boxed (no top), bottom-right open. Fixed column/row
// sizes. Built from the blank 2×2. See ui/DSL.md.
import {
  selectCell,
  columnSizeFixed,
  rowSizeFixed,
  clearBorders,
  cellBorders,
  type Command,
} from "./ui/dsl";

const recipe: Command[] = [
  selectCell(0, 0),
  // Fixed sizes (blank table is already 2×2).
  columnSizeFixed(0, "300px"),
  columnSizeFixed(1, "320px"),
  rowSizeFixed(0, "26px"),
  rowSizeFixed(1, "26px"),

  // Strip default borders, then box the cells per the design.
  clearBorders(),
  cellBorders(0, 0, ["top", "right", "bottom", "left"], "solid", 1),
  cellBorders(0, 1, ["top", "right", "bottom"], "solid", 1),
  cellBorders(1, 0, ["right", "bottom", "left"], "solid", 1),
  // (1,1) stays open.
];

export default recipe;
