import { describe, it, expect } from "vite-plus/test";
import { parseColor, toHexColor, representativeBorderColorHex } from "./color-utils";

describe("toHexColor", () => {
  it("passes through 6-digit hex, lowercased", () => {
    expect(toHexColor("#ABCDEF")).toBe("#abcdef");
  });

  it("expands 3- and 4-digit hex", () => {
    expect(toHexColor("#f0a")).toBe("#ff00aa");
    expect(toHexColor("#f0a8")).toBe("#ff00aa");
  });

  it("handles 8-digit hex", () => {
    expect(toHexColor("#0a141e80")).toBe("#0a141e");
  });

  it("parses the legacy comma rgb()/rgba() syntax", () => {
    expect(toHexColor("rgb(10, 20, 30)")).toBe("#0a141e");
    expect(toHexColor("rgba(10,20,30,0.5)")).toBe("#0a141e");
  });

  it("parses the modern space-separated rgb() syntax", () => {
    // Regression: the old comma-only split read r=10 and zero-filled g/b,
    // yielding "#0a0000".
    expect(toHexColor("rgb(10 20 30)")).toBe("#0a141e");
    expect(toHexColor("rgb(10 20 30 / 50%)")).toBe("#0a141e");
  });

  it("parses percentage channels", () => {
    expect(toHexColor("rgb(100% 0% 0%)")).toBe("#ff0000");
  });

  it("parses CSS named colors", () => {
    expect(toHexColor("red")).toBe("#ff0000");
    expect(toHexColor("Rebeccapurple")).toBe("#663399");
  });

  it("falls back to black for colors it cannot parse", () => {
    expect(toHexColor("oklch(0.7 0.1 200)")).toBe("#000000");
    expect(toHexColor("")).toBe("#000000");
    expect(toHexColor(null)).toBe("#000000");
  });
});

describe("parseColor", () => {
  it("reports alpha", () => {
    expect(parseColor("rgba(0,0,0,0)")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseColor("rgb(10 20 30 / 50%)")?.a).toBe(0.5);
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseColor("red")?.a).toBe(1);
  });

  it("returns undefined for unparseable input", () => {
    expect(parseColor("color(srgb 1 0 0)")).toBeUndefined();
    expect(parseColor("notacolor")).toBeUndefined();
  });
});

describe("representativeBorderColorHex", () => {
  function cellWith(style: string): HTMLElement {
    const el = document.createElement("td");
    el.setAttribute("style", style);
    document.body.appendChild(el);
    return el;
  }

  it("uses the first side that actually paints", () => {
    const el = cellWith(
      "border-top-style: solid; border-top-width: 2px; border-top-color: rgb(10 20 30);",
    );
    expect(representativeBorderColorHex(el)).toBe("#0a141e");
  });

  it("skips a zero-width side", () => {
    // Regression: a styled-but-zero-width top side used to win and report black.
    const el = cellWith(
      "border-top-style: solid; border-top-width: 0px; border-top-color: rgb(0, 0, 0);" +
        "border-right-style: solid; border-right-width: 3px; border-right-color: rgb(1, 2, 3);",
    );
    expect(representativeBorderColorHex(el)).toBe("#010203");
  });

  it("skips a fully transparent side", () => {
    // Regression: rgba(0,0,0,0) used to be reported as opaque black.
    const el = cellWith(
      "border-top-style: solid; border-top-width: 2px; border-top-color: rgba(0, 0, 0, 0);" +
        "border-bottom-style: solid; border-bottom-width: 2px; border-bottom-color: rgb(4, 5, 6);",
    );
    expect(representativeBorderColorHex(el)).toBe("#040506");
  });

  it("skips a hidden side", () => {
    const el = cellWith(
      "border-top-style: hidden; border-top-width: 2px; border-top-color: rgb(0, 0, 0);" +
        "border-left-style: solid; border-left-width: 2px; border-left-color: rgb(7, 8, 9);",
    );
    expect(representativeBorderColorHex(el)).toBe("#070809");
  });
});
