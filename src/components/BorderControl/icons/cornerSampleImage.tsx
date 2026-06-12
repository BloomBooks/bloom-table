import { CornerRadius } from "../logic/types";

export function CornerSampleImage({
  value,
  color = "#fff",
}: {
  value: CornerRadius | "mixed";
  color?: string;
}) {
  if (value === "mixed") return <span style={{ fontSize: 11 }}>Mixed</span>;

  const size = 20; // requested 20px high and wide
  const borderWidth = 2;
  const r = Math.max(0, Math.min(value, size)); // clamp radius to box size

  return (
    <div aria-hidden style={{ width: size, height: size, display: "block", margin: "auto" }}>
      <div
        style={{
          width: size,
          height: size,
          borderLeft: `${borderWidth}px solid ${color}`,
          borderTop: `${borderWidth}px solid ${color}`,
          boxSizing: "border-box",
          // Per-corner radii: only top-left should be rounded; others 0
          borderTopLeftRadius: r,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
      />
    </div>
  );
}
