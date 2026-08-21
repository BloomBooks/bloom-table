// Stateless DOM element factories for the "..." pill menus: pills, headers,
// dividers, icon slots, toggle buttons, sliders, and color inputs. Everything
// here takes its inputs via parameters and touches no overlay/menu module
// state, so it can be shared without lifecycle coupling. (makeMenuItem stays
// in table-size-buttons.ts: it drives the delete-preview and popup-close
// behaviors, which are menu-lifecycle state.)

import { kBloomBlue } from "./constants";
import { kInfoIconSvg } from "./menu-icons";

export const kIconSlotPx = 22; // reserved left gutter so labels align with/without icons

// Base pill styling shared by the row/column "..." pills and the table pill.
export function stylePill(btn: HTMLButtonElement): void {
  Object.assign(btn.style, {
    position: "static",
    height: "20px",
    minWidth: "30px",
    padding: "0 8px",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.3)",
    backgroundColor: "#2D8294",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "700",
    lineHeight: "1",
    letterSpacing: "1px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    cursor: "pointer",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  btn.setAttribute("aria-haspopup", "menu");
  // Don't steal selection/focus from the current cell when opening the menu.
  btn.addEventListener("mousedown", (e) => e.preventDefault());
}

// A pill showing an orientation glyph (table / row / column). `iconStyle` lets
// each caller preserve its glyph's aspect ratio (the row glyph is wide, the
// column glyph is tall).
export function makeGlyphPill(label: string, iconSrc: string, iconStyle: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  // Build the image with the DOM rather than an HTML string: the bundler can
  // inline an .svg as a `data:image/svg+xml,` URL that still contains double
  // quotes, and those end the src attribute early and spill the rest of the
  // markup into the pill as visible text.
  const img = document.createElement("img");
  img.src = iconSrc;
  img.alt = "";
  img.setAttribute("style", iconStyle);
  btn.replaceChildren(img);
  stylePill(btn);
  // Edit-time chrome living outside the table; prepare-for-save strips it.
  btn.setAttribute("data-table-overlay", "menu-pill");
  return btn;
}

// Bold, no-op section header. Indented to align with item labels (past gutter).
export function makeMenuHeader(text: string): HTMLDivElement {
  const h = document.createElement("div");
  h.textContent = text;
  Object.assign(h.style, {
    padding: `8px 14px 3px ${14 + kIconSlotPx}px`,
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#888",
  } as CSSStyleDeclaration);
  return h;
}

// A thin horizontal divider between sections.
export function makeDivider(): HTMLDivElement {
  const d = document.createElement("div");
  Object.assign(d.style, {
    height: "1px",
    background: "rgba(0,0,0,0.1)",
    margin: "4px 0",
  } as CSSStyleDeclaration);
  return d;
}

// Color for the black line icons in the left gutter of menu items.
export const kItemIconColor = "#333";

// Make a URL safe to put inside a CSS url("..."). A bundler can inline an .svg
// as a `data:image/svg+xml,` URL that still holds literal double quotes, angle
// brackets and newlines. Any of those ends the CSS string early, so the whole
// declaration is rejected and the caller gets a flat colored box, not an icon.
function cssUrl(url: string): string {
  const unsafeInACssString: Record<string, string> = {
    '"': "%22",
    "<": "%3C",
    ">": "%3E",
    "\r": "%0D",
    "\n": "%0A",
  };
  let escaped = url;
  for (const [character, replacement] of Object.entries(unsafeInACssString)) {
    escaped = escaped.split(character).join(replacement);
  }
  return `url("${escaped}")`;
}

// Fill an element with an icon recolored to `color`. Accepts inline SVG markup
// (uses currentColor) or a URL (recolored via CSS mask, since the toolbar SVGs
// are white and would otherwise be invisible on the white menu).
export function setIconSlot(el: HTMLElement, icon: string | undefined, color: string): void {
  el.innerHTML = "";
  if (!icon) return;
  if (icon.trim().startsWith("<svg")) {
    el.style.color = color;
    el.innerHTML = icon;
    return;
  }
  const m = document.createElement("span");
  Object.assign(m.style, {
    display: "block",
    width: "16px",
    height: "16px",
    backgroundColor: color,
  } as CSSStyleDeclaration);
  m.style.setProperty("mask-image", cssUrl(icon));
  m.style.setProperty("-webkit-mask-image", cssUrl(icon));
  for (const prop of ["mask-size", "-webkit-mask-size"]) m.style.setProperty(prop, "contain");
  for (const prop of ["mask-repeat", "-webkit-mask-repeat"]) m.style.setProperty(prop, "no-repeat");
  for (const prop of ["mask-position", "-webkit-mask-position"]) m.style.setProperty(prop, "center");
  el.appendChild(m);
}

// A non-interactive hint row: a Bloom-blue info icon followed by muted text.
// Does nothing on click (it's a plain div, not a menuitem button).
export function makeInfoNote(text: string): HTMLDivElement {
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "6px 14px",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  const slot = document.createElement("span");
  Object.assign(slot.style, {
    flex: `0 0 ${kIconSlotPx}px`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as CSSStyleDeclaration);
  setIconSlot(slot, kInfoIconSvg, kBloomBlue);
  const label = document.createElement("span");
  label.textContent = text;
  Object.assign(label.style, {
    flex: "1 1 auto",
    fontSize: "12px",
    color: "#666",
  } as CSSStyleDeclaration);
  row.appendChild(slot);
  row.appendChild(label);
  return row;
}

// A control group: the command label on one line, then its chooser buttons on
// the line below (indented to align under the label text).
export function makeControlRow(label: string, controls: HTMLElement[]): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.padding = "4px 14px";
  wrap.style.boxSizing = "border-box";

  const labelLine = document.createElement("div");
  Object.assign(labelLine.style, { display: "flex", alignItems: "center" } as CSSStyleDeclaration);
  const slot = document.createElement("span");
  slot.style.flex = `0 0 ${kIconSlotPx}px`;
  const text = document.createElement("span");
  text.textContent = label;
  Object.assign(text.style, { fontSize: "13px", color: "#222" } as CSSStyleDeclaration);
  labelLine.appendChild(slot);
  labelLine.appendChild(text);

  const controlsLine = document.createElement("div");
  Object.assign(controlsLine.style, {
    display: "flex",
    gap: "4px",
    paddingLeft: `${kIconSlotPx}px`,
    marginTop: "2px",
  } as CSSStyleDeclaration);
  controls.forEach((c) => controlsLine.appendChild(c));

  wrap.appendChild(labelLine);
  wrap.appendChild(controlsLine);
  return wrap;
}

export function setToggleActive(btn: HTMLButtonElement, active: boolean): void {
  btn.style.background = active ? "#d7ecf1" : "transparent";
  btn.style.borderColor = active ? "#2D8294" : "transparent";
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

// A small icon button used inside control rows (content type, alignment).
export function makeIconToggle(icon: string, title: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.setAttribute("aria-label", title);
  Object.assign(b.style, {
    width: "28px",
    height: "24px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  setIconSlot(b, icon, kBloomBlue);
  setToggleActive(b, active);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// A text-labeled toggle button matching makeIconToggle (used for the "fixed
// size" option in the Size control, where the label is a measurement).
export function makeTextToggle(text: string, title: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.setAttribute("aria-label", title);
  b.textContent = text;
  Object.assign(b.style, {
    minWidth: "28px",
    height: "24px",
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    fontSize: "12px",
    color: kBloomBlue,
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  setToggleActive(b, active);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// Shared shell for the border style/weight sample-line toggles.
export function makeSampleToggle(title: string, sample: HTMLElement, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.setAttribute("aria-label", title);
  Object.assign(b.style, {
    width: "32px",
    height: "24px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  b.appendChild(sample);
  setToggleActive(b, false);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// The "none" indicator's stroke: the same gray used for the swatch box
// outline, so the diagonal reads as part of the box.
export const kNoneStroke = "rgba(0,0,0,0.2)";

// A white background crossed by a 1px diagonal from bottom-left to top-right
// (gradient bands run perpendicular to the gradient direction, so "to bottom
// right" yields a bottom-left -> top-right line).
export const noneDiagonal = `linear-gradient(to bottom right, #fff calc(50% - 0.5px), ${kNoneStroke} calc(50% - 0.5px), ${kNoneStroke} calc(50% + 0.5px), #fff calc(50% + 0.5px))`;

// The classic "none" sample: an outlined white box with a diagonal line in
// the same gray and width as its outline. Shared by the fill swatch and the
// border style/weight "none" toggles.
export function makeNoneSample(width: number, height: number): HTMLElement {
  const box = document.createElement("span");
  Object.assign(box.style, {
    width: `${width}px`,
    height: `${height}px`,
    display: "block",
    boxSizing: "border-box",
    border: `1px solid ${kNoneStroke}`,
    borderRadius: "2px",
    background: noneDiagonal,
  } as CSSStyleDeclaration);
  return box;
}

// A border-style toggle showing a sample line in that style ("none" shows the
// crossed-out box), mirroring the sidebar's Style choices.
export function makeBorderStyleToggle(style: string, onClick: () => void): HTMLButtonElement {
  let sample: HTMLElement;
  if (style === "none") {
    sample = makeNoneSample(22, 14);
  } else {
    sample = document.createElement("span");
    Object.assign(sample.style, {
      width: "22px",
      height: "0",
      borderTop: `2px ${style} ${kItemIconColor}`,
      display: "block",
    } as CSSStyleDeclaration);
  }
  const title = style === "none" ? "None" : style[0].toUpperCase() + style.slice(1);
  const b = makeSampleToggle(title, sample, onClick);
  b.dataset.style = style;
  return b;
}

// A border-weight toggle showing a line of that thickness ("0" shows the
// crossed-out box), mirroring the sidebar's Weight choices.
export function makeBorderWeightToggle(weight: number, onClick: () => void): HTMLButtonElement {
  let sample: HTMLElement;
  if (weight) {
    sample = document.createElement("span");
    Object.assign(sample.style, {
      width: "22px",
      height: `${weight}px`,
      background: kItemIconColor,
      display: "block",
    } as CSSStyleDeclaration);
  } else {
    sample = makeNoneSample(22, 14);
  }
  const b = makeSampleToggle(weight ? `${weight}` : "0 (None)", sample, onClick);
  b.dataset.weight = String(weight);
  return b;
}

// A corner-radius toggle: a small box with left+top borders and a rounded
// top-left corner, mirroring the sidebar's corner sample buttons.
export function makeCornerToggle(radius: number, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = `${radius}`;
  b.setAttribute("aria-label", `Corner radius ${radius}`);
  Object.assign(b.style, {
    width: "28px",
    height: "24px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  const sample = document.createElement("span");
  const r = Math.max(0, Math.min(radius, 18));
  Object.assign(sample.style, {
    width: "18px",
    height: "18px",
    borderLeft: `2px solid ${kItemIconColor}`,
    borderTop: `2px solid ${kItemIconColor}`,
    borderTopLeftRadius: `${r}px`,
    boxSizing: "border-box",
    display: "block",
  } as CSSStyleDeclaration);
  b.appendChild(sample);
  setToggleActive(b, active);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// Parse the leading number from a CSS length (e.g. "6px" -> 6). 0 if absent.
export function firstPx(s: string | null | undefined): number {
  const n = parseFloat((s ?? "").trim());
  return isNaN(n) ? 0 : n;
}

// A labeled range slider on its own row. Interacting with it does not close the
// menu (the slider lives inside the popup, which the outside-click guard skips).
export function makeSliderRow(
  label: string,
  min: number,
  max: number,
  value: number,
  unit: string,
  onInput: (v: number) => void,
): HTMLDivElement {
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.setAttribute("aria-label", label);
  input.style.flex = "1 1 auto";
  // Tint the thumb/track with the Bloom primary color instead of the UA blue.
  input.style.accentColor = kBloomBlue;

  const readout = document.createElement("span");
  readout.textContent = `${value}${unit}`;
  Object.assign(readout.style, {
    fontSize: "12px",
    color: "#555",
    minWidth: "34px",
    textAlign: "right",
  } as CSSStyleDeclaration);

  input.addEventListener("input", () => {
    const v = Number(input.value);
    readout.textContent = `${v}${unit}`;
    onInput(v);
  });
  return makeControlRow(label, [input, readout]);
}

// A native color picker input. Does not close the menu. A native color input
// cannot display "no color", so when the value is unset (empty or non-hex)
// the swatch is covered with the classic no-color indicator — white with a
// red diagonal line — until the user picks a color.
export function makeColorInput(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const isSet = /^#[0-9a-fA-F]{6}$/.test(value);
  const input = document.createElement("input");
  input.type = "color";
  input.value = isSet ? value : "#ffffff";
  input.setAttribute("aria-label", label);
  Object.assign(input.style, {
    width: "40px",
    height: "24px",
    padding: "0",
    border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: "4px",
    cursor: "pointer",
    background: "transparent",
  } as CSSStyleDeclaration);
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "relative",
    display: "inline-flex",
    width: "40px",
    height: "24px",
  } as CSSStyleDeclaration);
  wrap.appendChild(input);
  const noColor = document.createElement("div");
  Object.assign(noColor.style, {
    position: "absolute",
    inset: "1px",
    borderRadius: "3px",
    pointerEvents: "none", // clicks fall through to the input
    background: noneDiagonal,
    display: isSet ? "none" : "block",
  } as CSSStyleDeclaration);
  wrap.appendChild(noColor);
  input.addEventListener("input", () => {
    noColor.style.display = "none";
    onInput(input.value);
  });
  return wrap;
}

export type ColorEntry = { label: string; value: string; onInput: (v: string) => void };

// Two labeled color pickers side by side on one row (Fill | Border color).
export function makeColorPairRow(entries: [ColorEntry, ColorEntry]): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.padding = "4px 14px";
  wrap.style.boxSizing = "border-box";
  const line = document.createElement("div");
  Object.assign(line.style, {
    display: "flex",
    gap: "16px",
    paddingLeft: `${kIconSlotPx}px`,
  } as CSSStyleDeclaration);
  for (const e of entries) {
    const col = document.createElement("div");
    Object.assign(col.style, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    } as CSSStyleDeclaration);
    const caption = document.createElement("span");
    caption.textContent = e.label;
    Object.assign(caption.style, { fontSize: "13px", color: "#222" } as CSSStyleDeclaration);
    col.appendChild(caption);
    col.appendChild(makeColorInput(e.label, e.value, e.onInput));
    line.appendChild(col);
  }
  wrap.appendChild(line);
  return wrap;
}
