import type { DictionaryStore } from "../dictionary/dictionary-store.js";
import { convertNameFast } from "../core/converter.js";

/**
 * Converts a batch of names synchronously with a preallocated output array,
 * preserving exact input order.
 */
export function convertBulkWithStore(
  names: readonly string[],
  store: DictionaryStore
): string[] {
  if (!Array.isArray(names)) {
    throw new TypeError("Expected names to be an array of strings");
  }
  const len = names.length;
  const out = new Array<string>(len);
  for (let i = 0; i < len; i++) {
    out[i] = convertNameFast(names[i]!, store);
  }
  return out;
}
