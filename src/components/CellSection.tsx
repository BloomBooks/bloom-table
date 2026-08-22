import React from "react";
import Section from "./Section";
import RadioGroup from "./RadioGroup";
import IconButton from "./IconButton";
import { BorderControl } from "./BorderControl/BorderControl";
import type { BorderStyle, BorderValueMap } from "./BorderControl/logic/types";
import { getColumnWidths, type CellAlign } from "../table-model";
import CornerMenu from "./BorderControl/menus/CornerMenu";
import type { CornerRadius } from "./BorderControl/logic/types";
import { TableApi, useTableApi } from "./TableApiContext";
import { useColorPicker } from "./ColorPickerContext";
import Slider from "./Slider";
import { clearPulse, pulseCell, pulseCellBorders } from "../pulse-highlight";
import { useClearPulseOnUnmount } from "./useClearPulseOnUnmount";
import { elementKey } from "./elementKey";
import { paddingSliderValue } from "./cellPadding";
import { representativeBorderColorHex } from "../color-utils";
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
  /** True when there is nothing to act on (no cell selected). The controls stay
   *  visible but must be genuinely inoperable, keyboard included. */
  disabled?: boolean;
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

const CellSection: React.FC<Props> = ({
  currentCell,
  onSetContentType,
  onExtend,
  onContract,
  disabled,
}) => {
  const api = useTableApi();
  const ColorPicker = useColorPicker();
  const currentType = currentCell ? api.getCurrentContentTypeId(currentCell) : undefined;

  // Read alignment from the cell on every render, so a change made outside this
  // RadioGroup (paint format, undo) shows up as soon as the panel re-renders.
  // Setting data-align doesn't itself trigger a re-render, so the group's own
  // onChange bumps a counter to get one.
  const [, bumpRenderCount] = React.useState(0);
  const align: CellAlign = (currentCell && api.getCellAlign(currentCell)) || "center";

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
  useClearPulseOnUnmount(currentCell);

  // Read the borders from the DOM on every render (the build is cheap). Caching
  // this on the cell element would go stale whenever something else rewrote the
  // cell's borders in place — paint format, or an undo that restores the table's
  // edge attributes without replacing the element.
  const borderValueMap: BorderValueMap | undefined = currentCell
    ? buildBorderMapFromCell(api, currentCell)
    : undefined;

  // Merge/Split act on the cell's span. Split is a no-op at 1x1.
  const span = (() => {
    const table = currentCell?.closest(".bloom-table") as HTMLElement | null;
    if (!currentCell || !table) return { x: 1, y: 1 };
    try {
      const s = new api.BloomTable(table).getSpan(currentCell);
      return { x: Math.max(1, s.x || 1), y: Math.max(1, s.y || 1) };
    } catch {
      return { x: 1, y: 1 };
    }
  })();
  const canSplit = span.x > 1 || span.y > 1;
  // Merge extends the cell one column to the right, so it has nowhere to go
  // once the span already reaches the last column. Without this the click runs
  // a span change that fails a bounds assertion inside the history entry, which
  // logs and swallows it: an enabled button that does nothing.
  const canMerge = (() => {
    const table = currentCell?.closest(".bloom-table") as HTMLElement | null;
    if (!currentCell || !table) return false;
    try {
      const { column } = api.getRowAndColumn(table, currentCell);
      return column + span.x < getColumnWidths(table).length;
    } catch {
      return false; // can't place the cell; treat Merge as unavailable
    }
  })();

  return (
    <Section label="Cell">
      {/* Content type selector */}
      <div className={menuItemStyle} style={{ cursor: "default", display: "block" }} {...fillHover}>
        <div className="text-sm opacity-80 mb-2">Content Type</div>
        {currentCell && currentType && (
          <RadioGroup
            className="ml-2"
            label="Content type"
            disabled={disabled}
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
      <div
        className={menuItemStyle}
        style={{ cursor: "default", display: "block" }}
        {...borderHover}
      >
        <div className="text-sm opacity-80 mb-2">Borders</div>
        {currentCell && borderValueMap && (
          <BorderControl
            identity={elementKey(currentCell)}
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
                  applyBorderMapToCell(
                    api,
                    currentCell,
                    buildBorderMapFromCell(api, currentCell),
                    color,
                  );
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
            label="Text alignment"
            disabled={disabled}
            value={align}
            onChange={(id) => {
              api.setCellAlign(currentCell, id as CellAlign);
              const table = currentCell.closest(".bloom-table") as HTMLElement | null;
              if (table) api.render(table);
              // data-align isn't a table attribute, so nothing else re-renders
              // the panel; ask for one so the group shows the new value.
              bumpRenderCount((n) => n + 1);
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
      <div
        className={menuItemStyle}
        style={{ cursor: "default", display: "block" }}
        {...borderHover}
      >
        <div className="text-sm opacity-80 mb-2">Corners</div>
        {currentCell && (
          <CornerMenu
            disabled={disabled}
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
            identity={elementKey(currentCell)}
            disabled={disabled}
            min={0}
            max={40}
            unit="px"
            value={paddingSliderValue(currentCell, api.getCellPadding(currentCell))}
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
          <IconButton
            alt="Merge"
            title="Merge"
            icon={mergeIcon}
            onClick={onExtend}
            disabled={disabled || !canMerge}
          />
          <IconButton
            alt="Split"
            title="Split"
            icon={splitIcon}
            onClick={onContract}
            disabled={disabled || !canSplit}
          />
        </div>
      </div>
    </Section>
  );
};

export default CellSection;
