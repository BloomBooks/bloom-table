import React, { useMemo } from "react";
import Section from "./Section";
import { contentTypeOptions, getCurrentContentTypeId } from "../cell-contents";
import RadioGroup from "./RadioGroup";
import IconButton from "./IconButton";
import { BorderControl } from "./BorderControl/BorderControl";
import type { BorderStyle, BorderValueMap } from "./BorderControl/logic/types";
import { applyCellPerimeter, ensureEdgesArrays } from "../edge-utils";
import { getCellPerimeterValueMap } from "../border-state";
import { render } from "../table-renderer";
// icons
// icons are now owned by CellContentType; no direct imports here
// (leftover icons removed)
import mergeIcon from "./icons/cell-merge.svg";
import splitIcon from "./icons/cell-split.svg";

type Props = {
  currentCell?: HTMLElement | null;
  onSetContentType: (id: string) => void;
  onExtend: () => void;
  onContract: () => void;
};

const menuItemStyle = "flex items-center gap-2 px-4 py-1 cursor-pointer w-full text-left";

// --- Border helpers for a single cell ---
const buildBorderMapFromCell = (c: HTMLElement): BorderValueMap => {
  const table = c.closest(".table") as HTMLElement | null;
  if (table) ensureEdgesArrays(table);
  return getCellPerimeterValueMap(c);
};
const applyBorderMapToCell = (c: HTMLElement, map: BorderValueMap) => {
  // Write via edge model so renderer picks it up deterministically
  const table = c.closest(".table") as HTMLElement | null;
  if (!table) return;
  const cs = getComputedStyle(table);
  const outerColor = (cs.color || "black").trim();
  const toUI = (w: number, s: BorderStyle) => ({
    weight: w,
    style: s,
    color: outerColor,
  });
  applyCellPerimeter(table, c, {
    top: toUI(map.top.weight, map.top.style),
    right: toUI(map.right.weight, map.right.style),
    bottom: toUI(map.bottom.weight, map.bottom.style),
    left: toUI(map.left.weight, map.left.style),
  });
  // Re-render to reflect the updated edge model
  render(table);
};

const CellSection: React.FC<Props> = ({ currentCell, onSetContentType, onExtend, onContract }) => {
  const currentType = currentCell ? getCurrentContentTypeId(currentCell) : undefined;

  const borderValueMap: BorderValueMap | undefined = useMemo(() => {
    if (!currentCell) return undefined;
    return buildBorderMapFromCell(currentCell);
  }, [currentCell]);

  // Compute a stable key for the current cell to remount BorderControl on cell change
  const borderControlKey: string | undefined = useMemo(() => {
    if (!currentCell) return undefined;
    const table = currentCell.closest(".table") as HTMLElement | null;
    if (!table) return undefined;
    const cells = Array.from(table.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("cell"),
    );
    const idx = cells.indexOf(currentCell);
    return idx >= 0 ? String(idx) : undefined;
  }, [currentCell]);

  return (
    <Section label="Cell">
      {/* Content type selector */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
        <div className="text-sm opacity-80 mb-2">Content</div>
        {currentCell && currentType && (
          <RadioGroup
            className="ml-2"
            value={currentType}
            onChange={(id) => onSetContentType(id)}
            options={contentTypeOptions().map((o) => ({
              id: o.id,
              label: o.englishName,
              icon: o.icon,
            }))}
          />
        )}
      </div>

      {/* Borders */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
        <div className="text-sm opacity-80 mb-2">Borders</div>
        {currentCell && borderValueMap && (
          <BorderControl
            key={borderControlKey}
            valueMap={borderValueMap}
            showInner={false}
            onChange={(next) => applyBorderMapToCell(currentCell, next)}
          />
        )}
      </div>

      {/* Merge / Split */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
        <div className="text-sm opacity-80 mb-2">Merge / Split</div>
        <div className="flex items-center gap-3 ml-2">
          <IconButton alt="Merge" title="Merge" icon={mergeIcon} onClick={onExtend} />
          <IconButton alt="Split" title="Split" icon={splitIcon} onClick={onContract} />
        </div>
      </div>
    </Section>
  );
};

export default CellSection;
