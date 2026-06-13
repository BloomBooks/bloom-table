import React, { useMemo } from "react";
import Section from "./Section";
import RadioGroup from "./RadioGroup";
import IconButton from "./IconButton";
import { BorderControl } from "./BorderControl/BorderControl";
import type { BorderStyle, BorderValueMap } from "./BorderControl/logic/types";
import { render } from "../table-renderer";
import {
  getCellCorners,
  setCellCorners,
  getCellPadding,
  setCellPadding,
  type CellAlign,
} from "../table-model";
import CornerMenu from "./BorderControl/menus/CornerMenu";
import type { CornerRadius } from "./BorderControl/logic/types";
import { TableApi, useTableApi } from "./TableApiContext";
// icons
// icons are now owned by CellContentType; no direct imports here
// (leftover icons removed)
import mergeIcon from "./icons/cell-merge.svg";
import splitIcon from "./icons/cell-split.svg";
import alignLeftIcon from "./icons/align-left.svg";
import alignCenterIcon from "./icons/align-center.svg";
import alignRightIcon from "./icons/align-right.svg";

type Props = {
  currentCell?: HTMLElement | null;
  onSetContentType: (id: string) => void;
  onExtend: () => void;
  onContract: () => void;
};

const menuItemStyle = "flex items-center gap-2 px-4 py-1 cursor-pointer w-full text-left";

// --- Border helpers for a single cell (operations come from the injected api) ---
const buildBorderMapFromCell = (api: TableApi, c: HTMLElement): BorderValueMap => {
  const table = c.closest(".bloom-table") as HTMLElement | null;
  if (table) api.ensureEdgesArrays(table);
  return api.getCellPerimeterValueMap(c);
};
const applyBorderMapToCell = (api: TableApi, c: HTMLElement, map: BorderValueMap) => {
  // Write via edge model so renderer picks it up deterministically
  const table = c.closest(".bloom-table") as HTMLElement | null;
  if (!table) return;
  const cs = getComputedStyle(table);
  const outerColor = (cs.color || "black").trim();
  const toUI = (w: number, s: BorderStyle) => ({
    weight: w,
    style: s,
    color: outerColor,
  });
  api.applyCellPerimeter(table, c, {
    top: toUI(map.top.weight, map.top.style),
    right: toUI(map.right.weight, map.right.style),
    bottom: toUI(map.bottom.weight, map.bottom.style),
    left: toUI(map.left.weight, map.left.style),
  });
  // Re-render to reflect the updated edge model
  api.render(table);
};

const CellSection: React.FC<Props> = ({ currentCell, onSetContentType, onExtend, onContract }) => {
  const api = useTableApi();
  const currentType = currentCell ? api.getCurrentContentTypeId(currentCell) : undefined;

  const borderValueMap: BorderValueMap | undefined = useMemo(() => {
    if (!currentCell) return undefined;
    return buildBorderMapFromCell(api, currentCell);
  }, [api, currentCell]);

  // Compute a stable key for the current cell to remount BorderControl on cell change
  const borderControlKey: string | undefined = useMemo(() => {
    if (!currentCell) return undefined;
    const table = currentCell.closest(".bloom-table") as HTMLElement | null;
    if (!table) return undefined;
    const cells = Array.from(table.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
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
            options={api.contentTypeOptions().map((o) => ({
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
            onChange={(next) => applyBorderMapToCell(api, currentCell, next)}
          />
        )}
      </div>

      {/* Text alignment */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
        <div className="text-sm opacity-80 mb-2">Text alignment</div>
        {currentCell && (
          <RadioGroup
            className="ml-2"
            value={api.getCellAlign(currentCell) ?? "center"}
            onChange={(id) => {
              api.setCellAlign(currentCell, id as CellAlign);
              const table = currentCell.closest(".bloom-table") as HTMLElement | null;
              if (table) api.render(table);
            }}
            options={
              [
                { id: "start", label: "Left", icon: alignLeftIcon },
                { id: "center", label: "Center", icon: alignCenterIcon },
                { id: "end", label: "Right", icon: alignRightIcon },
              ] as { id: CellAlign; label: string; icon: string }[]
            }
          />
        )}
      </div>

      {/* Corners (per-cell) */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
        <div className="text-sm opacity-80 mb-2">Corners</div>
        {currentCell && (
          <CornerMenu
            value={(getCellCorners(currentCell)?.radius ?? 0) as CornerRadius}
            onChange={(v) => {
              if (!currentCell) return;
              setCellCorners(currentCell, v ? { radius: v } : null);
              const table = currentCell.closest(".bloom-table") as HTMLElement | null;
              if (table) render(table);
            }}
          />
        )}
      </div>

      {/* Padding */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }}>
        <div className="text-sm opacity-80 mb-2">Padding</div>
        {currentCell && (
          <input
            key={`pad:${borderControlKey}:${getCellPadding(currentCell) ?? ""}`}
            aria-label="Cell padding"
            type="text"
            defaultValue={getCellPadding(currentCell) ?? ""}
            placeholder="e.g. 6px 16px"
            onChange={(e) => {
              setCellPadding(currentCell, e.target.value || null);
              const table = currentCell.closest(".bloom-table") as HTMLElement | null;
              if (table) render(table);
            }}
            className="ml-2 px-2 py-1 border border-gray-600 rounded text-sm text-black"
            style={{ width: 120 }}
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
