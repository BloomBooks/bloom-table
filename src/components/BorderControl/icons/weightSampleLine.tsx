import { BorderStyle, BorderWeight } from "../logic/types";

export function WeightSampleLine({
  value,
  style,
  color = "#fff",
  fullWidth,
}: {
  value: BorderWeight | "mixed";
  style?: BorderStyle | "mixed";
  color?: string;
  fullWidth?: boolean;
}) {
  if (value === "mixed") return <span style={{ fontSize: 11 }}>Mixed</span>;
  if (value === 0) {
    const content = <span style={{ fontSize: 13, fontWeight: 600, color }}>Ø</span>;
    return fullWidth ? (
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>{content}</div>
    ) : (
      content
    );
  }
  const strokeWidth = value;
  const visible = value > 0;
  const stroke = color;
  const svgWidth = fullWidth ? "100%" : 32;
  const viewBoxWidth = fullWidth ? 100 : 32;
  const xStart = fullWidth ? 0 : 4;
  const xEnd = fullWidth ? viewBoxWidth : 28;

  return (
    <svg width={svgWidth} height={18} viewBox={`0 0 ${viewBoxWidth} 18`} aria-hidden>
      {visible ? (
        style === "double" ? (
          <>
            <line
              x1={xStart}
              y1="7"
              x2={xEnd}
              y2="7"
              stroke={stroke}
              strokeWidth={Math.max(1, strokeWidth - 1)}
            />
            <line
              x1={xStart}
              y1="11"
              x2={xEnd}
              y2="11"
              stroke={stroke}
              strokeWidth={Math.max(1, strokeWidth - 1)}
            />
          </>
        ) : (
          <line x1={xStart} y1="9" x2={xEnd} y2="9" stroke={stroke} strokeWidth={strokeWidth} />
        )
      ) : (
        <rect x={xStart} y="8" width={xEnd - xStart} height="2" fill="transparent" />
      )}
    </svg>
  );
}
