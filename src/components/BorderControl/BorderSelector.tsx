import { InnerEdges, BorderValueMap, EdgeKey, SelectedEdges } from "./logic/types";
import type { SelectorLook } from "./logic/types";
import { kBloomBlue } from "../../constants";

export function BorderSelector(props: {
  valueMap: BorderValueMap;
  showInner?: boolean;
  selected: SelectedEdges;
  onChange: (sel: SelectedEdges) => void;
  size?: number;
  look?: SelectorLook;
}) {
  const { showInner = true, selected, onChange } = props;
  const size = props.size ?? 112;
  const stroke = kBloomBlue;
  const look: SelectorLook = props.look ?? "flat";

  const isSel = (e: EdgeKey) => selected.has(e);
  const toggle = (e: EdgeKey | "inner") => {
    const next = new Set(selected);
    if (e === "inner") {
      for (const ie of InnerEdges) {
        if (next.has(ie)) next.delete(ie);
        else next.add(ie);
      }
    } else {
      if (next.has(e)) next.delete(e);
      else next.add(e);
    }
    onChange(next);
  };

  const w = size;
  const h = size;
  const pad = 10;
  const outerRect = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };

  // Geometry constants
  const BAR_THICKNESS = 10; // single thickness for both outer segments and inner plus
  const GAP = 2; // space between horizontal and vertical pieces

  // Outer bars with 2px gap between horizontals and verticals
  const leftRect = {
    x: outerRect.x,
    y: outerRect.y,
    w: BAR_THICKNESS,
    h: outerRect.h,
  };
  const rightRect = {
    x: outerRect.x + outerRect.w - BAR_THICKNESS,
    y: outerRect.y,
    w: BAR_THICKNESS,
    h: outerRect.h,
  };
  const topRect = {
    x: outerRect.x + BAR_THICKNESS + GAP,
    y: outerRect.y,
    w: outerRect.w - 2 * (BAR_THICKNESS + GAP),
    h: BAR_THICKNESS,
  };
  const bottomRect = {
    x: topRect.x,
    y: outerRect.y + outerRect.h - BAR_THICKNESS,
    w: topRect.w,
    h: BAR_THICKNESS,
  };

  // Inner bars sized to leave 2px margin from inner bounds
  const innerBounds = {
    x: outerRect.x + BAR_THICKNESS,
    y: outerRect.y + BAR_THICKNESS,
    w: outerRect.w - 2 * BAR_THICKNESS,
    h: outerRect.h - 2 * BAR_THICKNESS,
  };
  const INNER_GAP = 2;
  const innerHRect = {
    x: innerBounds.x + INNER_GAP,
    y: innerBounds.y + innerBounds.h / 2 - BAR_THICKNESS / 2,
    w: innerBounds.w - 2 * INNER_GAP,
    h: BAR_THICKNESS,
  };
  const innerVRect = {
    x: innerBounds.x + innerBounds.w / 2 - BAR_THICKNESS / 2,
    y: innerBounds.y + INNER_GAP,
    w: BAR_THICKNESS,
    h: innerBounds.h - 2 * INNER_GAP,
  };

  const segOpacity = (edge: EdgeKey) => (isSel(edge) ? 1 : 0.6);
  const ACTIVE = stroke;
  const INACTIVE = "#9bbcc0";
  const fillFor = (edge: EdgeKey) => (isSel(edge) ? ACTIVE : INACTIVE);

  const useGradients = look === "gradients" || look === "card";
  const useBevel = look === "bevel" || look === "card";
  const useRounded = look === "rounded" || look === "card";

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-label="Border selector"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" }}
    >
      <defs>
        <linearGradient id="gradTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b8993" />
          <stop offset="100%" stopColor="#1d4d53" />
        </linearGradient>
        <linearGradient id="gradBottom" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3b8993" />
          <stop offset="100%" stopColor="#1d4d53" />
        </linearGradient>
        <linearGradient id="gradLeft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b8993" />
          <stop offset="100%" stopColor="#1d4d53" />
        </linearGradient>
        <linearGradient id="gradRight" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#3b8993" />
          <stop offset="100%" stopColor="#1d4d53" />
        </linearGradient>
        <linearGradient id="gradInnerH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b8993" />
          <stop offset="100%" stopColor="#1d4d53" />
        </linearGradient>
        <linearGradient id="gradInnerV" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b8993" />
          <stop offset="100%" stopColor="#1d4d53" />
        </linearGradient>
        <filter id="insetShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feOffset dx="0" dy="1" />
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.25 0"
          />
        </filter>
      </defs>

      {look === "card" && (
        <rect
          x={outerRect.x - 6}
          y={outerRect.y - 6}
          width={outerRect.w + 12}
          height={outerRect.h + 12}
          rx={8}
          fill="#f6fbfc"
          stroke="#d3e3e6"
          filter="url(#insetShadow)"
        />
      )}

      {/* Left */}
      <rect
        x={leftRect.x}
        y={leftRect.y}
        width={leftRect.w}
        height={leftRect.h}
        ry={useRounded ? 3 : 0}
        fill={useGradients ? "url(#gradLeft)" : fillFor("left")}
        opacity={segOpacity("left")}
        onClick={() => toggle("left")}
        style={{ cursor: "pointer" }}
      >
        <title>Toggle left border</title>
      </rect>
      {useBevel && (
        <>
          <rect x={leftRect.x} y={leftRect.y} width={1} height={leftRect.h} fill="#ffffff66" />
          <rect
            x={leftRect.x + leftRect.w - 1}
            y={leftRect.y}
            width={1}
            height={leftRect.h}
            fill="#00000033"
          />
        </>
      )}

      {/* Top (shortened with 2px gap from sides) */}
      <rect
        x={topRect.x}
        y={topRect.y}
        width={topRect.w}
        height={topRect.h}
        rx={useRounded ? 3 : 0}
        fill={useGradients ? "url(#gradTop)" : fillFor("top")}
        opacity={segOpacity("top")}
        onClick={() => toggle("top")}
        style={{ cursor: "pointer" }}
      >
        <title>Toggle top border</title>
      </rect>
      {useBevel && (
        <>
          <rect x={topRect.x} y={topRect.y} width={topRect.w} height={1} fill="#ffffff66" />
          <rect
            x={topRect.x}
            y={topRect.y + topRect.h - 1}
            width={topRect.w}
            height={1}
            fill="#00000033"
          />
        </>
      )}

      {/* Right */}
      <rect
        x={rightRect.x}
        y={rightRect.y}
        width={rightRect.w}
        height={rightRect.h}
        ry={useRounded ? 3 : 0}
        fill={useGradients ? "url(#gradRight)" : fillFor("right")}
        opacity={segOpacity("right")}
        onClick={() => toggle("right")}
        style={{ cursor: "pointer" }}
      >
        <title>Toggle right border</title>
      </rect>
      {useBevel && (
        <>
          <rect x={rightRect.x} y={rightRect.y} width={1} height={rightRect.h} fill="#ffffff66" />
          <rect
            x={rightRect.x + rightRect.w - 1}
            y={rightRect.y}
            width={1}
            height={rightRect.h}
            fill="#00000033"
          />
        </>
      )}

      {/* Bottom (shortened with 2px gap from sides) */}
      <rect
        x={bottomRect.x}
        y={bottomRect.y}
        width={bottomRect.w}
        height={bottomRect.h}
        rx={useRounded ? 3 : 0}
        fill={useGradients ? "url(#gradBottom)" : fillFor("bottom")}
        opacity={segOpacity("bottom")}
        onClick={() => toggle("bottom")}
        style={{ cursor: "pointer" }}
      />
      {useBevel && (
        <>
          <rect
            x={bottomRect.x}
            y={bottomRect.y}
            width={bottomRect.w}
            height={1}
            fill="#ffffff66"
          />
          <rect
            x={bottomRect.x}
            y={bottomRect.y + bottomRect.h - 1}
            width={bottomRect.w}
            height={1}
            fill="#00000033"
          />
        </>
      )}

      {/* Inner plus (enlarged with 2px margin inside inner bounds) */}
      {showInner && (
        <g
          opacity={selected.has("innerH") || selected.has("innerV") ? 1 : 0.5}
          onClick={() => toggle("inner")}
          style={{ cursor: "pointer" }}
        >
          <title>Toggle inner borders</title>
          {/* horizontal bar */}
          <rect
            x={innerHRect.x}
            y={innerHRect.y}
            width={innerHRect.w}
            height={innerHRect.h}
            rx={useRounded ? 3 : 0}
            fill={useGradients ? "url(#gradInnerH)" : fillFor("innerH")}
          />
          {useBevel && (
            <>
              <rect
                x={innerHRect.x}
                y={innerHRect.y}
                width={innerHRect.w}
                height={1}
                fill="#ffffff66"
              />
              <rect
                x={innerHRect.x}
                y={innerHRect.y + innerHRect.h - 1}
                width={innerHRect.w}
                height={1}
                fill="#00000033"
              />
            </>
          )}
          {/* vertical bar */}
          <rect
            x={innerVRect.x}
            y={innerVRect.y}
            width={innerVRect.w}
            height={innerVRect.h}
            ry={useRounded ? 3 : 0}
            fill={useGradients ? "url(#gradInnerV)" : fillFor("innerV")}
          />
          {useBevel && (
            <>
              <rect
                x={innerVRect.x}
                y={innerVRect.y}
                width={1}
                height={innerVRect.h}
                fill="#ffffff66"
              />
              <rect
                x={innerVRect.x + innerVRect.w - 1}
                y={innerVRect.y}
                width={1}
                height={innerVRect.h}
                fill="#00000033"
              />
            </>
          )}
        </g>
      )}
    </svg>
  );
}

export default BorderSelector;
