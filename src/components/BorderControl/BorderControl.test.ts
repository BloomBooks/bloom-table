import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { applyBorderMapToTable } from "../TableSection";
import { defaultTableApi } from "../TableApiContext";
import { BorderValueMap } from "./logic/types";
import { render } from "../../table-renderer";

// Helper to create a basic 2x2 table
function createTestTable(): HTMLElement {
  const table = document.createElement("div");
  table.className = "table";
  table.setAttribute("data-column-widths", "100px,100px");
  table.setAttribute("data-row-heights", "50px,50px");

  // Add 4 cells
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("data-content-type", "text");
    const content = document.createElement("div");
    content.contentEditable = "true";
    cell.appendChild(content);
    table.appendChild(cell);
  }

  document.body.appendChild(table);
  return table;
}

describe("BorderControl", () => {
  let table: HTMLElement;

  beforeEach(() => {
    table = createTestTable();
  });

  afterEach(() => {
    document.body.removeChild(table);
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

      // Apply the border map to the table
      applyBorderMapToTable(defaultTableApi, table, borderMap);

      // Render the table to apply the borders to the DOM
      render(table);

      // Check that the data attributes contain the correct border styles
      const edgesV = JSON.parse(table.getAttribute("data-edges-v") || "[]");
      const edgesH = JSON.parse(table.getAttribute("data-edges-h") || "[]");

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
      const cells = table.querySelectorAll(".cell");
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

      applyBorderMapToTable(defaultTableApi, table, borderMap);
      render(table);

      // Verify that each side has its own style
      const edgesV = JSON.parse(table.getAttribute("data-edges-v") || "[]");
      const edgesH = JSON.parse(table.getAttribute("data-edges-h") || "[]");

      expect(edgesH[0][0].style).toBe("dashed"); // top
      expect(edgesV[0][2].style).toBe("solid"); // right
      expect(edgesH[2][0].style).toBe("dotted"); // bottom
      expect(edgesV[0][0].style).toBe("double"); // left
    });
  });
});
