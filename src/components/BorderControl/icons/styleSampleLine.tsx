import { BorderStyle } from "../logic/types";

export function StyleSampleLine({
  value,
  color = "#fff",
  fullWidth,
}: {
  value: BorderStyle | "mixed";
  color?: string;
  fullWidth?: boolean;
}) {
  if (value === "mixed") return <span style={{ fontSize: 11 }}>Mixed</span>;
  if (value === "none") {
    // Use the same visual language as WeightIcon's "none" (Ø)
    const content = <span style={{ fontSize: 13, fontWeight: 600, color }}>Ø</span>;
    return fullWidth ? (
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>{content}</div>
    ) : (
      content
    );
  }
  const svgWidth = fullWidth ? "100%" : 32;
  const viewBoxWidth = fullWidth ? 100 : 32;
  const xStart = fullWidth ? 0 : 4;
  const xEnd = fullWidth ? viewBoxWidth : 28;
  const dashMap: Record<Exclude<BorderStyle, "none">, string | undefined> = {
    solid: undefined,
    dashed: "6 4",
    dotted: "1 3",
    double: undefined,
  } as const;
  if (value === "double") {
    return (
      <svg width={svgWidth} height={18} viewBox={`0 0 ${viewBoxWidth} 18`} aria-hidden>
        <line x1={xStart} y1={7} x2={xEnd} y2={7} stroke={color} strokeWidth={1} />
        <line x1={xStart} y1={11} x2={xEnd} y2={11} stroke={color} strokeWidth={1} />
      </svg>
    );
  }
  return (
    <svg width={svgWidth} height={18} viewBox={`0 0 ${viewBoxWidth} 18`} aria-hidden>
      <line
        x1={xStart}
        y1={9}
        x2={xEnd}
        y2={9}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashMap[value]}
      />
    </svg>
  );
}
