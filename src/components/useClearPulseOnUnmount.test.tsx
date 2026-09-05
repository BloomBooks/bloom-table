import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useClearPulseOnUnmount } from "./useClearPulseOnUnmount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const kOverlayClass = "bloom-sel-overlay";

// The hover overlays this hook exists to remove.
function addOverlay(doc: Document): HTMLElement {
  const overlay = doc.createElement("div");
  overlay.className = kOverlayClass;
  doc.body.appendChild(overlay);
  return overlay;
}

const overlayCount = (doc: Document): number =>
  doc.querySelectorAll(`.${kOverlayClass}`).length;

describe("useClearPulseOnUnmount", () => {
  let container: HTMLDivElement;
  let root: Root;

  const Section: React.FC<{ target: HTMLElement | null | undefined }> = ({ target }) => {
    useClearPulseOnUnmount(target);
    return <div>section</div>;
  };

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("leaves the overlay alone while the section is on screen", () => {
    const table = document.createElement("div");
    document.body.appendChild(table);
    act(() => root.render(<Section target={table} />));

    addOverlay(document);
    expect(overlayCount(document)).toBe(1);

    act(() => root.render(<Section target={table} />));
    expect(overlayCount(document)).toBe(1);

    act(() => root.unmount());
  });

  it("removes the overlay when the section goes away", () => {
    const table = document.createElement("div");
    document.body.appendChild(table);
    act(() => root.render(<Section target={table} />));
    addOverlay(document);

    act(() => root.unmount());

    expect(overlayCount(document)).toBe(0);
  });

  it("clears in the document that owns the table, not the panel's own", () => {
    // A cross-iframe host renders the panel in one document and the tables in
    // another. Clearing the panel's document would leave the overlay behind.
    const pageDocument = document.implementation.createHTMLDocument("page");
    const table = pageDocument.createElement("div");
    pageDocument.body.appendChild(table);

    act(() => root.render(<Section target={table} />));
    addOverlay(pageDocument);
    addOverlay(document);

    act(() => root.unmount());

    expect(overlayCount(pageDocument)).toBe(0);
    expect(overlayCount(document)).toBe(1);
  });

  it("uses the last table it was given, not the one it holds at unmount", () => {
    // A panel that loses its selection renders once with no target before it
    // goes away. Clearing on a null target would clear the wrong document.
    const pageDocument = document.implementation.createHTMLDocument("page");
    const table = pageDocument.createElement("div");
    pageDocument.body.appendChild(table);

    act(() => root.render(<Section target={table} />));
    act(() => root.render(<Section target={null} />));
    addOverlay(pageDocument);

    act(() => root.unmount());

    expect(overlayCount(pageDocument)).toBe(0);
  });

  it("clears the panel's own document when it never had a table", () => {
    act(() => root.render(<Section target={null} />));
    addOverlay(document);

    act(() => root.unmount());

    expect(overlayCount(document)).toBe(0);
  });
});
