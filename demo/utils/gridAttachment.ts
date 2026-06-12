import { attachGrid } from "../../src/attach";

/**
 * Utility function to attach all grids on a page or within a container.
 * This ensures that all grids get proper initialization including borders,
 * layout, and interactive functionality.
 *
 * @param container - The container to search for grids. If not provided, searches the entire document.
 */
export function attachAllGrids(container: Document | HTMLElement = document): void {
  const gridElements = container.querySelectorAll<HTMLElement>(".grid");
  gridElements.forEach((grid) => {
    attachGrid(grid);
  });
}

/**
 * Utility function to be called after loading new content that may contain grids.
 * This is designed to be used by demo components and tests.
 *
 * @param container - The container that had new content loaded
 */
export function attachGridsAfterContentLoad(container: HTMLElement): void {
  attachAllGrids(container);

  // Dispatch a custom event to notify React components that new content has been loaded
  const event = new CustomEvent("exampleContentLoaded", {
    detail: { container },
  });
  document.dispatchEvent(event);
}
