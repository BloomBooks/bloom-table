// Renders one on-page element to a PNG data URI with no library and no network:
// clone the element into an SVG <foreignObject>, carry the page's own CSS in
// with it, load that SVG as an image, and draw it on a canvas.
//
// A CDN capture helper (html-to-image, html2canvas) would do the same job, but
// it would put a network dependency in the middle of the "Copy Debug Info"
// button and in the middle of the e2e test that reads the clipboard.
//
// The two rules the technique imposes:
//  - the SVG is parsed as XML, so the clone is serialized with XMLSerializer
//    and the CSS text is escaped;
//  - a <foreignObject> gets no styles from the host document, so every rule
//    that can be read is copied into an inline <style>, and every <img> becomes
//    a data URI (a canvas drawn from an SVG cannot fetch anything).

export interface CaptureOptions {
  // Pixels per CSS pixel in the PNG. Defaults to the display's ratio, capped
  // at 2 so a snapshot on a high-density screen stays a reasonable size.
  scale?: number;
  timeoutMs?: number;
  // Painted under the element, since a PNG with a transparent background looks
  // wrong pasted into a document.
  backgroundColor?: string;
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A font family such as "Andika", "Segoe UI" carries double quotes, which would
// close the attribute.
function escapeXmlAttribute(text: string): string {
  return escapeXmlText(text).replace(/"/g, "&quot;");
}

// Every rule the document will let us read. A cross-origin stylesheet throws on
// .cssRules; the Tailwind CDN script injects its rules into an inline <style>,
// which does not.
function collectStyleText(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) parts.push(rule.cssText);
  }
  return parts.join("\n");
}

// The properties the element inherits from its ancestors, which the clone
// cannot inherit because those ancestors are not in the SVG. Without this the
// text comes out in the browser's default serif black: the demo sets its font
// and colour on <body>, and a rule on <body> matches nothing inside a
// <foreignObject>.
const kInheritedProperties = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "color",
  "text-align",
  "direction",
  "white-space",
] as const;

function inheritedStyleOf(element: HTMLElement): string {
  const computed = getComputedStyle(element);
  return kInheritedProperties.map((p) => `${p}:${computed.getPropertyValue(p)}`).join(";");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("could not read an image"));
    reader.readAsDataURL(blob);
  });
}

async function inlineImages(clone: HTMLElement): Promise<void> {
  const images = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const response = await fetch(src);
        img.setAttribute("src", await blobToDataUrl(await response.blob()));
      } catch {
        // Drop the source rather than fail the whole capture: the SVG image
        // errors out as a whole if one child cannot load.
        img.removeAttribute("src");
      }
    }),
  );
}

function loadImage(url: string, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(
      () => reject(new Error(`the rendered image did not load within ${timeoutMs}ms`)),
      timeoutMs,
    );
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("the browser could not render the page fragment"));
    };
    img.src = url;
  });
}

export async function captureElementAsPngDataUrl(
  element: HTMLElement,
  options: CaptureOptions = {},
): Promise<string> {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));

  const clone = element.cloneNode(true) as HTMLElement;
  await inlineImages(clone);

  const css = escapeXmlText(collectStyleText());
  const body = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;` +
    `${escapeXmlAttribute(inheritedStyleOf(element))}">` +
    `<style>${css}</style>${body}` +
    `</div></foreignObject></svg>`;

  const timeoutMs = options.timeoutMs ?? 8000;
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    timeoutMs,
  );

  const scale = options.scale ?? Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("this browser gave no 2d canvas context");
  context.fillStyle = options.backgroundColor ?? "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
