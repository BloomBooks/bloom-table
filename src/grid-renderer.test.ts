import { describe, it, expect } from "vite-plus/test";
import { buildRenderModel, render } from "./grid-renderer";

function makeGrid(): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "grid";
  return grid as HTMLElement;
}

function addCell(grid: HTMLElement, spanX = 1, spanY = 1): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "cell";
  if (spanX !== 1) cell.setAttribute("data-span-x", String(spanX));
  if (spanY !== 1) cell.setAttribute("data-span-y", String(spanY));
  grid.appendChild(cell);
  return cell;
}

describe("grid-renderer", () => {
  it("nested grid defaults to no outer perimeter; explicit perimeters are allowed", () => {
    // Parent grid: 1 row x 2 cols; left cell will contain a nested grid
    const parent = document.createElement("div");
    parent.className = "grid";
    parent.setAttribute("data-column-widths", "200px,200px");
    parent.setAttribute("data-row-heights", "120px");

    // Give parent explicit perimeters so its cell borders are visible
    parent.setAttribute(
      "data-edges-h",
      JSON.stringify([
        [
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
        ],
        [
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
        ],
      ]),
    );
    parent.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
        ],
      ]),
    );

    const leftCell = document.createElement("div");
    leftCell.className = "cell";
    leftCell.dataset.contentType = "grid";
    parent.appendChild(leftCell);

    const rightCell = document.createElement("div");
    rightCell.className = "cell";
    parent.appendChild(rightCell);

    // Scenario A: Build a nested grid inside left cell WITHOUT explicit perimeters (interior-only arrays)
    const nestedA = document.createElement("div");
    nestedA.className = "grid";
    nestedA.setAttribute("data-column-widths", "fill,fill");
    nestedA.setAttribute("data-row-heights", "fill,fill");
    // interior-only: H length = R-1 = 1, V length per row = C-1 = 1
    nestedA.setAttribute(
      "data-edges-h",
      JSON.stringify([
        [
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
        ],
      ]),
    );
    nestedA.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [{ weight: 1, style: "solid", color: "#000" }],
        [{ weight: 1, style: "solid", color: "#000" }],
      ]),
    );
    // Add four cells to nested grid A
    for (let i = 0; i < 4; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      nestedA.appendChild(c);
    }
    leftCell.appendChild(nestedA);

    const nestedModelA = buildRenderModel(nestedA);
    // Expect that nested grid perimeters are not painted by default (no edgeDefault fallback on nested)
    expect(nestedModelA.cellBorders[0].top).toBeNull();
    expect(nestedModelA.cellBorders[1].top).toBeNull();
    expect(nestedModelA.cellBorders[2].bottom).toBeNull();
    expect(nestedModelA.cellBorders[3].bottom).toBeNull();
    expect(nestedModelA.cellBorders[0].left).toBeNull();
    expect(nestedModelA.cellBorders[2].left).toBeNull();
    expect(nestedModelA.cellBorders[1].right).toBeNull();
    expect(nestedModelA.cellBorders[3].right).toBeNull();
    // Inner vertical edge between [0] and [1] should exist on at least one side
    {
      const innerTopRight = nestedModelA.cellBorders[0].right;
      const innerTopLeft = nestedModelA.cellBorders[1].left;
      expect(innerTopRight === null && innerTopLeft === null).toBe(false);
    }

    // Scenario B: A nested grid WITH explicit perimeters in H and V arrays should honor those perimeters
    const nestedB = document.createElement("div");
    nestedB.className = "grid";
    nestedB.setAttribute("data-column-widths", "fill,fill");
    nestedB.setAttribute("data-row-heights", "fill,fill");
    nestedB.setAttribute(
      "data-edges-h",
      JSON.stringify([
        // top perimeter row
        [
          { weight: 2, style: "solid", color: "#000" },
          { weight: 2, style: "solid", color: "#000" },
        ],
        // interior boundary row
        [
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
        ],
        // bottom perimeter row
        [
          { weight: 2, style: "solid", color: "#000" },
          { weight: 2, style: "solid", color: "#000" },
        ],
      ]),
    );
    nestedB.setAttribute(
      "data-edges-v",
      JSON.stringify([
        // first row: left perimeter, interior, right perimeter
        [
          { weight: 2, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
          { weight: 2, style: "solid", color: "#000" },
        ],
        // second row
        [
          { weight: 2, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
          { weight: 2, style: "solid", color: "#000" },
        ],
      ]),
    );
    // Add four cells to nested grid B
    for (let i = 0; i < 4; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      nestedB.appendChild(c);
    }
    leftCell.appendChild(nestedB);

    const nestedModelB = buildRenderModel(nestedB);
    // Expect explicit perimeters to be present on outer sides
    expect(nestedModelB.cellBorders[0].top).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
    expect(nestedModelB.cellBorders[1].top).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
    expect(nestedModelB.cellBorders[2].bottom).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
    expect(nestedModelB.cellBorders[3].bottom).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
    expect(nestedModelB.cellBorders[0].left).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
    expect(nestedModelB.cellBorders[2].left).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
    expect(nestedModelB.cellBorders[1].right).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
    expect(nestedModelB.cellBorders[3].right).toEqual({
      weight: 2,
      style: "solid",
      color: "#000",
    });
  });
  it("sided edges with gap allow neighbors to differ", () => {
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.setAttribute("data-column-widths", "100px,100px");
    grid.setAttribute("data-row-heights", "30px");
    grid.setAttribute("data-gap-x", "10px");
    const a = addCell(grid); // left
    const b = addCell(grid); // right
    document.body.appendChild(grid);

    // Vertical boundary at c=0: west (A's right) vs east (B's left)
    grid.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [
          {
            west: { weight: 2, style: "solid", color: "red" },
            east: { weight: 1, style: "dashed", color: "blue" },
          },
        ],
      ]),
    );

    render(grid);
    // With positive gap, both sides render independently
    expect((a.style as any).borderRightWidth).toBe("2px");
    expect((a.style as any).borderRightStyle).toBe("solid");
    expect((b.style as any).borderLeftWidth).toBe("1px");
    expect((b.style as any).borderLeftStyle).toBe("dashed");
  });

  it("zero gap resolves neighbors to a single stroke (heavier wins)", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px");
    addCell(g);
    addCell(g);
    // gap-x omitted => zero
    g.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [
          {
            west: { weight: 1, style: "solid", color: "#444" },
            east: { weight: 3, style: "dashed", color: "#888" },
          },
        ],
      ]),
    );
    const m = buildRenderModel(g);
    // Heavier east (3) should win and be assigned to b.left only
    expect(m.cellBorders[0].right).toBeNull();
    expect(m.cellBorders[1].left).toEqual({
      weight: 3,
      style: "dashed",
      color: "#888",
    });
  });
  it("builds template strings from data attributes", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "hug,100px,fill");
    g.setAttribute("data-row-heights", "20px,hug");
    const m = buildRenderModel(g);
    expect(m.templateColumns).toBe("minmax(60px,max-content) 100px minmax(60px,1fr)");
    expect(m.templateRows).toBe("20px minmax(20px,max-content)");
  });

  it("applies span css variables per cell", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px,30px");
    const a = addCell(g, 2, 1);
    const b = addCell(g, 1, 3); // y will clamp later by CSS usage; renderer just writes vars

    render(g);

    expect(g.style.gridTemplateColumns).toBe("100px 100px");
    expect(g.style.gridTemplateRows).toBe("30px 30px");
    expect(a.style.getPropertyValue("--span-x")).toBe("2");
    expect(a.style.getPropertyValue("--span-y")).toBe("1");
    expect(b.style.getPropertyValue("--span-x")).toBe("1");
    expect(b.style.getPropertyValue("--span-y")).toBe("3");
  });

  it("edge default fills when one side is missing", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px");
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 1, style: "solid", color: "#444" }),
    );
    addCell(g); // left
    addCell(g); // right
    // Only west specified; east missing
    g.setAttribute(
      "data-edges-v",
      JSON.stringify([[{ west: { weight: 0, style: "none", color: "#000" } }]]),
    );
    const m = buildRenderModel(g);
    // With zero gap, compare west (none) vs default -> winner is 'none', assigned to left.right
    expect(m.cellBorders[0].right).toEqual({
      weight: 0,
      style: "none",
      color: "#000",
    });
    expect(m.cellBorders[1].left).toBeNull();
  });

  it("'none' trumps any other style/weight in conflicts", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px");
    addCell(g);
    addCell(g);
    // Edge definition for the boundary: west=none, east=4px solid
    g.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [
          {
            west: { weight: 0, style: "none", color: "#000" },
            east: { weight: 4, style: "solid", color: "blue" },
          },
        ],
      ]),
    );
    const m = buildRenderModel(g);
    // Expect the winner to be 'none' on the edge, applied to left cell's right and suppressing right cell's left
    expect(m.cellBorders[0].right).toEqual({
      weight: 0,
      style: "none",
      color: "#000",
    });
    expect(m.cellBorders[1].left).toBeNull();
  });

  it("uses grid inner borders when cells have none", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px");
    addCell(g);
    addCell(g);
    // Neither side provided; fall back to edge default
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 1, style: "solid", color: "#444" }),
    );
    g.setAttribute("data-edges-v", JSON.stringify([[{}]]));
    const m = buildRenderModel(g);
    expect(m.cellBorders[0].right).toEqual({
      weight: 1,
      style: "solid",
      color: "#444",
    });
    expect(m.cellBorders[1].left).toBeNull();
  });

  it("does not apply edge default across positive gaps (sides unspecified render nothing)", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px");
    g.setAttribute("data-gap-x", "8px");
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 2, style: "solid", color: "#333" }),
    );
    const a = addCell(g);
    const b = addCell(g);
    // No sides provided at the interior boundary
    g.setAttribute("data-edges-v", JSON.stringify([[{}]]));
    render(g);
    // With a gap, unspecified sides should inherit default independently
    expect((a.style as any).borderRightWidth).toBe("2px");
    expect((a.style as any).borderRightStyle).toBe("solid");
    expect((b.style as any).borderLeftWidth).toBe("2px");
    expect((b.style as any).borderLeftStyle).toBe("solid");
  });

  it("applies default to perimeters when unspecified", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px");
    addCell(g);
    addCell(g);
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 2, style: "solid", color: "#333" }),
    );
    // Provide only interior edge; omit perimeters in unified H/V
    g.setAttribute("data-edges-v", JSON.stringify([[{}]]));
    // No H array provided at all -> top/bottom perimeters unspecified
    const m = buildRenderModel(g);
    // Top and bottom perimeters should receive default now
    expect(m.cellBorders[0].top).toEqual({
      weight: 2,
      style: "solid",
      color: "#333",
    });
    expect(m.cellBorders[1].top).toEqual({
      weight: 2,
      style: "solid",
      color: "#333",
    });
    expect(m.cellBorders[0].bottom).toEqual({
      weight: 2,
      style: "solid",
      color: "#333",
    });
    expect(m.cellBorders[1].bottom).toEqual({
      weight: 2,
      style: "solid",
      color: "#333",
    });
  });

  it("null is unspecified (no force); style:none forces no stroke", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px");
    addCell(g);
    addCell(g);
    // Default that would draw a line
    g.setAttribute(
      "data-border-default",
      JSON.stringify({ weight: 1, style: "solid", color: "#000" }),
    );
    // Case 1: entire entry unspecified (zero gap) -> default applies
    g.setAttribute("data-edges-v", JSON.stringify([[{}]]));
    let m = buildRenderModel(g);
    expect(m.cellBorders[0].right).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    expect(m.cellBorders[1].left).toBeNull();

    // Case 2: explicit none on one side forces absence and suppresses default
    g.setAttribute(
      "data-edges-v",
      JSON.stringify([[{ west: { style: "none", weight: 0, color: "#000" } }]]),
    );
    m = buildRenderModel(g);
    expect(m.cellBorders[0].right).toEqual({
      weight: 0,
      style: "none",
      color: "#000",
    });
    expect(m.cellBorders[1].left).toBeNull();
  });

  it("perimeter via unified H/V applies directly to edge cells", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px,30px");
    addCell(g);
    addCell(g);
    addCell(g);
    addCell(g);
    // Top perimeter via H at r=0
    g.setAttribute(
      "data-edges-h",
      JSON.stringify([
        [
          { weight: 3, style: "double", color: "green" },
          { weight: 3, style: "double", color: "green" },
        ],
        [null, null],
        [null, null],
      ]),
    );

    const m = buildRenderModel(g);
    // top row cell top edges should be set
    expect(m.cellBorders[0].top).toEqual({
      weight: 3,
      style: "double",
      color: "green",
    });
    expect(m.cellBorders[1].top).toEqual({
      weight: 3,
      style: "double",
      color: "green",
    });
  });

  it("renders only external border when interior is none", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px,30px");
    // 2x2 cells
    addCell(g);
    addCell(g);
    addCell(g);
    addCell(g);
    // Perimeters solid black; interior boundaries none
    g.setAttribute(
      "data-edges-h",
      JSON.stringify([
        [
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
        ],
        [{ style: "none" }, { style: "none" }],
        [
          { weight: 1, style: "solid", color: "#000" },
          { weight: 1, style: "solid", color: "#000" },
        ],
      ]),
    );
    g.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [
          { weight: 1, style: "solid", color: "#000" },
          { style: "none" },
          { weight: 1, style: "solid", color: "#000" },
        ],
        [
          { weight: 1, style: "solid", color: "#000" },
          { style: "none" },
          { weight: 1, style: "solid", color: "#000" },
        ],
      ]),
    );
    const m = buildRenderModel(g);
    // Top row perimeters
    expect(m.cellBorders[0].top).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    expect(m.cellBorders[1].top).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    // Bottom row perimeters
    expect(m.cellBorders[2].bottom).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    expect(m.cellBorders[3].bottom).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    // Left and right perimeters
    expect(m.cellBorders[0].left).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    expect(m.cellBorders[2].left).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    expect(m.cellBorders[1].right).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    expect(m.cellBorders[3].right).toEqual({
      weight: 1,
      style: "solid",
      color: "#000",
    });
    // Inner edges must not draw; with zero gap and both sides 'none',
    // the winner is 'none' applied to the left/top side only.
    expect(m.cellBorders[0].right).toEqual({
      weight: 0,
      style: "none",
      color: "#000",
    });
    expect(m.cellBorders[1].left).toBeNull();
    expect(m.cellBorders[0].bottom).toEqual({
      weight: 0,
      style: "none",
      color: "#000",
    });
    expect(m.cellBorders[2].top).toBeNull();
  });

  // Borders are applied per-side; no outline usage.

  it("applies grid corner radius to outermost cells", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px,30px");
    const a = addCell(g);
    const b = addCell(g);
    const c = addCell(g);
    const d = addCell(g);
    g.setAttribute("data-corners", JSON.stringify({ radius: 8 }));
    render(g);
    // top-left (a), top-right (b), bottom-left (c), bottom-right (d)
    expect((a.style as any).borderTopLeftRadius).toBe("8px");
    expect((b.style as any).borderTopRightRadius).toBe("8px");
    expect((c.style as any).borderBottomLeftRadius).toBe("8px");
    expect((d.style as any).borderBottomRightRadius).toBe("8px");
  });

  // No special behavior for nested grids in border-only mode.

  it("falls back to CSS var defaults when data-border-default is absent", () => {
    const g = makeGrid();
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px,30px");
    // Simulate :root CSS variables in jsdom by setting them on the grid
    g.style.setProperty("--edge-default-weight", "1");
    g.style.setProperty("--edge-default-style", "solid");
    g.style.setProperty("--edge-default-color", "#000");
    addCell(g);
    addCell(g);
    addCell(g);
    addCell(g);
    // No data-border-default and no explicit edges
    const m = buildRenderModel(g);
    // Expect 1px solid #000 from :root CSS vars on all perimeters (top row top, bottom row bottom, left col left, right col right)
    const def = { weight: 1, style: "solid", color: "#000" };
    expect(m.cellBorders[0].top).toEqual(def);
    expect(m.cellBorders[1].top).toEqual(def);
    expect(m.cellBorders[2].bottom).toEqual(def);
    expect(m.cellBorders[3].bottom).toEqual(def);
    expect(m.cellBorders[0].left).toEqual(def);
    expect(m.cellBorders[2].left).toEqual(def);
    expect(m.cellBorders[1].right).toEqual(def);
    expect(m.cellBorders[3].right).toEqual(def);
  });

  it("clamps 'double' style to at least 4px when rendering", () => {
    const g = makeGrid();
    g.className = "grid";
    g.setAttribute("data-column-widths", "100px,100px");
    g.setAttribute("data-row-heights", "30px,30px");
    // create 2x2
    const a = addCell(g);
    addCell(g);
    addCell(g);
    addCell(g);
    // Set top perimeter to double weight 1 and left perimeter to double weight 2
    g.setAttribute(
      "data-edges-h",
      JSON.stringify([
        [
          { weight: 1, style: "double", color: "#000" },
          { weight: 1, style: "double", color: "#000" },
        ],
        [null, null],
        [null, null],
      ]),
    );
    g.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [{ weight: 2, style: "double", color: "#000" }, null, null],
        [{ weight: 2, style: "double", color: "#000" }, null, null],
      ]),
    );
    render(g);
    // Top-left cell should have top and left borders as double and clamped to 4px
    expect((a.style as any).borderTopStyle).toBe("double");
    expect((a.style as any).borderTopWidth).toBe("4px");
    expect((a.style as any).borderLeftStyle).toBe("double");
    expect((a.style as any).borderLeftWidth).toBe("4px");

    // If explicit weight is 0 with style double, it should remain none (not forced visible)
    const g2 = makeGrid();
    g2.setAttribute("data-column-widths", "100px");
    g2.setAttribute("data-row-heights", "30px");
    const only = addCell(g2);
    g2.setAttribute(
      "data-edges-h",
      JSON.stringify([[{ weight: 0, style: "double", color: "#000" }], [null]]),
    );
    g2.setAttribute(
      "data-edges-v",
      JSON.stringify([
        [
          { weight: 0, style: "double", color: "#000" },
          { weight: 0, style: "double", color: "#000" },
        ],
      ]),
    );
    render(g2);
    expect((only.style as any).borderTopStyle).toBe("none");
    expect((only.style as any).borderTopWidth).toBe("0px");
    expect((only.style as any).borderLeftStyle).toBe("none");
    expect((only.style as any).borderLeftWidth).toBe("0px");
  });
});
