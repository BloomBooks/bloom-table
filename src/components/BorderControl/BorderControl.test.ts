import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { applyBorderMapToGrid } from "../TableSection";
import { BorderValueMap } from "./logic/types";
import { render } from "../../grid-renderer";

// Helper to create a basic 2x2 grid
function createTestGrid(): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "grid";
  grid.setAttribute("data-column-widths", "100px,100px");
  grid.setAttribute("data-row-heights", "50px,50px");

  // Add 4 cells
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("data-content-type", "text");
    const content = document.createElement("div");
    content.contentEditable = "true";
    cell.appendChild(content);
    grid.appendChild(cell);
  }

  document.body.appendChild(grid);
  return grid;
}

describe("BorderControl", () => {
  let grid: HTMLElement;

  beforeEach(() => {
    grid = createTestGrid();
  });

  afterEach(() => {
    document.body.removeChild(grid);
  });

  describe("dashed border functionality", () => {
    it("should apply dashed borders when selected in border control", () => {
      // Create a border map with all sides having dashed borders but different weights
      const borderMap: BorderValueMap = {
        top: { weight: 2, style: "dashed", radius: 0 },
        right: { weight: 4, style: "solid", radius: 0 },
        bottom: { weight: 1, style: "dotted", radius: 0 },
        left: { weight: 2, style: "double", radius: 0 },
        innerH: { weight: 1, style: "solid", radius: 0 },
        innerV: { weight: 1, style: "solid", radius: 0 },
      };

      // Apply the border map to the grid
      applyBorderMapToGrid(grid, borderMap);

      // Render the grid to apply the borders to the DOM
      render(grid);

      // Check that the data attributes contain the correct border styles
      const edgesV = JSON.parse(grid.getAttribute("data-edges-v") || "[]");
      const edgesH = JSON.parse(grid.getAttribute("data-edges-h") || "[]");

      // Top border should be dashed
      expect(edgesH[0][0].style).toBe("dashed");
      expect(edgesH[0][0].weight).toBe(2);

      // Right border should be solid
      expect(edgesV[0][2].style).toBe("solid");
      expect(edgesV[0][2].weight).toBe(4);

      // Bottom border should be dotted
      expect(edgesH[2][0].style).toBe("dotted");
      expect(edgesH[2][0].weight).toBe(1);

      // Left border should be double
      expect(edgesV[0][0].style).toBe("double");
      expect(edgesV[0][0].weight).toBe(2);

      // Check that the actual cell styles are applied correctly
      const cells = grid.querySelectorAll(".cell");
      const topLeftCell = cells[0] as HTMLElement;

      // Top border should be dashed 2px
      expect(topLeftCell.style.borderTopStyle).toBe("dashed");
      expect(topLeftCell.style.borderTopWidth).toBe("2px");

      // Left border should be double and clamped to 4px
      expect(topLeftCell.style.borderLeftStyle).toBe("double");
      expect(topLeftCell.style.borderLeftWidth).toBe("4px");
    });

    it("should handle mixed border styles correctly", () => {
      // Apply different styles to each side
      const borderMap: BorderValueMap = {
        top: { weight: 2, style: "dashed", radius: 0 },
        right: { weight: 2, style: "solid", radius: 0 },
        bottom: { weight: 2, style: "dotted", radius: 0 },
        left: { weight: 2, style: "double", radius: 0 },
        innerH: { weight: 0, style: "none", radius: 0 },
        innerV: { weight: 0, style: "none", radius: 0 },
      };

      applyBorderMapToGrid(grid, borderMap);
      render(grid);

      // Verify that each side has its own style
      const edgesV = JSON.parse(grid.getAttribute("data-edges-v") || "[]");
      const edgesH = JSON.parse(grid.getAttribute("data-edges-h") || "[]");

      expect(edgesH[0][0].style).toBe("dashed"); // top
      expect(edgesV[0][2].style).toBe("solid"); // right
      expect(edgesH[2][0].style).toBe("dotted"); // bottom
      expect(edgesV[0][0].style).toBe("double"); // left
    });
  });
});
