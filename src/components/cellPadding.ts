// Parse the leading number from a CSS length (e.g. "6px 16px" -> 6). 0 if absent.
export const firstPx = (s: string | null | undefined): number => {
  const n = parseFloat((s ?? "").trim());
  return isNaN(n) ? 0 : n;
};

/**
 * The number the Padding slider should show for a cell.
 *
 * `explicit` is the cell's data-pad override, which is absent on a fresh cell.
 * The cell is still padded in that case — the stylesheet's --cell-padding
 * (8px 10px) applies — so reporting 0 made the first nudge *shrink* the padding
 * while the UI suggested it was growing. Fall back to what the cell actually
 * renders with.
 */
export function paddingSliderValue(cell: HTMLElement, explicit: string | null): number {
  if (explicit) return firstPx(explicit);
  const win = cell.ownerDocument?.defaultView;
  if (!win) return 0;
  return firstPx(win.getComputedStyle(cell).paddingTop);
}
