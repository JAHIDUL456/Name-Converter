import { normalizeDictionaryKey } from "../core/normalizer.js";
import type { ConverterOptions, DictionaryEntryValue } from "../types.js";
import {
  ABBREVIATIONS_ENTRIES,
  ALTERNATIVES_ENTRIES,
  COMPOUNDS_ENTRIES,
  DICTIONARY_METADATA,
  FULL_NAMES_ENTRIES,
  TOKENS_ENTRIES
} from "./compiled-data.js";

export interface DictionaryStore {
  readonly version: string;
  readonly maxCompoundWords: number;
  readonly hasCustomOverrides: boolean;
  getAbbreviation(key: string): string | undefined;
  getFullName(key: string): string | undefined;
  getCompound(key: string): string | undefined;
  getToken(key: string): string | undefined;
  getAlternatives(key: string): readonly string[] | undefined;
}

// Module-level singleton base maps initialized once per module load.
const BASE_ABBREVIATIONS = new Map<string, string>(ABBREVIATIONS_ENTRIES);
const BASE_FULL_NAMES = new Map<string, string>(FULL_NAMES_ENTRIES);
const BASE_COMPOUNDS = new Map<string, string>(COMPOUNDS_ENTRIES);
const BASE_TOKENS = new Map<string, string>(TOKENS_ENTRIES);
const BASE_ALTERNATIVES = new Map<string, readonly string[]>(ALTERNATIVES_ENTRIES);

export const DEFAULT_DICTIONARY_STORE: DictionaryStore = {
  version: DICTIONARY_METADATA.version,
  maxCompoundWords: DICTIONARY_METADATA.maxCompoundWords,
  hasCustomOverrides: false,
  getAbbreviation: (key: string) => BASE_ABBREVIATIONS.get(key),
  getFullName: (key: string) => BASE_FULL_NAMES.get(key),
  getCompound: (key: string) => BASE_COMPOUNDS.get(key),
  getToken: (key: string) => BASE_TOKENS.get(key),
  getAlternatives: (key: string) => BASE_ALTERNATIVES.get(key)
};

function ingestCustomEntries(
  source: Readonly<Record<string, DictionaryEntryValue>> | undefined,
  singleMap: Map<string, string>,
  multiMap: Map<string, string>,
  altMap: Map<string, readonly string[]>,
  currentMaxWords: number,
  fieldName: string
): number {
  if (source === undefined) {
    return currentMaxWords;
  }
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError(`Expected options.${fieldName} to be a plain object`);
  }
  let maxWords = currentMaxWords;
  for (const rawKey of Object.keys(source)) {
    if (
      rawKey === "__proto__" ||
      rawKey === "constructor" ||
      rawKey === "prototype"
    ) {
      continue;
    }
    const rawVal = source[rawKey];
    if (rawVal === undefined) continue;
    const key = normalizeDictionaryKey(rawKey);
    if (key.length === 0) continue;

    let en: string;
    let alt: readonly string[] | undefined;
    if (typeof rawVal === "string") {
      en = rawVal.trim();
    } else if (rawVal !== null && typeof rawVal === "object" && !Array.isArray(rawVal)) {
      if (typeof rawVal.en !== "string") {
        throw new TypeError(
          `Invalid entry for "${rawKey}" in options.${fieldName}: expected string "en"`
        );
      }
      en = rawVal.en.trim();
      if (rawVal.alt !== undefined) {
        if (!Array.isArray(rawVal.alt)) {
          throw new TypeError(
            `Invalid entry for "${rawKey}" in options.${fieldName}: expected array "alt"`
          );
        }
        for (const item of rawVal.alt) {
          if (typeof item !== "string") {
            throw new TypeError(
              `Invalid alternative in "${rawKey}" in options.${fieldName}: expected string`
            );
          }
        }
        alt = rawVal.alt;
      }
    } else {
      throw new TypeError(
        `Invalid entry for "${rawKey}" in options.${fieldName}: expected string or { en, alt? }`
      );
    }
    if (en.length === 0) continue;

    if (key.includes(" ")) {
      multiMap.set(key, en);
      const wordCount = key.split(" ").length;
      if (wordCount > maxWords) {
        maxWords = wordCount;
      }
    } else {
      singleMap.set(key, en);
    }

    if (alt && alt.length > 0) {
      altMap.set(
        key,
        alt.map((a) => a.trim()).filter((a) => a.length > 0 && a !== en)
      );
    }
  }
  return maxWords;
}

/**
 * Builds a layered DictionaryStore that checks user overrides in O(1) before falling
 * back to the shared base maps—zero copying of base dictionary entries.
 */
export function createDictionaryStore(options?: ConverterOptions): DictionaryStore {
  if (options === undefined) {
    return DEFAULT_DICTIONARY_STORE;
  }
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Expected options to be an object");
  }
  if (!options.dictionary && !options.abbreviations && !options.compounds) {
    return DEFAULT_DICTIONARY_STORE;
  }

  const customAbbr = new Map<string, string>();
  const customTokens = new Map<string, string>();
  const customCompounds = new Map<string, string>();
  const customAlts = new Map<string, readonly string[]>();

  let maxCompoundWords = DICTIONARY_METADATA.maxCompoundWords;

  maxCompoundWords = ingestCustomEntries(
    options.abbreviations,
    customAbbr,
    customCompounds,
    customAlts,
    maxCompoundWords,
    "abbreviations"
  );
  maxCompoundWords = ingestCustomEntries(
    options.compounds,
    customTokens,
    customCompounds,
    customAlts,
    maxCompoundWords,
    "compounds"
  );
  maxCompoundWords = ingestCustomEntries(
    options.dictionary,
    customTokens,
    customCompounds,
    customAlts,
    maxCompoundWords,
    "dictionary"
  );

  const hasCustom =
    customAbbr.size > 0 || customTokens.size > 0 || customCompounds.size > 0;

  if (!hasCustom) {
    return DEFAULT_DICTIONARY_STORE;
  }

  return {
    version: `${DICTIONARY_METADATA.version}+custom`,
    maxCompoundWords,
    hasCustomOverrides: true,
    getAbbreviation: (key: string) =>
      customAbbr.get(key) ?? BASE_ABBREVIATIONS.get(key),
    getFullName: (key: string) =>
      customCompounds.get(key) ?? BASE_FULL_NAMES.get(key),
    getCompound: (key: string) =>
      customCompounds.get(key) ?? BASE_COMPOUNDS.get(key),
    getToken: (key: string) =>
      customTokens.get(key) ?? BASE_TOKENS.get(key),
    getAlternatives: (key: string) =>
      customAlts.get(key) ?? BASE_ALTERNATIVES.get(key)
  };
}
