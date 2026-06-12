import { BorderValueMap, EdgeKey, OuterEdges, InnerEdges, SelectedEdges } from "./types";

type Group = { key: string; edges: EdgeKey[] };

function tupleForEdge(v: { weight: number; style: string; radius: number }): string {
  return `${v.weight}|${v.style}|${v.radius}`;
}

/**
 * REVIEW: This wasn't a human decision: I (JH) am not clear
 * if it's better to try to be smart like this, or better to
 * always select everything? I think we'll only know after
 * working with it for a while.
 *
 * Compute initial selected edges by grouping edges whose values match exactly.
 * - Choose the largest group.
 * - Ties: prefer a group with any outer edge over inner-only.
 * - If still tied, prefer the group with more contiguous outer edges (crude heuristic).
 * - Else pick the first group deterministically by alphabetical edge order.
 */
export function computeInitialSelection(
  valueMap: BorderValueMap,
  showInner: boolean,
): SelectedEdges {
  const edges: EdgeKey[] = [...OuterEdges, ...(showInner ? InnerEdges : [])];

  const groupsByKey = new Map<string, Group>();
  for (const e of edges) {
    const v = valueMap[e];
    const key = tupleForEdge(v);
    const g = groupsByKey.get(key) ?? { key, edges: [] };
    g.edges.push(e);
    groupsByKey.set(key, g);
  }

  const groups = Array.from(groupsByKey.values());
  // sort by rules
  groups.sort((a, b) => {
    // 1) size desc
    if (b.edges.length !== a.edges.length) return b.edges.length - a.edges.length;
    // 2) presence of any outer edge desc
    const aHasOuter = a.edges.some((e) => OuterEdges.includes(e));
    const bHasOuter = b.edges.some((e) => OuterEdges.includes(e));
    if (aHasOuter !== bHasOuter) return aHasOuter ? -1 : 1;
    // 3) crude contiguity score for outer edges
    const contiguity = (edgesList: EdgeKey[]) => {
      const order: EdgeKey[] = ["top", "right", "bottom", "left"]; // circular
      const set = new Set(edgesList.filter((e) => OuterEdges.includes(e)));
      let score = 0;
      for (let i = 0; i < order.length; i++) {
        const a = order[i];
        const b = order[(i + 1) % order.length];
        if (set.has(a) && set.has(b)) score++;
      }
      return score;
    };
    const aScore = contiguity(a.edges);
    const bScore = contiguity(b.edges);
    if (bScore !== aScore) return bScore - aScore;
    // 4) deterministic by edge names
    return a.edges.join(",").localeCompare(b.edges.join(","));
  });

  const chosen = groups[0]?.edges ?? [];
  return new Set(chosen);
}
