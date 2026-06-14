// Small color helpers for the panel's color inputs, which require #rrggbb.

/** Convert a CSS color string (rgb/rgba or #hex) to #rrggbb. Falls back to black. */
export function toHexColor(input: string | null | undefined): string {
  if (!input) return "#000000";
  const s = input.trim();
  if (/^#([0-9a-f]{6})$/i.test(s)) return s.toLowerCase();
  if (/^#([0-9a-f]{3})$/i.test(s)) {
    const r = s[1],
      g = s[2],
      b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((p) => parseFloat(p.trim()));
    const hx = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n || 0)))
        .toString(16)
        .padStart(2, "0");
    return `#${hx(r)}${hx(g)}${hx(b)}`;
  }
  return "#000000";
}

/** Representative border color of an element: the first side whose border isn't
 *  "none", else the top side. Returned as #rrggbb. */
export function representativeBorderColorHex(el: HTMLElement): string {
  const cs = getComputedStyle(el);
  const sides: Array<[string, string]> = [
    ["borderTopStyle", "borderTopColor"],
    ["borderRightStyle", "borderRightColor"],
    ["borderBottomStyle", "borderBottomColor"],
    ["borderLeftStyle", "borderLeftColor"],
  ];
  for (const [styleProp, colorProp] of sides) {
    if ((cs as any)[styleProp] && (cs as any)[styleProp] !== "none") {
      return toHexColor((cs as any)[colorProp]);
    }
  }
  return toHexColor(cs.borderTopColor);
}
