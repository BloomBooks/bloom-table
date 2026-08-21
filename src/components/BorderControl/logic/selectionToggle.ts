import { EdgeKey, InnerEdges, SelectedEdges } from "./types";

/**
 * Toggle one edge (or the inner pair) in the selector's selection.
 *
 * The inner plus is a single control standing for both inner axes, so it turns
 * them on or off together: if either axis is selected the click clears both,
 * otherwise it selects both. Flipping each axis independently would turn a
 * split selection — innerH selected but not innerV, which
 * computeInitialSelection can produce — into the *other* axis, so a click meant
 * to deselect the inner borders would silently move the edit to innerV.
 */
export function toggleSelectedEdge(selected: SelectedEdges, e: EdgeKey | "inner"): SelectedEdges {
  const next = new Set(selected);
  if (e === "inner") {
    const anySelected = InnerEdges.some((ie) => next.has(ie));
    for (const ie of InnerEdges) {
      if (anySelected) next.delete(ie);
      else next.add(ie);
    }
  } else {
    if (next.has(e)) next.delete(e);
    else next.add(e);
  }
  return next;
}
