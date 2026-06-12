import React, { useEffect, useState } from "react";
import { BorderControl } from "./BorderControl/BorderControl";
import Section from "./Section";
import type { BorderValueMap, CornerRadius } from "./BorderControl/logic/types";
import CornerMenu from "./BorderControl/menus/CornerMenu";
// no table-model reads here; we derive current state via border-state/renderer
import { applyUniformInner, setDefaultBorder, applyOuterBorders } from "../edge-utils";
import { render } from "../table-renderer";
import { getTableOuterBorderValueMap } from "../border-state";
import { BloomTable } from "../";

type Props = {
  table?: HTMLElement;
};

// --- BorderControl wiring helpers (moved from TableMenu) ---
const parsePx = (s: string | null | undefined): number => {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const buildBorderMapFromTable = (g: HTMLElement): BorderValueMap => {
  const cs = getComputedStyle(g);
  const base = getTableOuterBorderValueMap(g);

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

const applyBorderMapToTable = (g: HTMLElement, map: BorderValueMap) => {
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

export const TableSection: React.FC<Props> = ({ table }) => {
  // Corner menu value state, derived from the table and updated on change
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

  const [cornerValue, setCornerValue] = useState<CornerRadius | "mixed">(getCornerValue(table));
  useEffect(() => {
    setCornerValue(getCornerValue(table));
  }, [table]);

  return (
    <Section label="Table">
      {table && (
        <>
          {(() => {
            const valueMap = buildBorderMapFromTable(table);
            const cornerDisabled = valueMap.top.weight === 0 || valueMap.top.style === "none";
            return (
              <>
                <div className={menuItemStyle} style={{ cursor: "default" }}>
                  <BorderControl
                    valueMap={valueMap}
                    showInner
                    onChange={(next) => applyBorderMapToTable(table, next)}
                  />
                </div>
                <div className={menuItemStyle} style={{ cursor: "default" }}>
                  <CornerMenu
                    value={cornerValue}
                    onChange={(v) => {
                      if (!table) return;
                      const ctrl = new BloomTable(table);
                      ctrl.setTableCorners(v as number);
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
export { buildBorderMapFromTable, applyBorderMapToTable };
