// Builds a plain-text diagnostic snapshot for pasting into a bug report or an
// AI chat: the edit-time selection/overlay state, anchor-name sanity, every
// action the user has taken this session, every table's durable HTML, and the
// saved attempt from localStorage. Wired to the "Copy Debug Info" button next
// to "Start Over", which also puts a PNG of the table on the clipboard.
import { getRowAndColumn } from "../../src/structure";
import { tableHistoryManager } from "../../src/history";
import { ActionJournal, formatJournalSection } from "./actionJournal";
import { captureElementAsPngDataUrl } from "./captureElementPng";

function describeTable(t: HTMLElement | null): string {
  if (!t) return "(no table)";
  const cols = (t.getAttribute("data-column-widths") || "").split(",").filter(Boolean).length;
  const rows = (t.getAttribute("data-row-heights") || "").split(",").filter(Boolean).length;
  const nested = !!t.parentElement?.closest(".bloom-table");
  return `${t.id ? `#${t.id} ` : ""}${rows}x${cols}${nested ? " (nested)" : ""} table`;
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

// One realized border side from computed style: "none" or "2px dashed rgb(...)".
function realizedSide(cs: CSSStyleDeclaration, side: "Top" | "Right" | "Bottom" | "Left"): string {
  const w = cs.getPropertyValue(`border-${side.toLowerCase()}-width`);
  const s = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
  const c = cs.getPropertyValue(`border-${side.toLowerCase()}-color`);
  if (s === "none" || w === "0px") return "none";
  return `${w} ${s} ${c}`;
}

// What the browser actually renders, post-cascade: the DevTools "Computed"
// view, curated to the properties that matter for table layout debugging.
function pushRealizedLayout(table: HTMLElement, push: (s?: string) => void): void {
  const tcs = getComputedStyle(table);
  const tr = table.getBoundingClientRect();
  push(
    `- table: ${px(tr.width)} x ${px(tr.height)} at (${px(tr.x)}, ${px(tr.y)}); ` +
      `display ${tcs.display}; grid-cols: ${tcs.gridTemplateColumns}; grid-rows: ${tcs.gridTemplateRows}; ` +
      `gap: ${tcs.columnGap} ${tcs.rowGap}; bg: ${tcs.backgroundColor}; radius: ${tcs.borderRadius}`,
  );
  const cells = Array.from(table.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("bloom-cell"),
  );
  cells.forEach((cell) => {
    let label = "cell ?";
    try {
      const p = getRowAndColumn(table, cell);
      label = `cell r${p.row}c${p.column}`;
    } catch {}
    const cs = getComputedStyle(cell);
    if (cs.display === "none") {
      push(`- ${label}: display none${cell.classList.contains("bloom-skip") ? " (bloom-skip)" : " (!)"}`);
      return;
    }
    const r = cell.getBoundingClientRect();
    const sides = (["Top", "Right", "Bottom", "Left"] as const).map((s) => realizedSide(cs, s));
    const border = sides.every((s) => s === sides[0])
      ? `border: ${sides[0]} (all sides)`
      : `border T/R/B/L: ${sides.join(" | ")}`;
    push(
      `- ${label}: ${px(r.width)} x ${px(r.height)} at (${px(r.x)}, ${px(r.y)}); ` +
        `pad: ${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}; ` +
        `bg: ${cs.backgroundColor}; radius: ${cs.borderRadius}; ${border}` +
        (cs.gridColumnEnd.startsWith("span") || cs.gridRowEnd.startsWith("span")
          ? `; span: ${cs.gridColumnEnd} / ${cs.gridRowEnd}`
          : ""),
    );
  });
}

export function buildDebugInfo(
  exampleId?: string,
  storageKey?: string | null,
  journal?: ActionJournal | null,
): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push("# bloom-table debug snapshot");
  push(`- when: ${new Date().toISOString()}`);
  push(`- page: ${location.href}`);
  if (exampleId) push(`- example: ${exampleId}`);
  push();

  push("## Edit-time state");
  const selCells = Array.from(
    document.querySelectorAll<HTMLElement>(".bloom-cell.cell--selected"),
  );
  if (selCells.length === 0) push("- selected cell: none");
  selCells.forEach((cell) => {
    const table = cell.closest<HTMLElement>(".bloom-table");
    let pos = "?";
    if (table) {
      try {
        const p = getRowAndColumn(table, cell);
        pos = `row ${p.row}, col ${p.column}`;
      } catch {
        pos = "not a direct cell of its table (!)";
      }
    }
    push(`- selected cell: ${pos} of ${describeTable(table)}`);
  });
  if (selCells.length > 1) {
    push(`- (!) ${selCells.length} cells carry cell--selected; there should be at most one`);
  }
  document
    .querySelectorAll<HTMLElement>(".bloom-table.table--selected, .bloom-table.bloom-pointer-near")
    .forEach((t) => {
      const marks = ["table--selected", "bloom-pointer-near"].filter((c) =>
        t.classList.contains(c),
      );
      push(`- ${describeTable(t)}: ${marks.join(", ")}`);
    });

  const anchors = new Map<string, number>();
  document.querySelectorAll<HTMLElement>("[data-btable-anchor-name]").forEach((el) => {
    const n = el.getAttribute("data-btable-anchor-name")!;
    anchors.set(n, (anchors.get(n) ?? 0) + 1);
  });
  push(
    `- anchor names in DOM: ${anchors.size === 0 ? "none" : Array.from(anchors.keys()).join(", ")}`,
  );
  Array.from(anchors.entries())
    .filter(([, count]) => count > 1)
    .forEach(([name, count]) =>
      push(`- (!) anchor name ${name} appears on ${count} elements — pills anchor to the wrong cell`),
    );

  for (const kind of ["table", "row", "column"]) {
    const pill = document.querySelector<HTMLElement>(`[data-btable-menu-pill="${kind}"]`);
    if (!pill) {
      push(`- ${kind} pill: not created`);
      continue;
    }
    let visible = true;
    let anchor: string | null = null;
    for (let el: HTMLElement | null = pill; el && el !== document.body; el = el.parentElement) {
      if (el.style.display === "none") visible = false;
      if (!anchor) anchor = el.style.getPropertyValue("position-anchor") || null;
    }
    push(`- ${kind} pill: ${visible ? "visible" : "hidden"}${anchor ? `, anchored to ${anchor}` : ""}`);
  }
  push();

  // Everything the user did, in order. The undo stack below is capped, drops
  // entries whose table has left the DOM, and loses an entry when it is undone,
  // so it cannot answer "what did the user do?".
  if (journal) {
    formatJournalSection(journal).forEach((line) => push(line));
    push();
  }

  const undoEntries = tableHistoryManager.getEntriesForDebug();
  push(`## Undo stack (${undoEntries.length} entries, newest first)`);
  if (undoEntries.length === 0) push("(empty)");
  undoEntries
    .slice()
    .reverse()
    .forEach((e, i) => {
      const t = new Date(e.timestamp).toISOString().slice(11, 23);
      const what = e.detail ? `${e.label} — ${e.detail}` : e.label;
      push(`${i + 1}. ${what} — ${t}${e.tableInDom ? "" : " (!) table no longer in DOM"}`);
    });
  push();

  const containers: [string, string][] = [
    ["Attempt", "attempt-container"],
    ["Test", "test-container"],
  ];
  for (const [label, containerId] of containers) {
    const container = document.getElementById(containerId);
    if (!container) continue;
    // Top-level tables only for the HTML dump; nested ones appear inside
    // their host's HTML. Realized layout is reported per table, nested
    // included, since each is its own grid.
    const allTables = Array.from(container.querySelectorAll<HTMLElement>(".bloom-table"));
    const topLevel = allTables.filter((t) => !t.parentElement?.closest(".bloom-table"));
    if (allTables.length === 0) continue;
    push(`## ${label} (#${containerId})`);
    topLevel.forEach((t, i) => {
      push(`### table ${i}: ${describeTable(t)}`);
      push("```html");
      push(t.outerHTML);
      push("```");
      push();
    });
    allTables.forEach((t) => {
      push(`### realized layout: ${describeTable(t)}`);
      pushRealizedLayout(t, push);
      push();
    });
  }

  if (storageKey) {
    push(`## localStorage ("${storageKey}")`);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {}
    if (saved == null) {
      push("(nothing saved)");
    } else {
      push("```html");
      push(saved);
      push("```");
    }
    push();
  }

  return lines.join("\n");
}

export interface CopyDebugInfoOptions {
  exampleId?: string;
  storageKey?: string | null;
  journal?: ActionJournal | null;
  // What to photograph. Defaults to the printable page inside the attempt area.
  captureTarget?: HTMLElement | null;
}

export interface CopyDebugInfoResult {
  screenshotIncluded: boolean;
  // Present when the screenshot could not be included; also appended to the
  // copied text so the reader of a bug report knows why there is no picture.
  failureReason?: string;
}

// The element that visually holds the table(s): the printable page inside the
// user's attempt, or the attempt container itself when the example's HTML has
// no #page wrapper.
function defaultCaptureTarget(): HTMLElement | null {
  const attempt = document.getElementById("attempt-container");
  if (attempt) return attempt.querySelector<HTMLElement>("#page") ?? attempt;
  return document.getElementById("page");
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function writePlainText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API can be unavailable (permissions, non-secure context).
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// Puts the snapshot on the clipboard in two flavours: text/plain for a code
// editor or an AI chat, and text/html carrying the same text plus a PNG of the
// table for a rich target such as an email or a document. Any failure of the
// picture half falls back to the plain text, so the button always copies
// something.
export async function copyDebugInfo(
  options: CopyDebugInfoOptions = {},
): Promise<CopyDebugInfoResult> {
  const text = buildDebugInfo(options.exampleId, options.storageKey, options.journal);

  let failureReason: string | undefined;
  let pngDataUrl: string | null = null;

  const target = options.captureTarget ?? defaultCaptureTarget();
  if (!target) {
    failureReason = "no table area was found on the page";
  } else if (
    typeof ClipboardItem === "undefined" ||
    typeof navigator.clipboard?.write !== "function"
  ) {
    failureReason = "this browser cannot put an image on the clipboard";
  } else {
    try {
      pngDataUrl = await captureElementAsPngDataUrl(target);
    } catch (error) {
      failureReason = reasonOf(error);
    }
  }

  if (pngDataUrl) {
    const html =
      `<div><p><strong>bloom-table debug snapshot</strong></p>` +
      `<img src="${pngDataUrl}" alt="the table at the time of the snapshot" />` +
      `<pre>${escapeHtml(text)}</pre></div>`;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return { screenshotIncluded: true };
    } catch (error) {
      failureReason = reasonOf(error);
    }
  }

  const reason = failureReason ?? "unknown reason";
  await writePlainText(`${text}\n(screenshot capture failed: ${reason})\n`);
  return { screenshotIncluded: false, failureReason: reason };
}
