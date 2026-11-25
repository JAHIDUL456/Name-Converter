import { convertNameDetailed, convertNameFast } from "./core/converter.js";
import {
  DEFAULT_DICTIONARY_STORE,
  createDictionaryStore
} from "./dictionary/dictionary-store.js";
import { convertBulkWithStore } from "./processors/bulk.js";
import { convertStreamWithStore } from "./processors/stream.js";
import type {
  ConversionMethod,
  ConversionResult,
  ConverterOptions,
  DictionaryCoverage,
  DictionaryEntryValue,
  NameConverter,
  ReviewIndicators,
  ReviewReason,
  UnsupportedCharacterInfo
} from "./types.js";

export type {
  ConversionMethod,
  ConversionResult,
  ConverterOptions,
  DictionaryCoverage,
  DictionaryEntryValue,
  NameConverter,
  ReviewIndicators,
  ReviewReason,
  UnsupportedCharacterInfo
};

export function createConverter(options?: ConverterOptions): NameConverter {
  const store = createDictionaryStore(options);
  return {
    convert(name: string): string {
      return convertNameFast(name, store);
    },
    convertBulk(names: readonly string[]): string[] {
      return convertBulkWithStore(names, store);
    },
    convertDetailed(name: string): ConversionResult {
      return convertNameDetailed(name, store);
    },
    convertStream(
      source: Iterable<string> | AsyncIterable<string>
    ): AsyncGenerator<string> {
      return convertStreamWithStore(source, store);
    }
  };
}

export function convert(name: string): string {
  return convertNameFast(name, DEFAULT_DICTIONARY_STORE);
}

export function convertBulk(names: readonly string[]): string[] {
  return convertBulkWithStore(names, DEFAULT_DICTIONARY_STORE);
}

export function convertDetailed(name: string): ConversionResult {
  return convertNameDetailed(name, DEFAULT_DICTIONARY_STORE);
}

export function convertStream(
  source: Iterable<string> | AsyncIterable<string>
): AsyncGenerator<string> {
  return convertStreamWithStore(source, DEFAULT_DICTIONARY_STORE);
}
