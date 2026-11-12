// The host's translations of the library's UI. Its own module because the
// strings it asks for include the names of the content types the host
// registered, and cell-contents.ts already imports ui-strings.ts.

import { defaultCellContentsForEachType } from "./cell-contents";
import {
  ALL_TABLE_UI_STRINGS,
  awaitTranslations,
  contentTypeStringId,
  kTableUiStringIdPrefix,
  type GetLocalizations,
} from "./ui-strings";

/**
 * Translate the library's UI through the host. The library calls
 * `getLocalizations` once, with every string it shows (ALL_TABLE_UI_STRINGS)
 * plus the name of each content type the host has registered by then, under
 * `EditTab.Table.ContentType.<type id>`. Until the answer arrives the library
 * shows no chrome and opens no Cell menu, so the user never sees its English
 * change into their language; a pointer already resting on a table gets the
 * chrome as soon as it does. Call it once, after registering content types.
 * The returned promise settles when the translations are in force.
 */
export function setGetLocalizations(getLocalizations: GetLocalizations): Promise<void> {
  const strings = { ...ALL_TABLE_UI_STRINGS };
  for (const type of defaultCellContentsForEachType) {
    const id = kTableUiStringIdPrefix + contentTypeStringId(type.id);
    if (!(id in strings)) strings[id] = type.englishName;
  }
  return awaitTranslations(getLocalizations, strings);
}
