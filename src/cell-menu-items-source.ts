// Where the React component finds the Cell menu's items.
//
// The items are assembled in table-size-buttons.ts, which is also the module that
// mounts the component in the library's own popup. The component reads them through
// this leaf instead of importing that module, so the two do not import each other.
import type { CellMenuItem } from "./cell-menu-model";

let source: ((cell: HTMLElement | null) => CellMenuItem[]) | undefined;

/** table-size-buttons.ts installs its item builder here as it loads. */
export function setCellMenuItemsSource(
  builder: (cell: HTMLElement | null) => CellMenuItem[],
): void {
  source = builder;
}

/** The cell's menu items, already filtered by the host's setCellMenuItemFilter. */
export function cellMenuItemsOfCell(cell: HTMLElement | null): CellMenuItem[] {
  if (!source) {
    throw new Error(
      "bloom-table: no Cell menu item source is installed. Import the library's entry point (or table-size-buttons) before rendering CellMenuItems.",
    );
  }
  return source(cell);
}
