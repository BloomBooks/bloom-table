// A stable, globally unique React key for a DOM element.
//
// Panels that mirror per-element state (e.g. BorderControl's edge selection)
// must remount when the element they edit changes. Keying on a per-table index
// is not enough: cell 3 of table A and cell 3 of table B share the key, so
// React reuses the instance and the old element's mirrored state leaks over.
// This hands out one id per element and remembers it in a WeakMap, so the key
// changes exactly when the element does — including when undo replaces a
// table's cells with fresh nodes.

const keys = new WeakMap<object, string>();
let nextId = 0;

export function elementKey(el: Element | null | undefined): string | undefined {
  if (!el) return undefined;
  let k = keys.get(el);
  if (!k) {
    k = `el-${++nextId}`;
    keys.set(el, k);
  }
  return k;
}
