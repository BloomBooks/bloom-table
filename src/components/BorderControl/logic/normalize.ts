import type { BorderStyle } from "./types";

/**
 * Apply a weight/style change to one edge, keeping the two consistent.
 *
 * The rules (shared by every edit path, so the toolbar and the Borders panel
 * cannot disagree):
 *  - setting style "none" zeroes the weight;
 *  - setting a real style on an invisible (weight 0) edge makes it 1px;
 *  - setting weight 0 turns the style off;
 *  - setting a real weight on a style-less edge makes it solid.
 * A change that names both weight and style is taken as given, except that the
 * style rules still win (that is what the toolbar has always done).
 */
export function normalizeEdgeChange(
  current: { weight: number; style: BorderStyle },
  change: { weight?: number; style?: BorderStyle },
): { weight: number; style: BorderStyle } {
  let weight = change.weight ?? current.weight;
  let style = change.style ?? current.style;
  if (change.style !== undefined) {
    if (change.style === "none") weight = 0;
    else if (weight === 0) weight = 1;
  } else if (change.weight !== undefined) {
    if (change.weight === 0) style = "none";
    else if (style === "none") style = "solid";
  }
  return { weight, style };
}
