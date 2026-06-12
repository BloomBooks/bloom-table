// A lightweight wrapper that adjusts child opacity based on cursor proximity.
// Usage: const prox = new ProximityDiv(parent, child);
// Then set prox.setPosition(left, top) to place it. Opacity updates happen on mousemove.

// Internal tuning constants (keep centralized to avoid API churn)
const ACTIVATION_DISTANCE = 50; // px: outside this, opacity stays at MIN
const MIN_OPACITY = 0.08; // minimum opacity clamp

let globalInstances: ProximityDiv[] = [];
let mouseListenerInstalled = false;
let lastMousePageX = 0;
let lastMousePageY = 0;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function ensureMouseListener() {
  if (mouseListenerInstalled) return;
  mouseListenerInstalled = true;
  document.addEventListener(
    "mousemove",
    (e) => {
      lastMousePageX = e.pageX;
      lastMousePageY = e.pageY;
      // Update all instances
      for (const inst of globalInstances) inst.updateOpacity();
    },
    { passive: true },
  );
}

export class ProximityDiv {
  public readonly element: HTMLDivElement;
  private child: HTMLElement;
  // Position is applied directly to wrapper styles; no need to store numeric values.

  constructor(parent: HTMLElement, child: HTMLElement) {
    this.child = child;
    ensureMouseListener();

    const wrapper = document.createElement("div");
    this.element = wrapper;
    Object.assign(wrapper.style, {
      position: "absolute",
      pointerEvents: "none", // allow the child to be clickable without the wrapper intercepting
    } as CSSStyleDeclaration);

    // Ensure the child consumes pointer events and fills the wrapper
    Object.assign(this.child.style, {
      pointerEvents: "auto",
    } as CSSStyleDeclaration);

    wrapper.appendChild(this.child);
    parent.appendChild(wrapper);

    globalInstances.push(this);

    // Ensure immediate updates when the mouse enters/moves over the child,
    // even if the document-level mousemove hasn't fired yet.
    const onHover = (e: MouseEvent) => {
      lastMousePageX = e.pageX;
      lastMousePageY = e.pageY;
      this.updateOpacity();
    };
    this.child.addEventListener("mouseenter", onHover, { passive: true });
    this.child.addEventListener("mousemove", onHover, { passive: true });
  }

  setPosition(left: number, top: number) {
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.updateOpacity();
  }

  updateOpacity() {
    // Prefer the child's rect (the visible area), since the wrapper may have zero size
    let rect = this.child.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // Fallback to wrapper rect if child rect is degenerate (e.g., display:none)
      rect = this.element.getBoundingClientRect();
    }
    // Work in page coordinates to match lastMousePageX/Y
    const left = rect.left + window.scrollX;
    const top = rect.top + window.scrollY;
    const right = left + rect.width;
    const bottom = top + rect.height;

    const px = lastMousePageX;
    const py = lastMousePageY;

    // Distance from point to rectangle (0 if inside)
    const dx = px < left ? left - px : px > right ? px - right : 0;
    const dy = py < top ? top - py : py > bottom ? py - bottom : 0;
    const distance = Math.hypot(dx, dy);

    // Dead-zone: keep initial/min opacity until within activationDistance
    const dead = Math.max(0, ACTIVATION_DISTANCE);
    let opacity: number;
    if (distance >= dead) {
      opacity = MIN_OPACITY;
    } else {
      // Ramp from minOpacity at distance=dead to 1 at distance=0
      const t = 1 - distance / (dead || 1);
      const lerp = MIN_OPACITY + t * (1 - MIN_OPACITY);
      opacity = clamp01(lerp);
    }

    // Apply to child (or wrapper). Using inline style per instruction.
    this.child.style.opacity = String(opacity);
  }

  destroy() {
    const i = globalInstances.indexOf(this);
    if (i >= 0) globalInstances.splice(i, 1);
    this.element.remove();
  }
}
