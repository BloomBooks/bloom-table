import React, { useMemo } from "react";
import Section from "./Section";
import RadioGroup from "./RadioGroup";
import IconButton from "./IconButton";
import { BorderControl } from "./BorderControl/BorderControl";
import type { BorderStyle, BorderValueMap } from "./BorderControl/logic/types";
import type { CellAlign } from "../table-model";
import CornerMenu from "./BorderControl/menus/CornerMenu";
import type { CornerRadius } from "./BorderControl/logic/types";
import { TableApi, useTableApi } from "./TableApiContext";
import { useColorPicker } from "./ColorPickerContext";
import Slider from "./Slider";
import { clearPulse, pulseCell, pulseCellBorders } from "../pulse-highlight";
import { representativeBorderColorHex } from "../color-utils";

// Parse the leading number from a CSS length (e.g. "6px 16px" -> 6). 0 if absent.
const firstPx = (s: string | null | undefined): number => {
  const n = parseFloat((s ?? "").trim());
  return isNaN(n) ? 0 : n;
};
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
const applyBorderMapToCell = (
  api: TableApi,
  c: HTMLElement,
  map: BorderValueMap,
  color?: string,
) => {
  // Write via edge model so renderer picks it up deterministically
  const table = c.closest(".bloom-table") as HTMLElement | null;
  if (!table) return;
  const cs = getComputedStyle(table);
  // Default to the cell's current border color so weight/style edits preserve a
  // previously chosen color; fall back to the table text color.
  const outerColor = (color ?? representativeBorderColorHex(c) ?? cs.color ?? "#000").trim();
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
  const ColorPicker = useColorPicker();
  const currentType = currentCell ? api.getCurrentContentTypeId(currentCell) : undefined;

  // The alignment RadioGroup is fully controlled by `value`. Setting data-align
  // on the cell doesn't trigger a menu re-render (it's neither a table attribute
  // nor history-tracked), so we mirror the choice in local state to reflect it
  // immediately, re-syncing whenever the selected cell changes.
  const [align, setAlign] = React.useState<CellAlign>(
    () => (currentCell && api.getCellAlign(currentCell)) || "center",
  );
  React.useEffect(() => {
    setAlign((currentCell && api.getCellAlign(currentCell)) || "center");
  }, [currentCell, api]);

  // Hover pulse: most cell controls affect the cell's content area; the
  // Borders and Corners controls affect its edges.
  const fillHover = {
    onMouseEnter: () => pulseCell(currentCell),
    onMouseLeave: () => clearPulse(currentCell),
  };
  const borderHover = {
    onMouseEnter: () => pulseCellBorders(currentCell),
    onMouseLeave: () => clearPulse(currentCell),
  };

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
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...fillHover}>
        <div className="text-sm opacity-80 mb-2">Content Type</div>
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
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...borderHover}>
        <div className="text-sm opacity-80 mb-2">Borders</div>
        {currentCell && borderValueMap && (
          <BorderControl
            key={borderControlKey}
            valueMap={borderValueMap}
            showInner={false}
            onChange={(next) => applyBorderMapToCell(api, currentCell, next)}
          />
        )}
        {currentCell && (
          <div className="mt-2">
            <div className="text-sm opacity-80 mb-2">Border color</div>
            {/* Suppress the border pulse while picking a color. */}
            <div
              onMouseEnter={() => clearPulse(currentCell)}
              onMouseLeave={() => pulseCellBorders(currentCell)}
            >
              <ColorPicker
                label="Cell border color"
                value={representativeBorderColorHex(currentCell)}
                onChange={(color) => {
                  if (!color) return; // border color can't be "none"; ignore Clear
                  applyBorderMapToCell(api, currentCell, buildBorderMapFromCell(api, currentCell), color);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Text alignment */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...fillHover}>
        <div className="text-sm opacity-80 mb-2">Text alignment</div>
        {currentCell && (
          <RadioGroup
            className="ml-2"
            value={align}
            onChange={(id) => {
              api.setCellAlign(currentCell, id as CellAlign);
              setAlign(id as CellAlign);
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
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...borderHover}>
        <div className="text-sm opacity-80 mb-2">Corners</div>
        {currentCell && (
          <CornerMenu
            value={(api.getCellCorners(currentCell)?.radius ?? 0) as CornerRadius}
            onChange={(v) => {
              if (!currentCell) return;
              api.setCellCorners(currentCell, v ? { radius: v } : null);
              const table = currentCell.closest(".bloom-table") as HTMLElement | null;
              if (table) api.render(table);
            }}
          />
        )}
      </div>

      {/* Padding */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...fillHover}>
        <div className="text-sm opacity-80 mb-2">Padding</div>
        {currentCell && (
          <Slider
            className="ml-2"
            aria-label="Cell padding"
            min={0}
            max={40}
            unit="px"
            value={firstPx(api.getCellPadding(currentCell))}
            onChange={(v) => {
              api.setCellPadding(currentCell, `${v}px`);
              const table = currentCell.closest(".bloom-table") as HTMLElement | null;
              if (table) api.render(table);
            }}
          />
        )}
      </div>

      {/* Fill */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...fillHover}>
        <div className="text-sm opacity-80 mb-2">Fill</div>
        {currentCell && (
          // Stop the cell pulse while the user is actually choosing a color, so
          // the teal tint doesn't sit on top of the color preview. Restore it
          // when the pointer moves back off the picker.
          <div
            onMouseEnter={() => clearPulse(currentCell)}
            onMouseLeave={() => pulseCell(currentCell)}
          >
            <ColorPicker
              label="Cell fill"
              value={api.getCellBackground(currentCell) ?? ""}
              onChange={(color) => {
                api.setCellBackground(currentCell, color || null);
                const table = currentCell.closest(".bloom-table") as HTMLElement | null;
                if (table) api.render(table);
              }}
            />
          </div>
        )}
      </div>

      {/* Merge / Split */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...fillHover}>
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
