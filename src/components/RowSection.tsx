import React from "react";
import { useTableApi } from "./TableApiContext";
import addRowAboveIcon from "./icons/row-add-before.svg";
import addRowBelowIcon from "./icons/row-add-after.svg";
import deleteRowIcon from "./icons/row-delete.svg";
import IconButton from "./IconButton";
import rowGrowIcon from "./icons/row-grow.svg";
import rowHugIcon from "./icons/row-hug.svg";
import RadioGroup, { RadioOption } from "./RadioGroup";
import { subTitleStyle } from "./sectionStyles";
import Section from "./Section";
// import Slider from "./Slider"; // disabled: rows are sized by dragging dividers
import { clearPulse, pulseRow } from "../pulse-highlight";

type Props = {
  table?: HTMLElement;
  currentCell?: HTMLElement | null;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDelete: () => void;
};

// IconButton now comes from ./IconButton and defaults to 64x64.

export const RowSection: React.FC<Props> = ({
  table,
  currentCell,
  onInsertAbove,
  onInsertBelow,
  onDelete,
}) => {
  const api = useTableApi();
  // Determine current row height and map to radio value
  let selectedSize: "grow" | "hug" | "fixed" = "hug";
  let fixedLabel = "mm";
  try {
    if (table && currentCell) {
      const activeAttr = table.getAttribute("data-ui-active-row-index");
      const rowIndex = activeAttr ? parseInt(activeAttr, 10) : api.getRowIndex(currentCell);
      const controller = new api.BloomTable(table);
      const raw = controller.getRowHeight(rowIndex) || "hug";
      const h = typeof raw === "string" ? raw.trim() : raw;
      if (h === "hug") selectedSize = "hug";
      else if (h === "fill") selectedSize = "grow";
      else if (/(px|mm)$/i.test(h)) {
        selectedSize = "fixed";
        const mmMatch = h.match(/^(\d+(?:\.\d+)?)mm$/i);
        fixedLabel = mmMatch ? `${mmMatch[1]}\nmm` : h;
      }
    }
  } catch {}

  const sizeOptions: RadioOption[] = [
    { id: "grow", icon: rowGrowIcon, label: "Grow" },
    { id: "hug", icon: rowHugIcon, label: "Hug" },
    { id: "fixed", label: fixedLabel, labelStyle: { fontSize: 12 } },
  ];

  const onChangeSize = (id: string) => {
    if (!table || !currentCell) return;
    const rowIndex = api.getRowIndex(currentCell);
    const controller = new api.BloomTable(table);
    if (id === "grow") controller.setRowHeight(rowIndex, "fill");
    else if (id === "hug") controller.setRowHeight(rowIndex, "hug");
    else if (id === "fixed") {
      // Keep existing fixed value if present; otherwise set a default 10mm
      const current = (controller.getRowHeight(rowIndex) || "").trim();
      const next = current && /(px|mm)$/i.test(current) ? current : "10mm";
      controller.setRowHeight(rowIndex, next);
    }
  };

  return (
    <Section
      label="Row"
      onMouseEnter={() => pulseRow(table, currentCell)}
      onMouseLeave={() => clearPulse(table)}
    >
      <div className={subTitleStyle}>Add / Remove</div>
      <div
        className="px-4 pb-1 flex items-center justify-between gap-3"
        // Ensure the menu doesn't steal focus on mousedown (consistent with other sections)
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex gap-3">
          <IconButton icon={addRowAboveIcon} alt="Insert Row Above" onClick={onInsertAbove} />
          <IconButton icon={addRowBelowIcon} alt="Insert Row Below" onClick={onInsertBelow} />
        </div>
        <IconButton icon={deleteRowIcon} alt="Delete Row" onClick={onDelete} />
      </div>{" "}
      <div className={subTitleStyle}>Size</div>
      <RadioGroup
        className="px-4"
        options={sizeOptions}
        value={selectedSize}
        onChange={onChangeSize}
      />
      {/* Fixed-height slider disabled: users now size rows by dragging the
          divider between rows directly. Kept here (commented out) in case we
          want to restore a numeric control later.
      <div className="px-4 pt-1 flex items-center gap-2">
        <span className="text-sm opacity-80" style={{ minWidth: 36 }}>
          Fixed
        </span>
        <Slider
          className="flex-1"
          aria-label="Row height"
          min={20}
          max={300}
          unit="px"
          value={firstPx(fixedValue) || 40}
          onChange={(v) => {
            if (!table || !currentCell) return;
            const activeAttr = table.getAttribute("data-ui-active-row-index");
            const rowIndex = activeAttr ? parseInt(activeAttr, 10) : api.getRowIndex(currentCell);
            // Dragging the slider sets a fixed (px) height, switching the row out
            // of hug/grow.
            new api.BloomTable(table).setRowHeight(rowIndex, `${v}px`);
          }}
        />
      </div>
      */}
    </Section>
  );
};

export default RowSection;
