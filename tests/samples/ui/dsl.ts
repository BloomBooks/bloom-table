// The recipe DSL: command *constructors* so a recipe reads like user actions
//   [ selectCell(0,1), insertColumnRight(), cellBorders(0,0,["right"],"solid",1), ... ]
// Each returns a plain command object; the interpreter (interpreter.ts) dispatches on `op`.
// See DSL.md for the full reference.

export type BorderStyle = "none" | "solid" | "dashed" | "dotted" | "double";
export type BorderWeight = 0 | 1 | 2 | 4;
export type Align = "start" | "center" | "end";
export type OuterSide = "top" | "right" | "bottom" | "left";
/** "inner" selects both inner edges together (the table control couples innerH+innerV). */
export type TableEdge = OuterSide | "inner";
export type SizeMode = "hug" | "grow";
export type ContentType = "text" | "image" | "table";

export type Command =
  // selection / nesting
  | { op: "selectCell"; r: number; c: number }
  | { op: "enter"; r: number; c: number } // descend into the nested table in cell (r,c)
  | { op: "up" } // ascend to the parent table
  // structure
  | { op: "insertColumnLeft" }
  | { op: "insertColumnRight" }
  | { op: "insertRowAbove" }
  | { op: "insertRowBelow" }
  | { op: "deleteColumn" }
  | { op: "deleteRow" }
  // sizing
  | { op: "columnSize"; c: number; mode: SizeMode }
  | { op: "rowSize"; r: number; mode: SizeMode }
  | { op: "columnSizeFixed"; c: number; value: string }
  | { op: "rowSizeFixed"; r: number; value: string }
  // borders
  | { op: "clearBorders" } // set the whole table's borders to none
  | { op: "tableBorders"; edges: TableEdge[]; style: BorderStyle; weight: BorderWeight }
  | { op: "cellBorders"; r: number; c: number; sides: OuterSide[]; style: BorderStyle; weight: BorderWeight }
  // corners / gaps / padding / alignment
  | { op: "tableCorners"; radius: number }
  | { op: "cellCorners"; r: number; c: number; radius: number }
  | { op: "gapX"; value: string }
  | { op: "gapY"; value: string }
  | { op: "pad"; r: number; c: number; value: string }
  | { op: "align"; r: number; c: number; align: Align }
  // content
  | { op: "contentType"; r: number; c: number; type: ContentType }
  | { op: "merge"; r: number; c: number }
  | { op: "split"; r: number; c: number }
  | { op: "type"; r: number; c: number; text: string }
  | { op: "image"; r: number; c: number; src: string };

export const selectCell = (r: number, c: number): Command => ({ op: "selectCell", r, c });
export const enter = (r: number, c: number): Command => ({ op: "enter", r, c });
export const up = (): Command => ({ op: "up" });

export const insertColumnLeft = (): Command => ({ op: "insertColumnLeft" });
export const insertColumnRight = (): Command => ({ op: "insertColumnRight" });
export const insertRowAbove = (): Command => ({ op: "insertRowAbove" });
export const insertRowBelow = (): Command => ({ op: "insertRowBelow" });
export const deleteColumn = (): Command => ({ op: "deleteColumn" });
export const deleteRow = (): Command => ({ op: "deleteRow" });

export const columnSize = (c: number, mode: SizeMode): Command => ({ op: "columnSize", c, mode });
export const rowSize = (r: number, mode: SizeMode): Command => ({ op: "rowSize", r, mode });
export const columnSizeFixed = (c: number, value: string): Command => ({ op: "columnSizeFixed", c, value });
export const rowSizeFixed = (r: number, value: string): Command => ({ op: "rowSizeFixed", r, value });

export const clearBorders = (): Command => ({ op: "clearBorders" });
export const tableBorders = (edges: TableEdge[], style: BorderStyle, weight: BorderWeight): Command => ({ op: "tableBorders", edges, style, weight });
export const cellBorders = (r: number, c: number, sides: OuterSide[], style: BorderStyle, weight: BorderWeight): Command => ({ op: "cellBorders", r, c, sides, style, weight });

export const tableCorners = (radius: number): Command => ({ op: "tableCorners", radius });
export const cellCorners = (r: number, c: number, radius: number): Command => ({ op: "cellCorners", r, c, radius });
export const gapX = (value: string): Command => ({ op: "gapX", value });
export const gapY = (value: string): Command => ({ op: "gapY", value });
export const pad = (r: number, c: number, value: string): Command => ({ op: "pad", r, c, value });
export const align = (r: number, c: number, align: Align): Command => ({ op: "align", r, c, align });

export const contentType = (r: number, c: number, type: ContentType): Command => ({ op: "contentType", r, c, type });
export const merge = (r: number, c: number): Command => ({ op: "merge", r, c });
export const split = (r: number, c: number): Command => ({ op: "split", r, c });
export const type = (r: number, c: number, text: string): Command => ({ op: "type", r, c, text });
export const image = (r: number, c: number, src: string): Command => ({ op: "image", r, c, src });
