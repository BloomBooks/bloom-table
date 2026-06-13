// UI build recipe for sample 06 — two independent bordered grids side by side, as ONE table:
// an outer 1×2 (no border, gap between) whose two cells each hold a nested grid (4×3 and 2×3).
import {
  selectCell,
  deleteRow,
  insertColumnRight,
  insertRowBelow,
  columnSizeFixed,
  rowSizeFixed,
  gapX,
  clearBorders,
  tableBorders,
  contentType,
  enter,
  up,
  type,
  type Command,
} from "./ui/dsl";

const ALL: ("top" | "right" | "bottom" | "left" | "inner")[] = [
  "top",
  "right",
  "bottom",
  "left",
  "inner",
];

const recipe: Command[] = [
  // Outer table: blank 2×2 → 1 row × 2 columns; configure it while the cells are still text.
  selectCell(0, 0),
  deleteRow(),
  clearBorders(),
  gapX("56px"),

  // Turn both outer cells into nested tables.
  contentType(0, 0, "table"),
  contentType(0, 1, "table"),

  // Grid A (4×3, all borders), inside the left cell.
  enter(0, 0),
  selectCell(0, 0),
  insertColumnRight(),
  selectCell(0, 0),
  insertColumnRight(),
  selectCell(0, 0),
  insertRowBelow(),
  columnSizeFixed(0, "44px"),
  columnSizeFixed(1, "44px"),
  columnSizeFixed(2, "44px"),
  columnSizeFixed(3, "44px"),
  rowSizeFixed(0, "44px"),
  rowSizeFixed(1, "44px"),
  rowSizeFixed(2, "44px"),
  tableBorders(ALL, "solid", 1),
  type(0, 0, "a"),
  type(0, 1, "d"),
  type(0, 2, "y"),
  type(0, 3, "a"),
  type(1, 0, "d"),
  type(1, 1, "y"),
  type(1, 2, "a"),
  type(1, 3, "d"),
  type(2, 0, "y"),
  type(2, 1, "a"),
  type(2, 2, "d"),
  type(2, 3, "y"),
  up(),

  // Grid B (2×3, all borders), inside the right cell.
  enter(0, 1),
  selectCell(0, 0),
  insertRowBelow(),
  columnSizeFixed(0, "44px"),
  columnSizeFixed(1, "44px"),
  rowSizeFixed(0, "44px"),
  rowSizeFixed(1, "44px"),
  rowSizeFixed(2, "44px"),
  tableBorders(ALL, "solid", 1),
  type(0, 0, "a"),
  type(0, 1, "ya"),
  type(1, 0, "ya"),
  type(1, 1, "da"),
  type(2, 0, "da"),
  type(2, 1, "a"),
  up(),
];

export default recipe;
