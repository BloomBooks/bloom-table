import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import IconButton from "./IconButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("IconButton", () => {
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

  const render = (element: React.ReactElement) => {
    act(() => root.render(element));
  };

  const button = (): HTMLButtonElement => container.querySelector("button")!;

  it("labels itself with the alt text for assistive tech", () => {
    render(<IconButton alt="Merge" onClick={() => {}} />);
    expect(button().getAttribute("aria-label")).toBe("Merge");
  });

  it("uses the alt text as the tooltip when no title is given", () => {
    render(<IconButton alt="Merge" onClick={() => {}} />);
    expect(button().getAttribute("title")).toBe("Merge");
  });

  it("prefers an explicit title over the alt text", () => {
    render(<IconButton alt="Merge" title="Merge with the cell to the right" onClick={() => {}} />);
    expect(button().getAttribute("title")).toBe("Merge with the cell to the right");
  });

  it("calls back on click", () => {
    const onClick = vi.fn();
    render(<IconButton alt="Merge" onClick={onClick} />);

    act(() => {
      button().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("swallows a mousedown, so the selected cell keeps its selection", () => {
    render(<IconButton alt="Merge" onClick={() => {}} />);
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });

    act(() => {
      button().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("reports its selected state as a pressed toggle", () => {
    render(<IconButton alt="Bold" onClick={() => {}} selected />);
    expect(button().getAttribute("aria-pressed")).toBe("true");

    render(<IconButton alt="Bold" onClick={() => {}} selected={false} />);
    expect(button().getAttribute("aria-pressed")).toBe("false");
  });

  it("shows an icon with an empty alt, because the button already carries the label", () => {
    render(<IconButton alt="Merge" icon="merge.svg" onClick={() => {}} />);

    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("merge.svg");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("sizes the icon to 24 pixels unless the caller says otherwise", () => {
    render(<IconButton alt="Merge" icon="merge.svg" onClick={() => {}} />);
    expect((container.querySelector("img") as HTMLElement).style.width).toBe("24px");

    render(<IconButton alt="Merge" icon="merge.svg" iconSize={16} onClick={() => {}} />);
    expect((container.querySelector("img") as HTMLElement).style.width).toBe("16px");
  });

  it("shows its children when there is no icon", () => {
    render(
      <IconButton alt="Fixed" onClick={() => {}}>
        <span>24mm</span>
      </IconButton>,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(button().textContent).toBe("24mm");
  });

  it("prefers the icon over the children when both are given", () => {
    render(
      <IconButton alt="Merge" icon="merge.svg" onClick={() => {}}>
        <span>text</span>
      </IconButton>,
    );

    expect(container.querySelector("img")).not.toBeNull();
    expect(button().textContent).toBe("");
  });

  it("passes an extra attribute through to the button", () => {
    render(<IconButton alt="Left" onClick={() => {}} role="radio" aria-checked={true} />);
    expect(button().getAttribute("role")).toBe("radio");
    expect(button().getAttribute("aria-checked")).toBe("true");
  });

  it("disables the button when asked", () => {
    render(<IconButton alt="Merge" onClick={() => {}} disabled />);
    expect(button().disabled).toBe(true);
  });
});
