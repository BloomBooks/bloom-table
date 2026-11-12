// For tests: hand the library translations through setGetLocalizations, the
// way a host does, worked out per string by `translate` from its English and
// its id in tableUiStrings (or `ContentType.<type id>`).

import { setGetLocalizations } from "../host-localization";
import { kTableUiStringIdPrefix } from "../ui-strings";

/**
 * Install translations made by `translate` and wait until they are in force.
 * When `idsLookedUp` is given, it collects the id (without the prefix) of every
 * string the library looks up from then on.
 */
export async function translateForTests(
  translate: (english: string, id: string) => string,
  idsLookedUp?: Set<string>,
): Promise<void> {
  await setGetLocalizations(async (strings) => {
    const answer: Record<string, string> = {};
    for (const [id, english] of Object.entries(strings))
      answer[id] = translate(english, id.slice(kTableUiStringIdPrefix.length));
    if (!idsLookedUp) return answer;
    return new Proxy(answer, {
      get(target, key) {
        // Awaiting the answer looks for a `then` on it; that is not a lookup.
        if (typeof key === "string" && key.startsWith(kTableUiStringIdPrefix))
          idsLookedUp.add(key.slice(kTableUiStringIdPrefix.length));
        return target[key as string];
      },
    });
  });
}
