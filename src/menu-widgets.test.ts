import { describe, it, expect, vi } from "vite-plus/test";
import {
  kIconSlotPx,
  stylePill,
  makeGlyphPill,
  makeMenuHeader,
  makeDivider,
  setIconSlot,
  kItemIconColor,
  makeInfoNote,
  makeControlRow,
  setToggleActive,
  makeIconToggle,
  makeTextToggle,
  makeSampleToggle,
  makeNoneSample,
  noneDiagonal,
  kNoneStroke,
  makeBorderStyleToggle,
  makeBorderWeightToggle,
  makeCornerToggle,
  firstPx,
  makeSliderRow,
  makeColorInput,
  makeColorPairRow,
} from "./menu-widgets";
import { kBloomBlue } from "./constants";

const click = (el: HTMLElement) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

const mouseDown = (el: HTMLElement): MouseEvent => {
  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

// Drive an <input> the way a user does: set the value, then fire "input".
const typeInto = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("stylePill", () => {
  it("tells assistive tech the pill opens a menu", () => {
    const button = document.createElement("button");
    stylePill(button);
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("starts hidden, because the pill only shows near its table", () => {
    const button = document.createElement("button");
    stylePill(button);
    expect(button.style.display).toBe("none");
  });

  it("swallows a mousedown, so opening the menu does not take the cell's selection", () => {
    const button = document.createElement("button");
    stylePill(button);
    expect(mouseDown(button).defaultPrevented).toBe(true);
  });
});

describe("makeGlyphPill", () => {
  it("labels the pill for both assistive tech and a tooltip", () => {
    const pill = makeGlyphPill("Row", "row.svg", "width:16px");
    expect(pill.getAttribute("aria-label")).toBe("Row");
    expect(pill.title).toBe("Row");
  });

  it("builds the glyph as an image element, not as markup", () => {
    // A bundler can inline an SVG as a data URL that still holds double
    // quotes. Written as an HTML string those end the src early and the rest
    // of the markup shows up as text inside the pill.
    const quoted = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
    const pill = makeGlyphPill("Row", quoted, "width:16px");

    const img = pill.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(quoted);
    expect(pill.textContent).toBe("");
  });

  it("gives the glyph the caller's aspect ratio", () => {
    const pill = makeGlyphPill("Column", "column.svg", "width:8px;height:16px");
    expect(pill.querySelector("img")!.getAttribute("style")).toBe("width:8px;height:16px");
  });

  it("marks itself as edit-time chrome, so saving strips it", () => {
    const pill = makeGlyphPill("Table", "table.svg", "");
    expect(pill.getAttribute("data-table-overlay")).toBe("menu-pill");
  });

  it("carries the pill styling, including the menu role", () => {
    expect(makeGlyphPill("Row", "row.svg", "").getAttribute("aria-haspopup")).toBe("menu");
  });
});

describe("makeMenuHeader and makeDivider", () => {
  it("shows the header text", () => {
    expect(makeMenuHeader("Format").textContent).toBe("Format");
  });

  it("indents the header past the icon gutter, so it lines up with item labels", () => {
    expect(makeMenuHeader("Format").style.padding).toContain(`${14 + kIconSlotPx}px`);
  });

  it("makes the divider a line with no text", () => {
    const divider = makeDivider();
    expect(divider.style.height).toBe("1px");
    expect(divider.textContent).toBe("");
  });
});

describe("setIconSlot", () => {
  it("puts inline SVG markup straight in and colors it through currentColor", () => {
    const slot = document.createElement("span");
    setIconSlot(slot, "<svg><path/></svg>", "#123456");

    expect(slot.querySelector("svg")).not.toBeNull();
    expect(slot.style.color).toBe("#123456");
  });

  it("recolors a URL icon through a mask, since the toolbar icons are white", () => {
    const slot = document.createElement("span");
    setIconSlot(slot, "icon.svg", "#333333");

    const mask = slot.querySelector("span")!;
    expect(mask.style.backgroundColor).toBe("#333333");
    expect(mask.style.getPropertyValue("mask-image")).toBe('url("icon.svg")');
  });

  it("escapes a data URL so its quotes and angle brackets cannot end the CSS string", () => {
    const slot = document.createElement("span");
    setIconSlot(slot, 'data:image/svg+xml,<svg fill="red"/>', "#333333");

    const maskImage = slot.querySelector("span")!.style.getPropertyValue("mask-image");
    expect(maskImage).toBe('url("data:image/svg+xml,%3Csvg fill=%22red%22/%3E")');
  });

  it("empties the slot when there is no icon", () => {
    const slot = document.createElement("span");
    slot.innerHTML = "<b>old</b>";
    setIconSlot(slot, undefined, "#333333");
    expect(slot.innerHTML).toBe("");
  });
});

describe("makeInfoNote", () => {
  it("shows the note text", () => {
    expect(makeInfoNote("Rows are fixed here.").textContent).toContain("Rows are fixed here.");
  });

  it("puts an info icon in the gutter, in the Bloom blue", () => {
    const note = makeInfoNote("A note");
    const icon = note.firstElementChild as HTMLElement;
    expect(icon.querySelector("svg")).not.toBeNull();
    expect(icon.style.color).not.toBe("");
  });

  it("is a plain div, so it is not a menu item and does nothing on click", () => {
    const note = makeInfoNote("A note");
    expect(note.tagName).toBe("DIV");
    expect(note.getAttribute("role")).toBeNull();
    expect(note.querySelector("button")).toBeNull();
  });

  it("does not use the same blue as the item icons", () => {
    // The note's icon is deliberately the Bloom blue, not the icon gray, so a
    // reader sees it as information rather than as another command.
    expect(kBloomBlue).not.toBe(kItemIconColor);
  });
});

describe("makeControlRow", () => {
  it("puts the label on its own line above the controls", () => {
    const one = document.createElement("button");
    const row = makeControlRow("Size", [one]);

    const [labelLine, controlsLine] = Array.from(row.children) as HTMLElement[];
    expect(labelLine.textContent).toBe("Size");
    expect(controlsLine.contains(one)).toBe(true);
  });

  it("keeps the controls in the order given", () => {
    const a = document.createElement("button");
    a.textContent = "A";
    const b = document.createElement("button");
    b.textContent = "B";
    const row = makeControlRow("Size", [a, b]);

    const controlsLine = row.children[1] as HTMLElement;
    expect(Array.from(controlsLine.children).map((c) => c.textContent)).toEqual(["A", "B"]);
  });

  it("indents the controls under the label text", () => {
    const controlsLine = makeControlRow("Size", []).children[1] as HTMLElement;
    expect(controlsLine.style.paddingLeft).toBe(`${kIconSlotPx}px`);
  });
});

describe("setToggleActive", () => {
  it("reports the pressed state to assistive tech", () => {
    const button = document.createElement("button");
    setToggleActive(button, true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    setToggleActive(button, false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("tints an active toggle and clears the tint when it goes inactive", () => {
    const button = document.createElement("button");
    setToggleActive(button, true);
    const activeBackground = button.style.background;

    setToggleActive(button, false);
    expect(button.style.background).toBe("transparent");
    expect(activeBackground).not.toBe("transparent");
  });
});

describe("makeIconToggle", () => {
  it("labels itself for assistive tech and for a tooltip", () => {
    const toggle = makeIconToggle("icon.svg", "Align left", false, () => {});
    expect(toggle.getAttribute("aria-label")).toBe("Align left");
    expect(toggle.title).toBe("Align left");
  });

  it("shows its active state when it is the current choice", () => {
    expect(makeIconToggle("i.svg", "Left", true, () => {}).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(makeIconToggle("i.svg", "Left", false, () => {}).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("calls back on click", () => {
    const onClick = vi.fn();
    click(makeIconToggle("i.svg", "Left", false, onClick));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the click inside the menu, so the popup does not treat it as an outside click", () => {
    const menu = document.createElement("div");
    const outer = vi.fn();
    menu.addEventListener("click", outer);
    const toggle = makeIconToggle("i.svg", "Left", false, () => {});
    menu.appendChild(toggle);

    click(toggle);
    expect(outer).not.toHaveBeenCalled();
  });

  it("swallows a mousedown, so the selected cell keeps its selection", () => {
    expect(mouseDown(makeIconToggle("i.svg", "Left", false, () => {})).defaultPrevented).toBe(true);
  });
});

describe("makeTextToggle", () => {
  it("shows the measurement as its label and the title separately", () => {
    const toggle = makeTextToggle("24mm", "Fixed size", true, () => {});
    expect(toggle.textContent).toBe("24mm");
    expect(toggle.title).toBe("Fixed size");
    expect(toggle.getAttribute("aria-label")).toBe("Fixed size");
  });

  it("shows its active state and calls back on click", () => {
    const onClick = vi.fn();
    const toggle = makeTextToggle("24mm", "Fixed size", true, onClick);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("makeSampleToggle", () => {
  it("shows the sample it was given", () => {
    const sample = document.createElement("span");
    sample.id = "sample";
    expect(makeSampleToggle("Solid", sample, () => {}).querySelector("#sample")).toBe(sample);
  });

  it("starts inactive, because the caller sets the current choice afterwards", () => {
    const toggle = makeSampleToggle("Solid", document.createElement("span"), () => {});
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("calls back on click and keeps the click inside the menu", () => {
    const onClick = vi.fn();
    const outer = vi.fn();
    const menu = document.createElement("div");
    menu.addEventListener("click", outer);
    const toggle = makeSampleToggle("Solid", document.createElement("span"), onClick);
    menu.appendChild(toggle);

    click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe("makeNoneSample", () => {
  // The diagonal itself is a linear-gradient with calc() inside, which the
  // happy-dom CSS parser drops, so these tests read the box around it. The
  // drawn line is covered by the e2e screenshots.
  it("draws an outlined box of the size asked for", () => {
    const sample = makeNoneSample(22, 14);
    expect(sample.style.width).toBe("22px");
    expect(sample.style.height).toBe("14px");
    expect(sample.style.borderRadius).toBe("2px");
  });

  it("outlines the box in the same gray the diagonal uses", () => {
    const withoutSpaces = (css: string) => css.replace(/ /g, "");
    expect(noneDiagonal).toContain(kNoneStroke);
    expect(withoutSpaces(makeNoneSample(22, 14).style.border)).toContain(
      withoutSpaces(kNoneStroke),
    );
  });
});

describe("makeBorderStyleToggle", () => {
  it("draws a sample line in the style it offers", () => {
    const toggle = makeBorderStyleToggle("dashed", () => {});
    const sample = toggle.firstElementChild as HTMLElement;
    expect(sample.style.borderTopStyle).toBe("dashed");
  });

  it("shows the crossed-out box for none, since there is no line to draw", () => {
    const sample = makeBorderStyleToggle("none", () => {}).firstElementChild as HTMLElement;
    // A style sample is a 0-height rule; the none sample is a box instead.
    expect(sample.style.height).toBe("14px");
    expect(sample.style.borderRadius).toBe("2px");

    const solidSample = makeBorderStyleToggle("solid", () => {})
      .firstElementChild as HTMLElement;
    expect(solidSample.style.height).toBe("0px");
  });

  it("titles itself with the style, capitalized for a reader", () => {
    expect(makeBorderStyleToggle("dashed", () => {}).title).toBe("Dashed");
    expect(makeBorderStyleToggle("none", () => {}).title).toBe("None");
  });

  it("records the style it stands for, so the menu can mark the current one", () => {
    expect(makeBorderStyleToggle("double", () => {}).dataset.style).toBe("double");
  });

  it("calls back on click", () => {
    const onClick = vi.fn();
    click(makeBorderStyleToggle("solid", onClick));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("makeBorderWeightToggle", () => {
  it("draws a line as thick as the weight it offers", () => {
    const sample = makeBorderWeightToggle(3, () => {}).firstElementChild as HTMLElement;
    expect(sample.style.height).toBe("3px");
  });

  it("shows the crossed-out box for weight zero", () => {
    const sample = makeBorderWeightToggle(0, () => {}).firstElementChild as HTMLElement;
    // A weight sample is a filled bar of that thickness; zero gets the box.
    expect(sample.style.height).toBe("14px");
    expect(sample.style.borderRadius).toBe("2px");
  });

  it("titles a weight by its number, and zero as none", () => {
    expect(makeBorderWeightToggle(2, () => {}).title).toBe("2");
    expect(makeBorderWeightToggle(0, () => {}).title).toBe("0 (None)");
  });

  it("records the weight it stands for", () => {
    expect(makeBorderWeightToggle(2, () => {}).dataset.weight).toBe("2");
    expect(makeBorderWeightToggle(0, () => {}).dataset.weight).toBe("0");
  });
});

describe("makeCornerToggle", () => {
  it("rounds the sample's top-left corner by the radius it offers", () => {
    const sample = makeCornerToggle(6, false, () => {}).firstElementChild as HTMLElement;
    expect(sample.style.borderTopLeftRadius).toBe("6px");
  });

  it("caps the drawn radius at the sample's own size", () => {
    // The sample box is 18px, so a larger radius cannot be drawn as asked.
    const sample = makeCornerToggle(40, false, () => {}).firstElementChild as HTMLElement;
    expect(sample.style.borderTopLeftRadius).toBe("18px");
  });

  it("names the radius for assistive tech", () => {
    const toggle = makeCornerToggle(6, false, () => {});
    expect(toggle.getAttribute("aria-label")).toBe("Corner radius 6");
    expect(toggle.title).toBe("6");
  });

  it("shows its active state and calls back on click", () => {
    const onClick = vi.fn();
    const toggle = makeCornerToggle(6, true, onClick);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("firstPx", () => {
  it("reads the leading number of a CSS length", () => {
    expect(firstPx("6px")).toBe(6);
    expect(firstPx("  12.5mm ")).toBe(12.5);
  });

  it("reads only the first number of a shorthand", () => {
    expect(firstPx("4px 8px")).toBe(4);
  });

  it("answers zero for anything with no number in front", () => {
    expect(firstPx("")).toBe(0);
    expect(firstPx(null)).toBe(0);
    expect(firstPx(undefined)).toBe(0);
    expect(firstPx("auto")).toBe(0);
  });
});

describe("makeSliderRow", () => {
  const sliderOf = (row: HTMLElement) => row.querySelector("input")!;
  const readoutOf = (row: HTMLElement) =>
    (row.children[1] as HTMLElement).children[1] as HTMLElement;

  it("starts at the current value, inside the range it was given", () => {
    const slider = sliderOf(makeSliderRow("Gap", 0, 20, 6, "mm", () => {}));
    expect(slider.value).toBe("6");
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("20");
  });

  it("shows the current value with its unit", () => {
    const row = makeSliderRow("Gap", 0, 20, 6, "mm", () => {});
    expect(readoutOf(row).textContent).toBe("6mm");
  });

  it("reports each new value as the user moves it", () => {
    const onInput = vi.fn();
    const row = makeSliderRow("Gap", 0, 20, 6, "mm", onInput);

    typeInto(sliderOf(row), "11");

    expect(onInput).toHaveBeenCalledWith(11);
  });

  it("updates the readout as the user moves it", () => {
    const row = makeSliderRow("Gap", 0, 20, 6, "mm", () => {});
    typeInto(sliderOf(row), "11");
    expect(readoutOf(row).textContent).toBe("11mm");
  });

  it("labels the slider with the row's own label", () => {
    const row = makeSliderRow("Row gap", 0, 20, 6, "mm", () => {});
    expect(sliderOf(row).getAttribute("aria-label")).toBe("Row gap");
    expect((row.children[0] as HTMLElement).textContent).toBe("Row gap");
  });

  it("says once that the gesture is over, however many steps it took", () => {
    const onCommit = vi.fn();
    const row = makeSliderRow("Gap", 0, 20, 6, "mm", () => {}, onCommit);
    const slider = sliderOf(row);

    typeInto(slider, "9");
    typeInto(slider, "11");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(11);
  });

  it("says nothing about the end of a gesture when the caller wants no such word", () => {
    const row = makeSliderRow("Gap", 0, 20, 6, "mm", () => {});

    expect(() =>
      sliderOf(row).dispatchEvent(new Event("change", { bubbles: true })),
    ).not.toThrow();
  });
});

describe("makeColorInput", () => {
  const inputOf = (wrap: HTMLElement) => wrap.querySelector("input")!;
  const coverOf = (wrap: HTMLElement) => wrap.querySelector("div")! as HTMLElement;

  it("shows the current color when one is set", () => {
    const wrap = makeColorInput("Fill", "#ff0000", () => {});
    expect(inputOf(wrap).value).toBe("#ff0000");
    expect(coverOf(wrap).style.display).toBe("none");
  });

  it("covers the swatch with the no-color indicator when nothing is set", () => {
    // A native color input cannot show "no color", so the cover says it.
    const wrap = makeColorInput("Fill", "", () => {});
    expect(coverOf(wrap).style.display).toBe("block");
    expect(inputOf(wrap).value).toBe("#ffffff");
  });

  it("treats a value that is not a six-digit hex as unset", () => {
    expect(coverOf(makeColorInput("Fill", "red", () => {})).style.display).toBe("block");
    expect(coverOf(makeColorInput("Fill", "#f00", () => {})).style.display).toBe("block");
  });

  it("reports the color the user picked", () => {
    const onInput = vi.fn();
    const wrap = makeColorInput("Fill", "", onInput);

    typeInto(inputOf(wrap), "#00ff00");

    expect(onInput).toHaveBeenCalledWith("#00ff00");
  });

  it("uncovers the swatch once the user picks a color", () => {
    const wrap = makeColorInput("Fill", "", () => {});
    typeInto(inputOf(wrap), "#00ff00");
    expect(coverOf(wrap).style.display).toBe("none");
  });

  it("lets a click through the cover to the input underneath", () => {
    const wrap = makeColorInput("Fill", "", () => {});
    expect(coverOf(wrap).style.pointerEvents).toBe("none");
  });

  it("labels the input for assistive tech", () => {
    expect(makeColorInput("Cell fill", "", () => {}).querySelector("input")!.getAttribute(
      "aria-label",
    )).toBe("Cell fill");
  });
});

describe("makeColorPairRow", () => {
  const entry = (label: string, value: string, onInput: (v: string) => void) => ({
    label,
    value,
    onInput,
  });

  it("shows both captions, in the order given", () => {
    const row = makeColorPairRow([
      entry("Fill", "#ff0000", () => {}),
      entry("Border color", "#0000ff", () => {}),
    ]);
    const captions = Array.from(row.querySelectorAll("span")).map((s) => s.textContent);
    expect(captions).toEqual(["Fill", "Border color"]);
  });

  it("gives each picker its own current value", () => {
    const row = makeColorPairRow([
      entry("Fill", "#ff0000", () => {}),
      entry("Border color", "#0000ff", () => {}),
    ]);
    const values = Array.from(row.querySelectorAll("input")).map((i) => i.value);
    expect(values).toEqual(["#ff0000", "#0000ff"]);
  });

  it("routes each picker's change to its own callback", () => {
    const onFill = vi.fn();
    const onBorder = vi.fn();
    const row = makeColorPairRow([
      entry("Fill", "#ff0000", onFill),
      entry("Border color", "#0000ff", onBorder),
    ]);

    const [fill, border] = Array.from(row.querySelectorAll("input"));
    typeInto(fill, "#00ff00");
    typeInto(border, "#123456");

    expect(onFill).toHaveBeenCalledWith("#00ff00");
    expect(onBorder).toHaveBeenCalledWith("#123456");
  });

  it("indents the pair under the icon gutter, as a control row does", () => {
    const row = makeColorPairRow([entry("Fill", "", () => {}), entry("Border", "", () => {})]);
    expect((row.firstElementChild as HTMLElement).style.paddingLeft).toBe(`${kIconSlotPx}px`);
  });
});
