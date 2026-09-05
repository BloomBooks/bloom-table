// The one renderer of a cell's menu items, as MUI menu rows.
//
// There is one Cell menu. This component renders it, and it renders it in both
// places the user meets it: the library's own popup mounts it (see buildCellSection
// in table-size-buttons.ts), and a host such as Bloom puts it in its own MUI menu
// beside items of its own. Nothing else renders these items, so the two menus cannot
// come to differ.
//
// The items themselves, their enabled states and their actions come from the model
// (cell-menu-model.ts), assembled in table-size-buttons.ts and already filtered by
// the host's setCellMenuItemFilter. This component decides only how they look:
// commands as MenuItems with their icons, the content-type choice as a row of icon
// toggles with the chosen one pressed, and a divider wherever the item group changes.
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from "@mui/material/ToggleButton";
import { cellMenuItemsOfCell } from "../cell-menu-items-source";
import type { CellMenuChoice, CellMenuCommand } from "../cell-menu-model";
import { kItemIconColor, setIconSlot } from "../menu-widgets";
import { kBloomBlue } from "../constants";

// The toggles' pressed look, and the gutter the labels line up against.
const kPressedBackgroundColor = "#d7ecf1";
const kPressedBorderColor = "#2d8294";
const kIconGutterPx = 28;

/** What the heading over these items says, and the id a host localizes it by. */
export const kCellSectionHeadingLabel = "Table Cell";
export const kCellSectionHeadingId = "tableCell";

export interface CellMenuItemsProps {
  /** The cell whose menu this is. */
  cell: HTMLElement | null;
  /**
   * Translate one label. `id` is the item's id (or `<choice id>:<option id>`), so a
   * host can map ids to its own strings. The default returns the English label the
   * library gives, because the library does not localize.
   */
  localize?: (englishLabel: string, id: string) => string;
  /**
   * Dismiss the menu this sits in. Called just before a command runs, which is what
   * the library's popup and Bloom's menu both want; choosing a content type leaves
   * the menu open, so the user can try another.
   */
  closeMenu?: () => void;
  /**
   * Draw the Format rows — the sliders and colour pickers — into `container`. Only
   * the library's own popup passes this, because those rows are still its own DOM
   * widgets. A host that leaves it out gets no Format section.
   */
  renderFormatControls?: (container: HTMLElement) => void;
}

/** One of the library's icons, whether it is SVG markup or a url. */
const IconSlot: React.FunctionComponent<{ icon?: string; color: string }> = (props) => {
  const slot = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (slot.current) setIconSlot(slot.current, props.icon, props.color);
  }, [props.icon, props.color]);
  return (
    <span
      ref={slot}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
      }}
    />
  );
};

const CommandRow: React.FunctionComponent<{
  item: CellMenuCommand;
  label: string;
  closeMenu?: () => void;
}> = (props) => (
  <MenuItem
    aria-label={props.label}
    disabled={!props.item.enabled}
    onClick={() => {
      // The action holds the cell it was built for, so closing first is safe and
      // keeps the menu from sitting over whatever the command changes.
      props.closeMenu?.();
      props.item.invoke();
    }}
  >
    <ListItemIcon sx={{ minWidth: kIconGutterPx, width: kIconGutterPx }}>
      <IconSlot icon={props.item.icon} color={kItemIconColor} />
    </ListItemIcon>
    <ListItemText primary={props.label} primaryTypographyProps={{ variant: "inherit" }} />
  </MenuItem>
);

// The label on one line, the options below it as one row of toggle buttons. An
// option with no icon shows its label instead, so what the row shows is the
// model's own icon field.
const ChoiceRow: React.FunctionComponent<{
  item: CellMenuChoice;
  localize: (englishLabel: string, id: string) => string;
  onChosen: () => void;
}> = (props) => (
  // The display is spelled out: a host's menu may lay its own list items out as flex
  // rows, which would put the toggles beside the label rather than below it.
  <li style={{ display: "block", padding: "4px 14px", listStyle: "none" }}>
    <div style={{ fontSize: "13px", color: "#222" }}>
      {props.localize(props.item.label, props.item.id)}
    </div>
    <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
      {props.item.options.map((option) => {
        const label = props.localize(option.label, `${props.item.id}:${option.id}`);
        return (
          <ToggleButton
            key={option.id}
            value={option.id}
            selected={option.chosen}
            title={label}
            aria-label={label}
            data-ct-id={option.id}
            // Keep the focus where it was: taking it would end the edit the user
            // was in, and the menu's own outside-click closer watches mousedown.
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              option.choose();
              props.onChosen();
            }}
            sx={{
              width: 28,
              height: 24,
              padding: 0,
              border: "1px solid transparent",
              borderRadius: "5px",
              "&.Mui-selected": {
                backgroundColor: kPressedBackgroundColor,
                borderColor: kPressedBorderColor,
                "&:hover": { backgroundColor: kPressedBackgroundColor },
              },
            }}
          >
            {option.icon ? (
              <IconSlot icon={option.icon} color={kBloomBlue} />
            ) : (
              <span style={{ fontSize: "12px", color: kBloomBlue }}>{label}</span>
            )}
          </ToggleButton>
        );
      })}
    </div>
  </li>
);

// The heading over the items, saying what they act on. It is small, grey and
// upper case like the library's other section headings, but it starts at the left
// edge of the menu's content rather than at the icon gutter, so the eye finds it.
const SectionHeading: React.FunctionComponent<{ label: string }> = (props) => (
  <li
    style={{
      display: "block",
      listStyle: "none",
      padding: "8px 14px 3px",
      fontSize: "11px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: "#888",
    }}
  >
    {props.label}
  </li>
);

// The Format section's own rows, drawn by whoever passed renderFormatControls.
const FormatControls: React.FunctionComponent<{
  label: string;
  render: (container: HTMLElement) => void;
}> = (props) => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    props.render(element);
    return () => {
      element.innerHTML = "";
    };
    // The rows are drawn once per mount; they keep their own state afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <li style={{ display: "block", listStyle: "none" }}>
      <div style={{ padding: "8px 14px 3px", fontSize: "13px", color: "#666" }}>{props.label}</div>
      <div ref={container} />
    </li>
  );
};

export const CellMenuItems: React.FunctionComponent<CellMenuItemsProps> = (props) => {
  // A content-type choice changes the cell, and the model must be asked again for
  // what the cell is now. Nothing else re-renders this, so ask for a render.
  const [, noteCellChanged] = useState(0);
  const localize = props.localize ?? ((englishLabel: string) => englishLabel);
  const rows: React.ReactNode[] = [];
  let groupOfPreviousItem: string | undefined;
  const items = props.cell ? cellMenuItemsOfCell(props.cell) : [];

  // A cell whose host refuses every item has no section, so no heading either.
  if (items.length > 0) {
    rows.push(
      <SectionHeading
        key="heading"
        label={localize(kCellSectionHeadingLabel, kCellSectionHeadingId)}
      />,
    );
  }

  for (const item of items) {
    if (groupOfPreviousItem && item.group !== groupOfPreviousItem) {
      rows.push(<Divider key={`divider-before-${item.id}`} />);
    }
    groupOfPreviousItem = item.group;

    if (item.kind === "choice") {
      rows.push(
        <ChoiceRow
          key={item.id}
          item={item}
          localize={localize}
          onChosen={() => noteCellChanged((count) => count + 1)}
        />,
      );
    } else if (item.kind === "formatControls") {
      if (props.renderFormatControls) {
        rows.push(
          <FormatControls
            key={item.id}
            label={localize(item.label, item.id)}
            render={props.renderFormatControls}
          />,
        );
      }
    } else {
      rows.push(
        <CommandRow
          key={item.id}
          item={item}
          label={localize(item.label, item.id)}
          closeMenu={props.closeMenu}
        />,
      );
    }
  }

  return <>{rows}</>;
};

/**
 * Draw the component into a plain DOM container, for a menu that is not itself
 * React — the library's own popup. Rendering is flushed, so the caller can measure
 * the container as soon as this returns and position its menu. Call the returned
 * function when the menu closes.
 */
export function mountCellMenuItems(
  container: HTMLElement,
  props: CellMenuItemsProps,
): () => void {
  const root: Root = createRoot(container);
  flushSync(() => {
    root.render(<CellMenuItems {...props} />);
  });
  return () => {
    // Unmounting inside the click that closed the menu would land in the middle of
    // React's own work, so let that finish first.
    setTimeout(() => root.unmount(), 0);
  };
}
