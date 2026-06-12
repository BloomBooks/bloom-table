import React, { useEffect, useState } from "react";
import { BorderControl } from "./BorderControl/BorderControl";
import Section from "./Section";
import type { BorderValueMap, CornerRadius } from "./BorderControl/logic/types";
import CornerMenu from "./BorderControl/menus/CornerMenu";
// no grid-model reads here; we derive current state via border-state/renderer
import { applyUniformInner, setDefaultBorder, applyOuterBorders } from "../edge-utils";
import { render } from "../grid-renderer";
import { getGridOuterBorderValueMap } from "../border-state";
import { BloomGrid } from "../";

type Props = {
  grid?: HTMLElement;
};

// --- BorderControl wiring helpers (moved from GridMenu) ---
const parsePx = (s: string | null | undefined): number => {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const buildBorderMapFromGrid = (g: HTMLElement): BorderValueMap => {
  const cs = getComputedStyle(g);
  const base = getGridOuterBorderValueMap(g);

  // Preserve corner radius reading from computed style (render owns setting)
  const radiusPx = parsePx(cs.borderTopLeftRadius);
  const radius: CornerRadius = ([0, 2, 4, 8] as number[]).includes(radiusPx)
    ? (radiusPx as CornerRadius)
    : 0;

  return {
    top: { ...base.top, radius },
    right: { ...base.right, radius },
    bottom: { ...base.bottom, radius },
    left: { ...base.left, radius },
    innerH: base.innerH,
    innerV: base.innerV,
  };
};

const applyBorderMapToGrid = (g: HTMLElement, map: BorderValueMap) => {
  const cs = getComputedStyle(g);
  const outerColor = (cs.color || "black").trim();
  const innerColor = (cs.color || "#444").trim();

  // Write outer edges individually for each side based on the UI map
  applyOuterBorders(
    g,
    {
      top: { weight: map.top.weight, style: map.top.style, color: outerColor },
      right: {
        weight: map.right.weight,
        style: map.right.style,
        color: outerColor,
      },
      bottom: {
        weight: map.bottom.weight,
        style: map.bottom.style,
        color: outerColor,
      },
      left: {
        weight: map.left.weight,
        style: map.left.style,
        color: outerColor,
      },
    },
    outerColor,
  );
  // Inner edges: write uniform inner H and V
  applyUniformInner(
    g,
    "innerH",
    {
      weight: map.innerH.weight,
      style: map.innerH.style,
      color: innerColor,
    } as any,
    innerColor,
  );
  applyUniformInner(
    g,
    "innerV",
    {
      weight: map.innerV.weight,
      style: map.innerV.style,
      color: innerColor,
    } as any,
    innerColor,
  );

  // Default border as a safety for unspecified edges
  setDefaultBorder(
    g,
    {
      weight: map.innerH.weight,
      style: map.innerH.style,
      color: innerColor,
    } as any,
    innerColor,
  );

  // Re-render so the per-cell inline styles reflect the updated model
  render(g);
};

const menuItemStyle = "flex items-center gap-2 px-4 py-1 cursor-pointer w-full text-left";

export const TableSection: React.FC<Props> = ({ grid }) => {
  // Corner menu value state, derived from the grid and updated on change
  const getCornerValue = (g: HTMLElement | undefined | null): CornerRadius | "mixed" => {
    if (!g) return 0;
    const cs = getComputedStyle(g);
    const radii = [
      parsePx(cs.borderTopLeftRadius),
      parsePx(cs.borderTopRightRadius),
      parsePx(cs.borderBottomRightRadius),
      parsePx(cs.borderBottomLeftRadius),
    ].map((n) => Math.round(n));
    const uniq = Array.from(new Set(radii));
    if (uniq.length !== 1) return "mixed";
    const r = uniq[0];
    return ([0, 2, 4, 8] as number[]).includes(r) ? (r as CornerRadius) : ("mixed" as const);
  };

  const [cornerValue, setCornerValue] = useState<CornerRadius | "mixed">(getCornerValue(grid));
  useEffect(() => {
    setCornerValue(getCornerValue(grid));
  }, [grid]);

  return (
    <Section label="Table">
      {grid && (
        <>
          {(() => {
            const valueMap = buildBorderMapFromGrid(grid);
            const cornerDisabled = valueMap.top.weight === 0 || valueMap.top.style === "none";
            return (
              <>
                <div className={menuItemStyle} style={{ cursor: "default" }}>
                  <BorderControl
                    valueMap={valueMap}
                    showInner
                    onChange={(next) => applyBorderMapToGrid(grid, next)}
                  />
                </div>
                <div className={menuItemStyle} style={{ cursor: "default" }}>
                  <CornerMenu
                    value={cornerValue}
                    onChange={(v) => {
                      if (!grid) return;
                      const ctrl = new BloomGrid(grid);
                      ctrl.setGridCorners(v as number);
                      setCornerValue(v);
                    }}
                    disabled={cornerDisabled}
                  />
                </div>
              </>
            );
          })()}
        </>
      )}
    </Section>
  );
};

export default TableSection;

// Export for testing
export { buildBorderMapFromGrid, applyBorderMapToGrid };
