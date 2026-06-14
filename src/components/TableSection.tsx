import React, { useEffect, useState } from "react";
import { BorderControl } from "./BorderControl/BorderControl";
import Section from "./Section";
import type { BorderValueMap, CornerRadius } from "./BorderControl/logic/types";
import CornerMenu from "./BorderControl/menus/CornerMenu";
// no table-model reads here; we derive current state via border-state/renderer
import { TableApi, useTableApi } from "./TableApiContext";
import { useColorPicker } from "./ColorPickerContext";
import Slider from "./Slider";
import { clearPulse, pulseTableBorders } from "../pulse-highlight";
import { representativeBorderColorHex } from "../color-utils";

type Props = {
  table?: HTMLElement;
};

// --- BorderControl wiring helpers (moved from TableMenu) ---
const parsePx = (s: string | null | undefined): number => {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const buildBorderMapFromTable = (api: TableApi, g: HTMLElement): BorderValueMap => {
  const cs = getComputedStyle(g);
  const base = api.getTableOuterBorderValueMap(g);

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

const applyBorderMapToTable = (
  api: TableApi,
  g: HTMLElement,
  map: BorderValueMap,
  color?: string,
) => {
  const cs = getComputedStyle(g);
  // Default to the table's current border color so weight/style edits preserve a
  // previously chosen color; fall back to the text color for brand-new tables.
  const firstCell = g.querySelector(".bloom-cell") as HTMLElement | null;
  const current = firstCell ? representativeBorderColorHex(firstCell) : (cs.color || "#000").trim();
  const outerColor = (color ?? current).trim();
  const innerColor = (color ?? current).trim();

  // Write outer edges individually for each side based on the UI map
  api.applyOuterBorders(
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
  api.applyUniformInner(
    g,
    "innerH",
    {
      weight: map.innerH.weight,
      style: map.innerH.style,
      color: innerColor,
    } as any,
    innerColor,
  );
  api.applyUniformInner(
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
  api.setDefaultBorder(
    g,
    {
      weight: map.innerH.weight,
      style: map.innerH.style,
      color: innerColor,
    } as any,
    innerColor,
  );

  // Re-render so the per-cell inline styles reflect the updated model
  api.render(g);
};

const menuItemStyle = "flex items-center gap-2 px-4 py-1 cursor-pointer w-full text-left";

// Direct-child cells of a table (DOM order). Avoids ":scope >" which the test DOM
// doesn't support reliably.
const tableCells = (g: HTMLElement): HTMLElement[] =>
  Array.from(g.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );

export const TableSection: React.FC<Props> = ({ table }) => {
  const api = useTableApi();
  const ColorPicker = useColorPicker();
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
    <Section
      label="Table"
      onMouseEnter={() => pulseTableBorders(table)}
      onMouseLeave={() => clearPulse(table)}
    >
      {table && (
        <>
          {(() => {
            const valueMap = buildBorderMapFromTable(api, table);
            const cornerDisabled = valueMap.top.weight === 0 || valueMap.top.style === "none";
            return (
              <>
                <div className={menuItemStyle} style={{ cursor: "default" }}>
                  <BorderControl
                    valueMap={valueMap}
                    showInner
                    onChange={(next) => applyBorderMapToTable(api, table, next)}
                  />
                </div>
                <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
                  <div className="text-sm opacity-80 mb-2">Border color</div>
                  {/* Suppress the border pulse while picking a color. */}
                  <div
                    onMouseEnter={() => clearPulse(table)}
                    onMouseLeave={() => pulseTableBorders(table)}
                  >
                    <ColorPicker
                      label="Table border color"
                      value={
                        (table.querySelector(".bloom-cell") as HTMLElement | null)
                          ? representativeBorderColorHex(
                              table.querySelector(".bloom-cell") as HTMLElement,
                            )
                          : "#000000"
                      }
                      onChange={(color) => {
                        if (!color) return; // border color can't be "none"; ignore Clear
                        applyBorderMapToTable(api, table, buildBorderMapFromTable(api, table), color);
                      }}
                    />
                  </div>
                </div>
                <div className={menuItemStyle} style={{ cursor: "default" }}>
                  <CornerMenu
                    value={cornerValue}
                    onChange={(v) => {
                      if (!table) return;
                      const ctrl = new api.BloomTable(table);
                      ctrl.setTableCorners(v as number);
                      setCornerValue(v);
                    }}
                    disabled={cornerDisabled}
                  />
                </div>
                <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
                  <div className="text-sm opacity-80 mb-2">Gap (X / Y)</div>
                  <div className="flex flex-col gap-2 ml-2">
                    <Slider
                      aria-label="Gap X"
                      label="X"
                      min={0}
                      max={40}
                      unit="px"
                      value={parsePx(api.getGapX(table)[0])}
                      onChange={(v) => {
                        api.setGapX(table, `${v}px`);
                        api.render(table);
                      }}
                    />
                    <Slider
                      aria-label="Gap Y"
                      label="Y"
                      min={0}
                      max={40}
                      unit="px"
                      value={parsePx(api.getGapY(table)[0])}
                      onChange={(v) => {
                        api.setGapY(table, `${v}px`);
                        api.render(table);
                      }}
                    />
                  </div>
                </div>
                <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
                  <div className="text-sm opacity-80 mb-2">Fill</div>
                  {/* Stop the border pulse while choosing a color; restore it
                      when the pointer moves back into the section body. */}
                  <div
                    onMouseEnter={() => clearPulse(table)}
                    onMouseLeave={() => pulseTableBorders(table)}
                  >
                    <ColorPicker
                      label="Table fill"
                      // Reflect the cells' background (the visible surface),
                      // falling back to the container color.
                      value={
                        (tableCells(table)[0] && api.getCellBackground(tableCells(table)[0])) ??
                        api.getTableBackground(table) ??
                        ""
                      }
                      onChange={(color) => {
                        const next = color || null;
                        // "Table background" colors every cell only. We do NOT
                        // color the container div: it's sized larger than the
                        // cells (width/height 100%), so its color would bleed
                        // outside the table. Clear any container color too.
                        api.setTableBackground(table, null);
                        tableCells(table).forEach((cell) => api.setCellBackground(cell, next));
                        api.render(table);
                      }}
                    />
                  </div>
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
