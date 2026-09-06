import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { DefaultColorPicker, ColorPickerProps } from "./ColorPickerContext";
import TableMenu from "./TableMenu";
import { attachTable } from "../attach";
import { tableHistoryManager } from "../history";
import { getCellBackground, setCellBackground } from "../table-model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// React tracks an input's last value and skips onChange when a test assigns
// .value directly, so drive the element through its own native setter.
function setColorInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("DefaultColorPicker", () => {
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

  const render = (props: ColorPickerProps) => act(() => root.render(<DefaultColorPicker {...props} />));
  const input = (): HTMLInputElement => container.querySelector("input")!;

  it("is a native color input", () => {
    render({ value: "#ff0000", onChange: () => {} });
    expect(input().type).toBe("color");
  });

  it("shows the color it was given", () => {
    render({ value: "#ff0000", onChange: () => {} });
    expect(input().value).toBe("#ff0000");
  });

  it("shows white for an unset color, since a native input needs a valid hex", () => {
    render({ value: "", onChange: () => {} });
    expect(input().value).toBe("#ffffff");
  });

  it("shows white for a color a native input cannot take", () => {
    render({ value: "red", onChange: () => {} });
    expect(input().value).toBe("#ffffff");
  });

  it("reports the color the user picked", () => {
    const onChange = vi.fn();
    render({ value: "#ff0000", onChange });

    act(() => setColorInput(input(), "#00ff00"));

    expect(onChange).toHaveBeenCalledWith("#00ff00");
  });

  it("labels itself for assistive tech and as a tooltip", () => {
    render({ value: "", onChange: () => {}, label: "Table background" });
    expect(input().getAttribute("aria-label")).toBe("Table background");
    expect(input().getAttribute("title")).toBe("Table background");
  });

  it("falls back to a generic label when the caller gives none", () => {
    render({ value: "", onChange: () => {} });
    expect(input().getAttribute("aria-label")).toBe("Background color");
  });

  it("swallows a mousedown, so the selected cell keeps its selection", () => {
    render({ value: "", onChange: () => {} });
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });

    act(() => {
      input().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });
});

describe("a color picker injected into TableMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = "";
    tableHistoryManager.reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function makeAttachedTable(): { table: HTMLElement; cells: HTMLElement[] } {
    const table = document.createElement("div");
    table.className = "bloom-table";
    table.setAttribute("data-column-widths", "hug,hug");
    table.setAttribute("data-row-heights", "hug,hug");
    for (const text of ["A", "B", "C", "D"]) {
      const cell = document.createElement("div");
      cell.className = "bloom-cell";
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      editable.textContent = text;
      cell.appendChild(editable);
      table.appendChild(cell);
    }
    document.body.appendChild(table);
    attachTable(table);
    return { table, cells: Array.from(table.children) as HTMLElement[] };
  }

  // A host's picker: a button per label, so a test can find and drive it.
  const calls: Array<{ label?: string; value: string }> = [];
  const HostPicker: React.FC<ColorPickerProps> = ({ value, onChange, label }) => {
    calls.push({ label, value });
    return (
      <button type="button" data-host-picker={label} onClick={() => onChange("#123456")}>
        host picker
      </button>
    );
  };

  beforeEach(() => {
    calls.length = 0;
  });

  it("renders the host's picker in place of the default", () => {
    const { cells } = makeAttachedTable();
    act(() => root.render(<TableMenu currentCell={cells[0]} colorPicker={HostPicker} />));

    expect(container.querySelectorAll("[data-host-picker]").length).toBeGreaterThan(0);
    expect(container.querySelector('input[type="color"]')).toBeNull();
  });

  it("renders the built-in picker when the host injects none", () => {
    const { cells } = makeAttachedTable();
    act(() => root.render(<TableMenu currentCell={cells[0]} />));

    expect(container.querySelector('input[type="color"]')).not.toBeNull();
  });

  it("gives the host's picker the label of each control it stands in for", () => {
    const { cells } = makeAttachedTable();
    act(() => root.render(<TableMenu currentCell={cells[0]} colorPicker={HostPicker} />));

    expect(calls.map((c) => c.label)).toContain("Cell fill");
  });

  it("applies the color the host's picker reports to the selected cell", () => {
    const { cells } = makeAttachedTable();
    act(() => root.render(<TableMenu currentCell={cells[0]} colorPicker={HostPicker} />));

    const fill = container.querySelector<HTMLButtonElement>('[data-host-picker="Cell fill"]')!;
    act(() => {
      fill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getCellBackground(cells[0])).toBe("#123456");
  });

  it("shows the cell's current background as the picker's value", () => {
    const { cells } = makeAttachedTable();
    setCellBackground(cells[0], "#abcdef");

    act(() => root.render(<TableMenu currentCell={cells[0]} colorPicker={HostPicker} />));

    const fillCall = calls.find((c) => c.label === "Cell fill")!;
    expect(fillCall.value).toBe("#abcdef");
  });

  it("shows an empty value for a cell with no background of its own", () => {
    const { cells } = makeAttachedTable();
    act(() => root.render(<TableMenu currentCell={cells[0]} colorPicker={HostPicker} />));

    expect(calls.find((c) => c.label === "Cell fill")!.value).toBe("");
  });
});
