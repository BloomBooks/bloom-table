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
    templateHtml: `<div class='table' data-column-widths='fill,fill' data-row-heights='fill,fill'>
            <div class='cell' data-content-type='text'></div>
            <div class='cell' data-content-type='text'></div>
            <div class='cell' data-content-type='text'></div>
            <div class='cell' data-content-type='text'></div>
        </div>`,
    regexToIdentify: /<div[^>]*class=['"][^'"]*table[^'"]*['"][^>]*>/,
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

export function setDefaultCellContentTypeId(id: string): void {
  defaultCellContentTypeId = id;
}

export function getDefaultCellContentTypeId(): string {
  return defaultCellContentTypeId;
}

export function getCurrentContentTypeId(cell: HTMLElement): string | undefined {
  return (
    cell.dataset.contentType /* use regex to identify */ ||
    defaultCellContentsForEachType.find((c) => c.regexToIdentify.test(cell.innerHTML))?.id ||
    defaultCellContentTypeId
  );
}
export function setupContentsOfCell(
  cell: HTMLElement,
  targetType?: string,
  putInHistory: boolean = false,
): HTMLElement | null {
  const table = cell.closest<HTMLElement>(".table");

  // First we figure out what is already there in the cell.
  let existingContentType = cell.dataset.contentType;
  if (existingContentType === undefined && cell.children.length > 0) {
    // see if we can identify the content type from the cell's contents
    const content = defaultCellContentsForEachType.find((c) =>
      c.regexToIdentify.test(cell.innerHTML),
    );
    if (content) {
      existingContentType = content.id; // if we found a match, use that as the existing content type
      // We don't set the data attribute here because it would be a mutation.
    }
  }

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

  const doIt = () => {
    cell.dataset.contentType = targetType;
    cell.innerHTML = content.templateHtml;

    // if we just inserted a table, set each of its cells to the default content type
    if (targetType === "table") {
      const embeddedTable = cell.querySelector<HTMLElement>(".table");
      if (embeddedTable) {
        const tableCells = embeddedTable.querySelectorAll<HTMLElement>(".cell");
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
  cell.dispatchEvent(
    new CustomEvent(kTableCellContentChangedEvent, {
      bubbles: true,
      composed: true,
      detail: { cell, contentType: targetType },
    }),
  );

  // for testing purposes, return the child
  return (cell.firstChild as HTMLElement) || null;
}
