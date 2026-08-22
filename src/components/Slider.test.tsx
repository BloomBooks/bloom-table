import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import Slider from "./Slider";

// React's act() checks this flag; without it every act() call warns.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Slider local echo (anti-thumb-fight) logic", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderSlider = (value: number, onChange: (v: number) => void, identity?: string) => {
    act(() => {
      root.render(
        <Slider
          label="X"
          value={value}
          min={0}
          max={10}
          unit="px"
          identity={identity}
          onChange={onChange}
        />,
      );
    });
  };

  const input = () => container.querySelector<HTMLInputElement>("input[type=range]")!;
  const readout = () => container.querySelector("span.tabular-nums")!.textContent;

  const drag = (to: number) => {
    act(() => {
      const el = input();
      // Set via the native setter so React's onChange sees the new value.
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el),
        "value",
      )?.set;
      if (setter) setter.call(el, String(to));
      else el.value = String(to);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("a drag emits the value and the local readout sticks synchronously", () => {
    const onChange = vi.fn();
    renderSlider(5, onChange);
    expect(readout()).toBe("5px");

    drag(7);
    expect(onChange).toHaveBeenCalledWith(7);
    // The thumb and readout follow the drag without waiting for the prop.
    expect(input().value).toBe("7");
    expect(readout()).toBe("7px");
  });

  it("the delayed echo of the user's own change does not snap the thumb back", () => {
    const onChange = vi.fn();
    renderSlider(5, onChange);
    drag(7);

    // The panel re-renders from its MutationObserver and hands the same 7
    // back as the prop. Nothing should move.
    renderSlider(7, onChange);
    expect(input().value).toBe("7");
    expect(readout()).toBe("7px");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("a new target resets the echo, even when its value repeats the old prop", () => {
    const onChange = vi.fn();
    // Cell A renders 8px and the user drags it to 6. The panel re-renders from
    // its MutationObserver, so the prop still says 8 for the moment.
    renderSlider(8, onChange, "cell-a");
    drag(6);
    expect(onChange).toHaveBeenCalledWith(6);

    // The user selects cell B, which renders 8px like A did. The prop is 8 both
    // before and after, so only the identity says the echo is stale.
    renderSlider(8, onChange, "cell-b");
    expect(input().value).toBe("8");
    expect(readout()).toBe("8px");

    // Setting 6 on B is a real change, so it emits (before, the stale 6 on
    // screen made the same input silent and B kept its old padding).
    drag(6);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it("a genuinely external prop change (e.g. undo) is adopted", () => {
    const onChange = vi.fn();
    renderSlider(5, onChange);
    drag(7);

    // Undo puts the model back to 3; the slider must follow.
    renderSlider(3, onChange);
    expect(input().value).toBe("3");
    expect(readout()).toBe("3px");
    // Adoption is silent: no onChange fired for the external value.
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
