import { describe, it, expect, beforeEach } from "vite-plus/test";
import { ProximityDiv } from "./ProximityDiv";

// Helpers to simulate layout and mouse
function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  (el as any).getBoundingClientRect = () =>
    ({
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      right: (rect.left ?? 0) + (rect.width ?? 0),
      bottom: (rect.top ?? 0) + (rect.height ?? 0),
      toJSON() {},
    } as DOMRect);
}

function moveMouse(pageX: number, pageY: number) {
  const evt = new MouseEvent("mousemove", {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  // JSDOM doesn't let us set pageX/pageY via constructor reliably; defineProperty works
  Object.defineProperty(evt, "pageX", { value: pageX });
  Object.defineProperty(evt, "pageY", { value: pageY });
  document.dispatchEvent(evt);
}

describe("ProximityDiv opacity", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // reset scroll to reduce math confusion
    Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("is fully opaque when mouse is inside the element (even near the edge)", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const child = document.createElement("div");
    const prox = new ProximityDiv(parent, child);
    // Place wrapper at known rect
    mockRect(prox.element, { left: 100, top: 100, width: 200, height: 50 });

    // Move mouse to a point well inside near the left edge (but still inside)
    moveMouse(105, 120);
    prox["updateOpacity"]();

    const opacity = parseFloat(child.style.opacity || "0");
    expect(opacity).toBe(1);
  });

  it("dims to minimum when far outside activation distance", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const child = document.createElement("div");
    const prox = new ProximityDiv(parent, child);
    mockRect(prox.element, { left: 100, top: 100, width: 200, height: 50 });

    // Far to the left (>= 50px outside)
    moveMouse(30, 120);
    prox["updateOpacity"]();

    const opacity = parseFloat(child.style.opacity || "0");
    // Current MIN_OPACITY in implementation is 0.08; check close to that
    expect(opacity).toBeCloseTo(0.08, 3);
  });

  it("ramps based on distance to the closest edge, not the center", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const child = document.createElement("div");
    const prox = new ProximityDiv(parent, child);
    mockRect(prox.element, { left: 100, top: 100, width: 200, height: 50 });

    // 10px outside the left edge, vertically centered -> distance to rect = 10
    moveMouse(90, 125);
    prox["updateOpacity"]();

    const opacity = parseFloat(child.style.opacity || "0");
    // Expected: MIN + (1-MIN) * (1 - d/ACTIVATION), with MIN=0.08, ACT=50, d=10
    const expected = 0.08 + (1 - 0.08) * (1 - 10 / 50);
    expect(opacity).toBeCloseTo(expected, 3);
  });

  it("uses the child's bounding rect (not the wrapper) for hover detection", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const child = document.createElement("div");
    const prox = new ProximityDiv(parent, child);
    // Simulate wrapper at a small box centered, but the child is a large, translated visual
    mockRect(prox.element, { left: 200, top: 200, width: 1, height: 1 });
    mockRect(child, { left: 100, top: 100, width: 200, height: 50 });

    // Mouse inside the child (should be fully opaque even if wrapper is tiny elsewhere)
    moveMouse(150, 120);
    prox["updateOpacity"]();

    const opacity = parseFloat(child.style.opacity || "0");
    expect(opacity).toBe(1);
  });

  it("updates opacity on child mouseenter even without document mousemove", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const child = document.createElement("div");
    const prox = new ProximityDiv(parent, child);
    // Place child rect
    mockRect(child, { left: 100, top: 100, width: 200, height: 50 });
    // Put wrapper elsewhere to show that we rely on child
    mockRect(prox.element, { left: 0, top: 0, width: 1, height: 1 });

    // Simulate that no document mousemove has occurred near the element yet
    // Now dispatch mouseenter on the child with inside coords
    const evt = new MouseEvent("mouseenter", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    Object.defineProperty(evt, "pageX", { value: 120 });
    Object.defineProperty(evt, "pageY", { value: 120 });
    child.dispatchEvent(evt);

    const opacity = parseFloat(child.style.opacity || "0");
    expect(opacity).toBe(1);
  });
});
