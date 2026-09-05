// The Cell menu as data, so a host can render it in its own menu.
//
// There is one Cell menu. getCellMenuItems (table-size-buttons.ts) builds this
// list, already filtered by setCellMenuItemFilter, and the library's own popup
// widget draws itself from that same list. Nothing composes a second list, so
// what a host renders and what the library renders cannot drift apart.
//
// The items keep the order and the grouping the library's menu has always had:
// the content type first, then the Format rows, then Paint format, then Merge
// and Split. `group` marks those four runs, so a renderer that wants a divider
// between them puts one wherever the group changes, and no renderer has to know
// which items belong together.

import type { CellMenuItemId } from "./cell-menu-host";

/** The runs of items the menu falls into, in the order the menu shows them. */
export type CellMenuItemGroup = "contentType" | "format" | "transfer" | "span";

/** One thing the user can do, once. */
export interface CellMenuCommand {
  kind: "command";
  id: CellMenuItemId;
  group: CellMenuItemGroup;
  /** English; the library does not localize. A host supplies its own wording. */
  label: string;
  /** An inline SVG string, for a renderer that draws the library's own icons. */
  icon?: string;
  /** False when the command cannot act here, e.g. Split on an unspanned cell. */
  enabled: boolean;
  invoke: () => void;
}

/** One of the choices in a choice group, e.g. Image in the Content Type row. */
export interface CellMenuChoiceOption {
  id: string;
  label: string;
  /**
   * The option's icon: either inline SVG markup or a url (the library's build
   * makes its own icons data urls). setIconSlot paints either kind into an
   * element, so a host that wants the library's own icons calls that rather than
   * reading this itself.
   */
  icon?: string;
  /** True for the choice the cell is on now. */
  chosen: boolean;
  choose: () => void;
}

/**
 * How a choice is meant to look. "iconToggleRow" is the label on one line and
 * the options below it as one row of icon toggle buttons, the chosen one
 * pressed: no submenu, no list of labels. The library's popup draws it that way
 * and so does a host that renders the model, so the user meets one control.
 */
export type CellMenuChoicePresentation = "iconToggleRow";

/** A row where the cell is on exactly one of several choices. */
export interface CellMenuChoice {
  kind: "choice";
  id: CellMenuItemId;
  group: CellMenuItemGroup;
  label: string;
  presentation: CellMenuChoicePresentation;
  options: CellMenuChoiceOption[];
}

/**
 * Stands for the Format section, whose rows are sliders and colour pickers that
 * this model does not describe yet.
 *
 * The library's own widget draws them. A host that renders the model itself
 * either leaves this item out of its menu, which is what Bloom does, or waits
 * for the model to carry the rows: they will arrive as further item kinds in
 * this same list, in this same place, so a host that skips what it does not
 * recognise keeps working when they do.
 */
export interface CellMenuFormatControls {
  kind: "formatControls";
  id: "format";
  group: "format";
  label: string;
}

export type CellMenuItem = CellMenuCommand | CellMenuChoice | CellMenuFormatControls;
