// Human-readable descriptions of what an operation acted on, for the `detail`
// of a history entry (see HistoryEntry.detail in history.ts).
//
// Rows and columns are numbered from 1 here, because a detail is read by a
// person looking at a table, not by code. Everywhere else in the library they
// are numbered from 0.
//
// This module imports only the grid model, so any command module can use it.

import { buildGrid } from "./grid";
import type { FormattingScope } from "./formatting-commands";

export const kWholeTableTarget = "whole table";

const cellCount = (n: number): string => `${n} cell${n === 1 ? "" : "s"}`;

/** Describes the cells a formatting command wrote to: the cell's position for
 *  a single cell, the row or column number and how many cells it holds, or the
 *  whole table with its cell count. */
export function describeTarget(
  table: HTMLElement,
  scope: FormattingScope,
  cells: HTMLElement[],
): string {
  if (scope === "table") return `${kWholeTableTarget} (${cellCount(cells.length)})`;
  if (cells.length === 0) return "no cells";

  const grid = buildGrid(table);
  const positions = cells
    .map((c) => grid.posOf.get(c))
    .filter((p): p is { row: number; column: number } => !!p);
  if (positions.length === 0) return cellCount(cells.length);

  if (scope === "cell") {
    const p = positions[0];
    return `cell at row ${p.row + 1}, column ${p.column + 1}`;
  }

  // Every cell in the list covers the row (or column) the command was given,
  // so a cell that does not span starts exactly there and a cell that spans
  // starts at or before it. The largest start is therefore the line asked for.
  const line =
    scope === "row"
      ? Math.max(...positions.map((p) => p.row))
      : Math.max(...positions.map((p) => p.column));
  return `${scope} ${line + 1} (${cellCount(cells.length)})`;
}

/** The 1-based position of a cell in its table, or null when the cell is not
 *  one of the table's own cells. */
export function describeCellPosition(table: HTMLElement, cell: HTMLElement): string | null {
  const pos = buildGrid(table).posOf.get(cell);
  if (!pos) return null;
  return `cell at row ${pos.row + 1}, column ${pos.column + 1}`;
}
