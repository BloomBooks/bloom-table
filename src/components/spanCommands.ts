/**
 * The span a cell should get when the Split button is pressed.
 *
 * Split undoes a merge in whichever direction the cell is actually merged.
 * Reducing x only left the button a silent no-op on a cell merged vertically
 * (x already 1, y > 1) — a state the model, the renderer, and the public
 * setSpan API all support even though the Merge button only ever grows x.
 * Returns null when there is nothing to split (a 1x1 cell).
 */
export function nextSplitSpan(x: number, y: number): { x: number; y: number } | null {
  const sx = Math.max(1, x || 1);
  const sy = Math.max(1, y || 1);
  if (sx > 1) return { x: sx - 1, y: sy };
  if (sy > 1) return { x: sx, y: sy - 1 };
  return null;
}
