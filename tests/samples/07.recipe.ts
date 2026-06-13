// UI build recipe for sample 07 — alphabet primer: 3×2 outer grid (gaps, no border); each
// cell is a "group" of [rounded-bordered letter box | picture]. The box is a nested 1×1 table
// with table corners + full border; the picture is an image cell. (outer → group → box.)
import {
  selectCell,
  insertColumnRight,
  deleteRow,
  deleteColumn,
  columnSizeFixed,
  rowSizeFixed,
  gapX,
  gapY,
  clearBorders,
  tableBorders,
  cellCorners,
  contentType,
  enter,
  up,
  type,
  type Command,
} from "./ui/dsl";

const BOX: ("top" | "right" | "bottom" | "left")[] = ["top", "right", "bottom", "left"];

// Build one [box | image] group at outer position (r, c).
function group(r: number, c: number, letter: string, word: string): Command[] {
  return [
    enter(r, c),
    selectCell(0, 0),
    deleteRow(), // group: 2×2 → 1 row, 2 cols
    clearBorders(),
    gapX("10px"),
    columnSizeFixed(0, "92px"),
    columnSizeFixed(1, "72px"),
    rowSizeFixed(0, "62px"),
    contentType(0, 0, "table"), // box
    contentType(0, 1, "image"), // picture

    enter(0, 0), // box: 2×2 → 1×1
    selectCell(0, 0),
    deleteRow(),
    selectCell(0, 0),
    deleteColumn(),
    columnSizeFixed(0, "92px"),
    rowSizeFixed(0, "62px"),
    tableBorders(BOX, "solid", 1),
    cellCorners(0, 0, 8),
    type(0, 0, `${letter}\n${word}`),
    up(), // back to group

    up(), // back to outer
  ];
}

const recipe: Command[] = [
  // Outer 3×2 grid (gaps, no border).
  selectCell(0, 0),
  insertColumnRight(), // 2×2 → 3 cols × 2 rows
  clearBorders(),
  gapX("34px"),
  gapY("22px"),
  contentType(0, 0, "table"),
  contentType(0, 1, "table"),
  contentType(0, 2, "table"),
  contentType(1, 0, "table"),
  contentType(1, 1, "table"),
  contentType(1, 2, "table"),

  ...group(0, 0, "A a", "Apple"),
  ...group(0, 1, "B b", "Boy"),
  ...group(0, 2, "C c", "Cat"),
  ...group(1, 0, "D d", "Dog"),
  ...group(1, 1, "E e", "Elephant"),
  ...group(1, 2, "F f", "Frog"),
];

export default recipe;
