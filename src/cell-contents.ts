// The users of the library decide what contents are possible in a cell, and what the default content is when a cell is created.
// This file defines the default cell contents and provides a way to customize them.

import { CellContentType } from "./types";
// icons for default content types
import textIcon from "./components/icons/cell-content-text.svg";
import tableIcon from "./components/icons/cell-content-table.svg";
import imageIcon from "./components/icons/cell-content-image.svg";
import videoIcon from "./components/icons/cell-content-video.svg";
import { tableHistoryManager } from "./history";
import { attachTable } from "./attach";

export function contentTypeOptions(): {
  id: string;
  englishName: string;
  icon: string;
}[] {
  return defaultCellContentsForEachType.map((content) => ({
    id: content.id,
    englishName: content.englishName,
    icon: content.icon,
  }));
}
export const defaultCellContentsForEachType: CellContentType[] = [
  {
    id: "text",
    englishName: "Text",
    icon: textIcon,
    // About the "_": I couldn't get the the browser to honor the contenteditable at runtime if it was empty.
    templateHtml: "<div contenteditable='true'></div>",
    regexToIdentify: /<div[^>]*contenteditable=['"]true['"][^>]*>/,
  },
  {
    id: "table",
    englishName: "Table",
    icon: tableIcon,
    templateHtml: `<div class='bloom-table' data-column-widths='fill,fill' data-row-heights='fill,fill'>
            <div class='bloom-cell' data-content-type='text'></div>
            <div class='bloom-cell' data-content-type='text'></div>
            <div class='bloom-cell' data-content-type='text'></div>
            <div class='bloom-cell' data-content-type='text'></div>
        </div>`,
    // Match bloom-table as a whole class token, not as a substring:
    // class=[^'"]*table[^'"]* also matched Tailwind's own "table" class, and
    // anything like "sortable" or "timetable".
    regexToIdentify: /<div[^>]*class=['"](?:[^'"]*\s)?bloom-table(?:\s[^'"]*)?['"][^>]*>/,
  },
  {
    id: "image",
    englishName: "Image",
    icon: imageIcon,
    templateHtml: `<img src='https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Green_parrot_on_branch_with_yellow_head.svg/195px-Green_parrot_on_branch_with_yellow_head.svg.png' alt='Placeholder Image' />`,
    regexToIdentify: /<img/,
  },
  {
    id: "video",
    englishName: "Video",
    icon: videoIcon,
    // basic HTML5 video tag with controls and a placeholder source
    templateHtml: `<video controls preload='metadata' style='max-width: 100%; max-height: 100%'>
  <source src='https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' type='video/mp4'>
  Your browser does not support the video tag.
</video>`,
    // heuristically detect presence of a <video> tag
    regexToIdentify: /<video/,
  },
];

let defaultCellContentTypeId: string = "text";

// Name of the event dispatched on a cell after its contents are (re)initialized
// by setupContentsOfCell. Host apps listen for this (bubbles up to the table /
// document when the cell is attached) to wire host-specific behavior onto the
// new content — e.g. attaching an editor to a freshly created text block.
export const kTableCellContentChangedEvent = "tableCellContentChanged";

// Register (or replace) a cell content type at runtime. Host apps use this to
// supply their own templates — e.g. Bloom registers a "text" type whose
// templateHtml is a bloom-translationGroup instead of a bare contenteditable.
// If a type with the same id already exists it is replaced in place.
export function registerCellContentType(
  type: CellContentType,
  options?: { makeDefault?: boolean },
): void {
  const existingIndex = defaultCellContentsForEachType.findIndex((c) => c.id === type.id);
  if (existingIndex >= 0) {
    defaultCellContentsForEachType[existingIndex] = type;
  } else {
    defaultCellContentsForEachType.push(type);
  }
  if (options?.makeDefault) {
    defaultCellContentTypeId = type.id;
  }
}

// Remove a cell content type, so it no longer appears in the content-type menu.
// A host uses this for the types it cannot support: Bloom, for example, has no
// place for the library's plain <video> cell, because its videos need Bloom's own
// video container and recording tools. Removing the type the host cannot honour
// is better than leaving a menu entry that inserts content the host breaks on.
// Cells that already carry the removed type keep their content; only the menu
// entry and the ability to switch a cell to it go away.
export function unregisterCellContentType(id: string): void {
  const index = defaultCellContentsForEachType.findIndex((c) => c.id === id);
  if (index >= 0) {
    defaultCellContentsForEachType.splice(index, 1);
  }
}

export function setDefaultCellContentTypeId(id: string): void {
  defaultCellContentTypeId = id;
}

export function getDefaultCellContentTypeId(): string {
  return defaultCellContentTypeId;
}

/** Guess a cell's content type from its markup, for legacy content that carries
 *  no data-content-type. Tests the cell's own root element first, with its
 *  descendants stripped off: a cell holding a nested table used to be reported
 *  as "text", because the nested table's own cells contain contenteditable divs
 *  and the text regex is tried against the whole innerHTML before the table
 *  one, so asking for "table" on such a cell threw the user's nested table away
 *  and put a fresh empty 2x2 in its place. Only when the root element alone
 *  identifies nothing do we fall back to testing the whole innerHTML, which is
 *  what a host-registered type whose marker sits deeper in the content needs. */
function identifyContentTypeFromMarkup(cell: HTMLElement): string | undefined {
  const root = cell.firstElementChild;
  if (root) {
    const rootWithoutContents = root.cloneNode(false) as HTMLElement;
    const rootMatch = defaultCellContentsForEachType.find((c) =>
      c.regexToIdentify.test(rootWithoutContents.outerHTML),
    );
    if (rootMatch) return rootMatch.id;
  }
  return defaultCellContentsForEachType.find((c) => c.regexToIdentify.test(cell.innerHTML))?.id;
}

export function getCurrentContentTypeId(cell: HTMLElement): string | undefined {
  return (
    cell.dataset.contentType || identifyContentTypeFromMarkup(cell) || defaultCellContentTypeId
  );
}

/** The content type a cell already carries: its data attribute, or the type its
 *  markup identifies, or undefined when there is nothing to go on. Unlike
 *  getCurrentContentTypeId this does NOT fall back to defaultCellContentTypeId,
 *  so an empty untyped cell reports undefined. This is the value
 *  setupContentsOfCell compares with targetType, so a caller that needs to know
 *  whether setupContentsOfCell will rebuild the cell (and therefore whether the
 *  host has to be told about the content it just created) must use this one: an
 *  empty untyped cell IS rebuilt when the default type is applied to it, even
 *  though getCurrentContentTypeId reports that type both before and after. */
export function getExistingContentTypeId(cell: HTMLElement): string | undefined {
  if (cell.dataset.contentType !== undefined) return cell.dataset.contentType;
  if (cell.children.length === 0) return undefined;
  return identifyContentTypeFromMarkup(cell);
}
export function setupContentsOfCell(
  cell: HTMLElement,
  targetType?: string,
  putInHistory: boolean = false,
  // Pass false when calling from inside a history entry: the change event's
  // contract is that handlers may run further table operations, which the
  // history manager refuses while an entry is open. The caller must then
  // dispatch kTableCellContentChangedEvent itself after the entry closes.
  notifyHost: boolean = true,
): HTMLElement | null {
  const table = cell.closest<HTMLElement>(".bloom-table");

  // First we figure out what is already there in the cell. (When the type has to
  // be guessed from the markup we don't set the data attribute, because that
  // would be a mutation.)
  const existingContentType = getExistingContentTypeId(cell);

  // if we were not given a content type to switch to and the cell is empty, fill it with the default content type
  if (!targetType && !existingContentType) {
    targetType = defaultCellContentTypeId;
  }
  // if we still don't have a target type, then we can't do anything with the cell.
  if (!targetType) {
    return (cell.firstChild as HTMLElement) || null;
  }

  // if the existing content type matches the requested one, do nothing
  if (existingContentType === targetType) {
    return (cell.firstChild as HTMLElement) || null;
  }

  const content = defaultCellContentsForEachType.find((c) => c.id === targetType);
  if (!content) {
    throw new Error(
      `Unknown content type: ${targetType}. Available types are: ${defaultCellContentsForEachType
        .map((c) => c.id)
        .join(", ")}`,
    );
  }

  // Set only when doIt has run all the way through. addHistoryEntry returns void
  // whether it ran the operation or not: it declines outright on a detached
  // table or while another operation is open, and it swallows a throw from the
  // operation (leaving the cell half-rebuilt). Without this flag we told the
  // host the cell now holds targetType in all three cases, and a host that
  // wires an editor onto the new content acted on DOM that was never built.
  let rebuiltCell = false;

  const doIt = () => {
    cell.dataset.contentType = targetType;
    cell.innerHTML = content.templateHtml;

    // if we just inserted a table, set each of its cells to the default content type
    if (targetType === "table") {
      const embeddedTable = cell.querySelector<HTMLElement>(".bloom-table");
      if (embeddedTable) {
        const tableCells = embeddedTable.querySelectorAll<HTMLElement>(".bloom-cell");
        tableCells.forEach((tableCell) => {
          tableCell.dataset.contentType = defaultCellContentTypeId;

          tableCell.innerHTML =
            defaultCellContentsForEachType.find((c) => c.id === defaultCellContentTypeId)
              ?.templateHtml || "!!!";
        });

        // Attach the embedded table to enable all table functionality
        attachTable(embeddedTable);
      }
      // set tabindex to -1 so that it's possible to focus the parent cell
      cell.tabIndex = -1;
    }

    // up until this point, we don't know if the contents fit our rule that there must be only one root element to the contents
    // so we check that now
    if (cell.children.length !== 1) {
      throw new Error(
        `Cell contents must have exactly one root element, but found ${cell.children.length} elements.`,
      );
    }

    rebuiltCell = true;
  };

  if (putInHistory && table) {
    tableHistoryManager.addHistoryEntry(
      table,
      `Change Cell from ${existingContentType} to ${targetType}`,
      doIt,
    );
  } else {
    doIt();
  }

  // Notify host apps that this cell's content was (re)initialized so they can
  // wire host-specific behavior onto the new content. Dispatched after any
  // history entry completes so handlers may safely run further table operations.
  // The event bubbles (and crosses shadow boundaries) when the cell is attached;
  // for cells created detached (e.g. new rows/columns) the host can re-scan on
  // the "tableHistoryUpdated" event instead.
  // Nothing to report if the rebuild did not actually happen.
  if (notifyHost && rebuiltCell) dispatchCellContentChanged(cell, targetType);

  // for testing purposes, return the child
  return (cell.firstChild as HTMLElement) || null;
}

/** Fire the content-changed notification for a cell. Callers that passed
 *  notifyHost=false to setupContentsOfCell use this to dispatch once their
 *  history entry has closed. */
export function dispatchCellContentChanged(cell: HTMLElement, contentType?: string): void {
  cell.dispatchEvent(
    new CustomEvent(kTableCellContentChangedEvent, {
      bubbles: true,
      composed: true,
      detail: { cell, contentType },
    }),
  );
}
