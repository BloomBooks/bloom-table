import { useEffect, useRef } from "react";
import { clearPulse } from "../pulse-highlight";

// The hover highlight overlays are added on mouseenter and removed on
// mouseleave. React does not fire mouseleave when a component goes away, so a
// panel that is hidden or unmounted while one of its sections is hovered leaves
// the overlay sitting in the page. This clears it on unmount.
//
// It remembers the last non-null target so it clears in the document that owns
// the tables: clearPulse(null) falls back to the panel's own document, which in
// a cross-iframe host is the wrong one, and the overlay would survive.
export function useClearPulseOnUnmount(target: HTMLElement | null | undefined): void {
  const last = useRef<HTMLElement | null>(null);
  if (target) last.current = target;
  useEffect(() => {
    return () => clearPulse(last.current);
  }, []);
}
