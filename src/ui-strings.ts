// Every string the library's own DOM-built UI shows a user: the pills, the "+"
// buttons, the Row, Column, Table and Cell menus, and the Paint Format badge.
//
// A host translates them by handing the library a getLocalizations function
// (setGetLocalizations in host-localization.ts). The library asks it once for
// every string, by id with its English, and shows none of its UI until the
// answer arrives. Placeholders `{0}` and `{1}` are filled after translating, so
// a translation can put them wherever its grammar wants.

/**
 * The library's UI strings, by id. The ids are stable; a host translates each
 * under kTableUiStringIdPrefix + id (see ALL_TABLE_UI_STRINGS). The English is
 * what the library shows when the host has no translation.
 */
export const tableUiStrings = {
  // The pills that open the Column, Row and Table menus (tooltip and accessible name).
  "Pill.ColumnMenu": "Column menu",
  "Pill.RowMenu": "Row menu",
  "Pill.TableMenu": "Table menu",

  // The on-canvas "+" buttons. These names must differ from every menu command
  // that also adds a row or column ("Add Column Right" and the rest).
  "AddButton.ColumnAtRightEdge": "Add column at the right edge",
  "AddButton.RowAtBottomEdge": "Add row at the bottom edge",

  // Row menu
  "RowMenu.Heading": "Row",
  "RowMenu.AddAbove": "Add Row Above",
  "RowMenu.AddBelow": "Add Row Below",
  "RowMenu.MoveUp": "Move Row Up",
  "RowMenu.MoveDown": "Move Row Down",
  "RowMenu.Duplicate": "Duplicate Row",
  "RowMenu.Delete": "Delete Row",

  // Column menu
  "ColumnMenu.Heading": "Column",
  "ColumnMenu.AddLeft": "Add Column Left",
  "ColumnMenu.AddRight": "Add Column Right",
  "ColumnMenu.MoveLeft": "Move Left",
  "ColumnMenu.MoveRight": "Move Right",
  "ColumnMenu.Duplicate": "Duplicate Column",
  "ColumnMenu.Delete": "Delete Column",

  // The note at the foot of the Row and Column menus.
  "Menu.CellMenuNote": "Right click on a cell for Cell menu",

  // Table menu
  "TableMenu.Heading": "Table",
  "TableMenu.HorizontalSpace": "Horizontal space between cells",
  "TableMenu.VerticalSpace": "Vertical space between cells",
  "TableMenu.CopyProperties": "Copy properties",
  "TableMenu.PasteProperties": "Paste properties",
  "TableMenu.CopyTable": "Copy Table",
  "TableMenu.CutTable": "Cut Table",
  "TableMenu.DeleteTable": "Delete Table",

  // Cell menu
  "CellMenu.Heading": "Table Cell",
  "CellMenu.MergeRight": "Merge with cell to the right",
  "CellMenu.MergeDown": "Merge with cell below",
  "CellMenu.Split": "Split",

  // Paint format: the command in the Cell, Row and Column menus, and the badge
  // that ends the mode (its visible text and its tooltip).
  "PaintFormat.Command": "Paint format",
  "PaintFormat.End": "End format painting",
  "PaintFormat.EndWithShortcut": "End format painting (Esc)",

  // The Size control in the Row and Column menus. "mm" is the fixed-size
  // button's text while the row or column is not a fixed size.
  "Size.Label": "Size",
  "Size.Grow": "Grow",
  "Size.Hug": "Hug",
  "Size.Fixed": "Fixed size",
  "Size.FixedButton": "mm",

  // Measurements shown in readouts. {0} is a number.
  "Units.Pixels": "{0}px",
  "Units.Millimetres": "{0}mm",

  // The Content Type row and the built-in content types.
  "ContentType.Label": "Content Type",
  "ContentType.Text": "Text",
  "ContentType.Table": "Table",
  "ContentType.Image": "Image",
  "ContentType.Video": "Video",

  // The Format section
  "Format.Heading": "Format",
  "Format.Alignment": "Alignment",
  "Format.Align.Left": "Left",
  "Format.Align.Center": "Center",
  "Format.Align.Right": "Right",
  "Format.VAlign.Top": "Top",
  "Format.VAlign.Middle": "Middle",
  "Format.VAlign.Bottom": "Bottom",
  "Format.Padding.Text": "Padding between border and text",
  "Format.Padding.Image": "Padding between border and image",
  "Format.Padding.Video": "Padding between border and video",
  "Format.Padding.Table": "Padding between border and table",
  "Format.Padding.Cell": "Padding inside the cell",
  "Format.Fill": "Fill",
  "Format.Corners": "Corners",
  // {0} is the radius in pixels.
  "Format.CornerRadius": "Corner radius {0}",

  // The border tabs and the panel under them.
  "Border.ScopeTabs": "Which borders to change",
  "Border.Scope.All": "All",
  "Border.Scope.Outer": "Outer",
  "Border.Scope.Inner": "Inner",
  "Border.Scope.Brush": "Border Brush",
  "Border.ScopeCaption.All.Cell": "Every edge of this cell",
  "Border.ScopeCaption.All.Row": "Every edge in this row",
  "Border.ScopeCaption.All.Column": "Every edge in this column",
  "Border.ScopeCaption.All.Table": "Every edge in the table",
  "Border.ScopeCaption.Outer.Cell": "The four edges of this cell",
  "Border.ScopeCaption.Outer.Row": "The outside edges of this row",
  "Border.ScopeCaption.Outer.Column": "The outside edges of this column",
  "Border.ScopeCaption.Outer.Table": "The four outside edges of the table",
  "Border.ScopeCaption.Inner.Row": "Only the edges between cells in this row",
  "Border.ScopeCaption.Inner.Column": "Only the edges between cells in this column",
  "Border.ScopeCaption.Inner.Table": "Only the edges between cells",
  "Border.ScopeCaption.Brush":
    "Set the color, style and weight below, then click edges in the table",
  "Border.Color": "Border color",
  "Border.Style.Label": "Border Style",
  "Border.Style.None": "None",
  "Border.Style.Solid": "Solid",
  "Border.Style.Dashed": "Dashed",
  "Border.Style.Dotted": "Dotted",
  "Border.Style.Double": "Double",
  "Border.Weight.Label": "Border Weight",
  "Border.Weight.None": "0 (None)",
} as const;

/** The id of one of the library's UI strings, as a key of tableUiStrings. */
export type TableUiStringId = keyof typeof tableUiStrings;

/**
 * What the host's translation files call the library's strings: each key of
 * tableUiStrings with this in front, so `RowMenu.AddAbove` is
 * `EditTab.Table.RowMenu.AddAbove`.
 */
export const kTableUiStringIdPrefix = "EditTab.Table.";

/**
 * Every string the library's UI shows, by the id the host translates it under,
 * with its English. A host can use it to check that its translation files have
 * all of them.
 */
export const ALL_TABLE_UI_STRINGS: Record<string, string> = Object.fromEntries(
  Object.entries(tableUiStrings).map(([id, english]) => [kTableUiStringIdPrefix + id, english]),
);

/**
 * The host's way to translate strings, the same shape bloom-image-gallery and
 * bloom-ai-image-tools take: it is handed ids with their English and answers
 * with the text to show for each. An id missing from the answer shows in
 * English.
 */
export type GetLocalizations = (
  strings: Record<string, string>,
) => Promise<Record<string, string>>;

// The host's translations by id, or undefined while they are on their way. Empty
// until a host hands over a getLocalizations, so a host that never does gets the
// English at once.
let translations: Record<string, string> | undefined = {};
const translationsArrivedListeners: Array<() => void> = [];

/**
 * Library-internal: start waiting for the host's translations of `strings`
 * (ids as the host knows them, with their English). Until they arrive,
 * translationsAreReady is false and the library shows none of its UI, so the
 * user never sees the English first. See setGetLocalizations in
 * host-localization.ts, which is the public entry point.
 */
export function awaitTranslations(
  getLocalizations: GetLocalizations,
  strings: Record<string, string>,
): Promise<void> {
  translations = undefined;
  const arrived = (answer: Record<string, string>) => {
    translations = answer;
    for (const listener of [...translationsArrivedListeners]) listener();
  };
  return getLocalizations(strings).then(arrived, (error: unknown) => {
    // Better the English than no table UI at all; the host still hears of it.
    arrived({});
    throw error;
  });
}

/** Library-internal: false while the host's translations are on their way. */
export function translationsAreReady(): boolean {
  return translations !== undefined;
}

/**
 * Library-internal: run `listener` when the host's translations arrive, so a
 * module that keeps labelled elements between menus can relabel them and show
 * what it held back. Returns a function that stops listening.
 */
export function onTranslationsArrived(listener: () => void): () => void {
  translationsArrivedListeners.push(listener);
  return () => {
    const index = translationsArrivedListeners.indexOf(listener);
    if (index >= 0) translationsArrivedListeners.splice(index, 1);
  };
}

/** For tests: forget the host's translations and go back to English. */
export function resetTranslationsForTests(): void {
  translations = {};
}

/** Library-internal: one of the library's strings, localized, with {0}, {1}… filled. */
export function uiString(id: TableUiStringId, ...args: (string | number)[]): string {
  return fillPlaceholders(localizeLabel(tableUiStrings[id], id), args);
}

// The translation of an English label whose id (without kTableUiStringIdPrefix)
// is `id`, or the English when the host has none.
function localizeLabel(englishLabel: string, id: string): string {
  return translations?.[kTableUiStringIdPrefix + id] ?? englishLabel;
}

function fillPlaceholders(text: string, args: (string | number)[]): string {
  return text.replace(/\{(\d+)\}/g, (whole, index: string) => {
    const arg = args[Number(index)];
    return arg === undefined ? whole : String(arg);
  });
}

const kBuiltInContentTypeStringIds: Record<string, TableUiStringId> = {
  text: "ContentType.Text",
  table: "ContentType.Table",
  image: "ContentType.Image",
  video: "ContentType.Video",
};

/**
 * The id a content type's name is localized under: the catalog's id for a
 * built-in type, `ContentType.<type id>` for one the host registered.
 */
export function contentTypeStringId(contentTypeId: string): string {
  return kBuiltInContentTypeStringIds[contentTypeId] ?? `ContentType.${contentTypeId}`;
}

/**
 * Library-internal: the text to show for a label of the Cell menu model. Its
 * `labelId` may be outside tableUiStrings, as the name of a content type the
 * host registered is.
 */
export function shownLabel(item: { label: string; labelId: string }): string {
  return localizeLabel(item.label, item.labelId);
}
