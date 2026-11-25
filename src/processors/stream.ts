import type { DictionaryStore } from "../dictionary/dictionary-store.js";
import { convertNameFast } from "../core/converter.js";

/**
 * Lazily streams converted names from any sync or async iterable without
 * collecting the dataset into memory. Preserves input order.
 */
export async function* convertStreamWithStore(
  source: Iterable<string> | AsyncIterable<string>,
  store: DictionaryStore
): AsyncGenerator<string> {
  if (
    source == null ||
    (typeof (source as Iterable<string>)[Symbol.iterator] !== "function" &&
      typeof (source as AsyncIterable<string>)[Symbol.asyncIterator] !== "function")
  ) {
    throw new TypeError("Expected source to be an Iterable or AsyncIterable");
  }

  for await (const name of source) {
    yield convertNameFast(name, store);
  }
}
