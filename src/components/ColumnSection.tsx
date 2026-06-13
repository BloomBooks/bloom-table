import React from "react";
import { useTableApi } from "./TableApiContext";
import addColumnLeftIcon from "./icons/column-add-before.svg";
import addColumnRightIcon from "./icons/column-add-after.svg";
import deleteColumnIcon from "./icons/column-delete.svg";
import IconButton from "./IconButton";
import columnGrowIcon from "./icons/column-grow.svg";
import columnHugIcon from "./icons/column-hug.svg";
import RadioGroup, { RadioOption } from "./RadioGroup";
import { subTitleStyle } from "./sectionStyles";
import Section from "./Section";

type Props = {
  table?: HTMLElement;
  currentCell?: HTMLElement | null;
  onInsertLeft: () => void;
  onInsertRight: () => void;
  onDelete: () => void;
};

// styles now come from sectionStyles.ts for consistency

// IconButton now comes from ./IconButton and defaults to 64x64.

export const ColumnSection: React.FC<Props> = ({
  table,
  currentCell,
  onInsertLeft,
  onInsertRight,
  onDelete,
}) => {
  const api = useTableApi();
  // Determine current column width and map to radio value
  let selectedSize: "grow" | "hug" | "fixed" = "hug";
  let fixedLabel = "mm";
  try {
    if (table && currentCell) {
      const { column: columnIndex } = api.getRowAndColumn(table, currentCell);
      const controller = new api.BloomTable(table);
      const raw = controller.getColumnWidth(columnIndex) || "hug";
      const w = typeof raw === "string" ? raw.trim() : raw;
      if (w === "hug") selectedSize = "hug";
      else if (w === "fill") selectedSize = "grow";
      else if (/(px|mm)$/i.test(w)) {
        selectedSize = "fixed";
        // If value is in mm, put the number and the unit on separate lines
        const mmMatch = w.match(/^(\d+(?:\.\d+)?)mm$/i);
        fixedLabel = mmMatch ? `${mmMatch[1]}\nmm` : w;
      }
    }
  } catch {}

  const sizeOptions: RadioOption[] = [
    { id: "grow", icon: columnGrowIcon, label: "Grow" },
    { id: "hug", icon: columnHugIcon, label: "Hug" },
    { id: "fixed", label: fixedLabel, labelStyle: { fontSize: 12 } },
  ];

  const onChangeSize = (id: string) => {
    if (!table || !currentCell) return;
    const { column: columnIndex } = api.getRowAndColumn(table, currentCell);
    const controller = new api.BloomTable(table);
    if (id === "grow") controller.setColumnWidth(columnIndex, "fill");
    else if (id === "hug") controller.setColumnWidth(columnIndex, "hug");
    else if (id === "fixed") {
      // Keep existing fixed value if present; otherwise set a default 10mm
      const current = (controller.getColumnWidth(columnIndex) || "").trim();
      const next = current && /(px|mm)$/i.test(current) ? current : "10mm";
      controller.setColumnWidth(columnIndex, next);
    }
  };

  // Current fixed value (for the editable field below).
  let colIdx = -1;
  let fixedValue = "";
  try {
    if (table && currentCell) {
      colIdx = api.getRowAndColumn(table, currentCell).column;
      const w = (new api.BloomTable(table).getColumnWidth(colIdx) || "").trim();
      if (/(px|mm)$/i.test(w)) fixedValue = w;
    }
  } catch {}

  return (
    <Section label="Column">
      <div className={subTitleStyle}>Add / Remove</div>
      <div
        className="px-4 pb-1 flex items-center justify-between gap-3"
        // Ensure the menu doesn't steal focus on mousedown (consistent with other sections)
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex gap-3">
          <IconButton icon={addColumnLeftIcon} alt="Insert Column Left" onClick={onInsertLeft} />
          <IconButton icon={addColumnRightIcon} alt="Insert Column Right" onClick={onInsertRight} />
        </div>
        <IconButton icon={deleteColumnIcon} alt="Delete Column" onClick={onDelete} />
      </div>{" "}
      <div className={subTitleStyle}>Size</div>
      <RadioGroup
        className="px-4"
        options={sizeOptions}
        value={selectedSize}
        onChange={onChangeSize}
      />
      <div className="px-4 pt-1 flex items-center gap-2">
        <span className="text-sm opacity-80">Fixed</span>
        <input
          key={`cw:${colIdx}:${fixedValue}`}
          aria-label="Column width"
          type="text"
          defaultValue={fixedValue}
          placeholder="e.g. 120px"
          onChange={(e) => {
            if (!table || !currentCell) return;
            const { column } = api.getRowAndColumn(table, currentCell);
            new api.BloomTable(table).setColumnWidth(column, e.target.value);
          }}
          className="px-2 py-1 border border-gray-600 rounded text-sm text-black"
          style={{ width: 90 }}
        />
      </div>
    </Section>
  );
};

export default ColumnSection;
