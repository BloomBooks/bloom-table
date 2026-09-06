import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import RadioGroup, { RadioOption } from "./RadioGroup";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const options: RadioOption[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
];

describe("RadioGroup", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const mount = (props: Partial<React.ComponentProps<typeof RadioGroup>> = {}) => {
    act(() =>
      root.render(
        <RadioGroup options={options} value="center" onChange={() => {}} label="Alignment" {...props} />,
      ),
    );
  };

  const tiles = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));

  const group = (): HTMLElement => container.querySelector<HTMLElement>('[role="radiogroup"]')!;

  const press = (tile: HTMLElement, key: string) => {
    act(() => {
      tile.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
  };

  const click = (tile: HTMLElement) => {
    act(() => {
      tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("names the group for assistive tech", () => {
    mount();
    expect(group().getAttribute("aria-label")).toBe("Alignment");
  });

  it("prefers an explicit aria-label over the label prop", () => {
    mount({ "aria-label": "Text alignment" });
    expect(group().getAttribute("aria-label")).toBe("Text alignment");
  });

  it("renders one radio per option, in the order given", () => {
    mount();
    expect(tiles().map((t) => t.getAttribute("aria-label"))).toEqual(["Left", "Center", "Right"]);
  });

  it("checks the option that matches the current value, and no other", () => {
    mount();
    expect(tiles().map((t) => t.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
  });

  it("reports the option the user clicked", () => {
    const onChange = vi.fn();
    mount({ onChange });

    click(tiles()[2]);

    expect(onChange).toHaveBeenCalledWith("right");
  });

  it("is a single tab stop, resting on the selected option", () => {
    mount();
    expect(tiles().map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
  });

  it("puts the tab stop on the first option when nothing matches the value", () => {
    // A mixed selection has no matching option, and the group must still be
    // reachable by keyboard.
    mount({ value: "mixed" });
    expect(tiles().map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("moves the selection to the next option on ArrowRight", () => {
    const onChange = vi.fn();
    mount({ onChange });

    press(tiles()[1], "ArrowRight");

    expect(onChange).toHaveBeenCalledWith("right");
  });

  it("moves the selection to the previous option on ArrowLeft", () => {
    const onChange = vi.fn();
    mount({ onChange });

    press(tiles()[1], "ArrowLeft");

    expect(onChange).toHaveBeenCalledWith("left");
  });

  it("treats ArrowDown and ArrowUp the same as right and left", () => {
    const onChange = vi.fn();
    mount({ onChange });

    press(tiles()[1], "ArrowDown");
    press(tiles()[1], "ArrowUp");

    expect(onChange.mock.calls).toEqual([["right"], ["left"]]);
  });

  it("wraps around at either end", () => {
    const onChange = vi.fn();
    mount({ value: "right", onChange });

    press(tiles()[2], "ArrowRight");
    expect(onChange).toHaveBeenCalledWith("left");

    onChange.mockClear();
    act(() => root.render(<RadioGroup options={options} value="left" onChange={onChange} />));
    press(tiles()[0], "ArrowLeft");
    expect(onChange).toHaveBeenCalledWith("right");
  });

  it("moves focus with the selection, as a radio group does", () => {
    mount();
    press(tiles()[1], "ArrowRight");
    expect(document.activeElement).toBe(tiles()[2]);
  });

  it("takes over the arrow key, so the page does not scroll", () => {
    mount();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      tiles()[1].dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores the arrow keys while disabled", () => {
    const onChange = vi.fn();
    mount({ disabled: true, onChange });

    press(tiles()[1], "ArrowRight");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the whole group as disabled and disables each option", () => {
    mount({ disabled: true });
    expect(group().getAttribute("aria-disabled")).toBe("true");
    expect(tiles().every((t) => (t as HTMLButtonElement).disabled)).toBe(true);
  });

  it("shows a text label when an option has no icon", () => {
    mount();
    expect(tiles()[0].textContent).toBe("Left");
  });

  it("shows an image instead of the label when an option has an icon", () => {
    mount({ options: [{ id: "left", label: "Left", icon: "left.svg" }] });

    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("left.svg");
    expect(tiles()[0].textContent).toBe("");
  });

  it("falls back to the option id when it has no label", () => {
    mount({ options: [{ id: "left" }], value: "left" });
    expect(tiles()[0].getAttribute("aria-label")).toBe("left");
  });

  it("renders nothing but the group when there are no options", () => {
    mount({ options: [] });
    expect(tiles()).toEqual([]);
    expect(group()).not.toBeNull();
  });
});
