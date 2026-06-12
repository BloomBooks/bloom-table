/**
 * Default edge (border) spec.
 * IMPORTANT: Keep in sync with CSS variables in src/bloom-table.css:
 *   --edge-default-weight, --edge-default-style, --edge-default-color
 */
export const EDGE_DEFAULT = {
  weight: 1,
  style: "solid" as const,
  color: "#000",
};

export type EdgeDefault = typeof EDGE_DEFAULT;
