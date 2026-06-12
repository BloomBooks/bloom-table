import { BorderStyle, BorderValueMap, BorderWeight, CornerRadius, SelectedEdges } from "./types";

export type MixedOr<T> = T | "mixed";

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function computeMixedWeight(map: BorderValueMap, sel: SelectedEdges): MixedOr<BorderWeight> {
  const values = unique(Array.from(sel).map((e) => map[e]?.weight)).filter(
    (v) => v !== undefined,
  ) as BorderWeight[];
  if (values.length === 0) return "mixed";
  return values.length === 1 ? values[0] : "mixed";
}

export function computeMixedStyle(map: BorderValueMap, sel: SelectedEdges): MixedOr<BorderStyle> {
  const values = unique(Array.from(sel).map((e) => map[e]?.style)).filter(
    (v) => v !== undefined,
  ) as BorderStyle[];
  if (values.length === 0) return "mixed";
  return values.length === 1 ? values[0] : "mixed";
}

export function computeMixedRadius(map: BorderValueMap, sel: SelectedEdges): MixedOr<CornerRadius> {
  const values = unique(Array.from(sel).map((e) => map[e]?.radius)).filter(
    (v) => v !== undefined,
  ) as CornerRadius[];
  if (values.length === 0) return "mixed";
  return values.length === 1 ? values[0] : "mixed";
}

export function interdependencyDisabled(
  weight: MixedOr<BorderWeight>,
  style: MixedOr<BorderStyle>,
): { weightDisabled: boolean; styleDisabled: boolean } {
  // If mixed, do not disable solely based on mixed.
  if (weight === "mixed" || style === "mixed")
    return { weightDisabled: false, styleDisabled: false };

  const weightIsNone = weight === 0;
  const styleIsNone = style === "none";

  if (weightIsNone && !styleIsNone) {
    return { weightDisabled: false, styleDisabled: true };
  }
  if (!weightIsNone && styleIsNone) {
    return { weightDisabled: true, styleDisabled: false };
  }
  // both none -> keep Style enabled (weight can remain enabled too; spec doesn't require disabling)
  return { weightDisabled: false, styleDisabled: false };
}
