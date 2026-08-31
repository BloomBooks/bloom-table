// The host's say over a cell's menu: which items it offers, and who opens it.
//
// A host may put a table to a use where some of the menu makes no sense. Bloom's
// calendar month grid is the case this was built for: Merge would leave a month
// short of cells, and the Format section's borders and padding fight the edges
// the calendar's own layout writes. Such a host also wants the Content Type row
// to offer fewer types than the library has registered.
//
// There is one menu, and the host filters it. The composition asks this filter
// about each item as it builds, by the ids below, and leaves out the ones the
// host refuses. A section whose every item is refused disappears with its
// divider and its header, so nothing here has to know about sections.
//
// A host that renders the menu itself takes both hooks: getCellMenuItems
// (cell-menu-model.ts) gives it the same items the library's own widget draws,
// and setCellMenuOpenHandler below lets it answer a right-click on the cell with
// its own menu instead of the library's.
//
// These are the same arrangement as setStructuralChromeGate in
// structural-chrome.ts, one level finer.

/**
 * The ids the menu composition asks about.
 *
 * - `contentType` is the Content Type row, and `contentType:<id>` is one type
 *   within it, so `contentType:image` is the Image button.
 * - `alignment`, `padding`, `fill`, `borderStyle`, `borderWeight` and `corners`
 *   are the rows of the Format section. `fill` is the row that holds both colour
 *   pickers, Fill and Border color, because they share one row.
 * - `paintFormat` is Paint format, in the Cell, Row and Column menus.
 *   `copyProperties` and `pasteProperties` are its Table menu counterparts.
 * - `merge` and `split` are the Cell menu's span commands.
 *
 * A `contentType:<id>` is only asked about once its row has been allowed.
 */
export const cellMenuItemIds = [
  "contentType",
  "alignment",
  "padding",
  "fill",
  "borderStyle",
  "borderWeight",
  "corners",
  "paintFormat",
  "copyProperties",
  "pasteProperties",
  "merge",
  "split",
] as const;

/** One of the ids above, or `contentType:<content type id>`. */
export type CellMenuItemId = string;

let filter:
  | ((
      itemId: CellMenuItemId,
      cell: HTMLElement | null,
      table: HTMLElement | null,
    ) => boolean)
  | undefined;

/**
 * Install the host's answer to "does this cell's menu offer this item?". It is
 * asked as a menu is built, with the item's id, the cell the menu acts on, and
 * that cell's table. Pass undefined to remove a filter, after which every menu
 * offers everything again.
 *
 * Write the answer as a list of what to keep rather than a list of what to
 * remove. A host that names what to remove silently gains any item a later
 * version of the library adds.
 */
export function setCellMenuItemFilter(
  fn:
    | ((
        itemId: CellMenuItemId,
        cell: HTMLElement | null,
        table: HTMLElement | null,
      ) => boolean)
    | undefined,
): void {
  filter = fn;
}

/**
 * True when the menu for `cell` offers `itemId`. Everything is offered until a
 * host installs a filter that says otherwise.
 */
export function cellMenuOffersItem(
  itemId: CellMenuItemId,
  cell: HTMLElement | null,
  table: HTMLElement | null,
): boolean {
  return filter ? filter(itemId, cell, table) : true;
}

let openHandler:
  | ((
      cell: HTMLElement,
      table: HTMLElement,
      position: { x: number; y: number },
    ) => boolean)
  | undefined;

/**
 * Install the host's chance to open a cell's menu itself. A right-click on a cell
 * asks this first, with the cell, its table, and the point the user clicked. A
 * host that answers true has opened its own menu and the library opens none; a
 * host that answers false leaves the right-click to the library, as does having
 * no handler at all.
 *
 * A host answers true where it needs the cell's items shown beside items of its
 * own that the library knows nothing about. Bloom does it for a picture in a
 * calendar month grid, whose menu has to carry the image commands as well as the
 * content type. It builds that menu from getCellMenuItems (cell-menu-model.ts),
 * so both menus offer the same cell items.
 */
export function setCellMenuOpenHandler(
  fn:
    | ((
        cell: HTMLElement,
        table: HTMLElement,
        position: { x: number; y: number },
      ) => boolean)
    | undefined,
): void {
  openHandler = fn;
}

/**
 * True when the host opened the menu for `cell` itself, in which case the library
 * must open none.
 */
export function cellMenuOpenedByHost(
  cell: HTMLElement,
  table: HTMLElement,
  position: { x: number; y: number },
): boolean {
  return openHandler ? openHandler(cell, table, position) : false;
}
