import type { DictionaryStore } from "../dictionary/dictionary-store.js";
import type {
  ConversionMethod,
  ConversionResult,
  ReviewReason,
  UnsupportedCharacterInfo
} from "../types.js";
import { cleanFormattedOutput, formatEnglishToken } from "./formatter.js";
import {
  FAST_BENGALI_READY,
  FAST_PASSTHROUGH,
  inspectFastPath,
  normalizeInput,
  normalizeSlowForFastPath
} from "./normalizer.js";
import { transliteratePhonetic } from "./phonetic-engine.js";
import { segmentToken, splitWords } from "./tokenizer.js";
import { BENGALI_VISARGA, isBengaliCharCode } from "./unicode-tables.js";

function containsBengali(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (isBengaliCharCode(text.charCodeAt(i))) {
      return true;
    }
  }
  return false;
}

function isAllAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) {
      return false;
    }
  }
  return true;
}

/**
 * Splits a word like "মোঃআব্দুর" into ["মোঃ", "আব্দুর"] only if the prefix up to `ঃ`
 * is a known abbreviation in the dictionary.
 */
function trySplitAttachedAbbreviation(
  word: string,
  store: DictionaryStore
): [string, string] | null {
  const visargaIdx = word.indexOf(String.fromCharCode(BENGALI_VISARGA));
  if (visargaIdx <= 0 || visargaIdx >= word.length - 1) {
    return null;
  }
  const prefix = word.slice(0, visargaIdx + 1);
  if (store.getAbbreviation(prefix) !== undefined) {
    return [prefix, word.slice(visargaIdx + 1)];
  }
  return null;
}

function splitWordsWithAbbreviations(
  text: string,
  store: DictionaryStore
): string[] {
  const words = splitWords(text);
  if (text.indexOf("\u0983") === -1) {
    return words;
  }
  let expanded: string[] | null = null;
  for (let i = 0; i < words.length; i++) {
    const attached = trySplitAttachedAbbreviation(words[i]!, store);
    if (attached !== null) {
      if (expanded === null) {
        expanded = words.slice(0, i);
      }
      expanded.push(attached[0], attached[1]);
    } else if (expanded !== null) {
      expanded.push(words[i]!);
    }
  }
  return expanded ?? words;
}

function convertSubWordFast(word: string, store: DictionaryStore): string {
  const abbr = store.getAbbreviation(word);
  if (abbr !== undefined) {
    return abbr;
  }
  const tok = store.getToken(word);
  if (tok !== undefined) {
    return tok;
  }
  if (isAllAscii(word)) {
    return word;
  }

  const segments = segmentToken(word);
  let out = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.kind === "punct" || seg.kind === "other") {
      out += seg.text;
    } else if (isAllAscii(seg.text)) {
      out += seg.text;
    } else {
      const segAbbr = store.getAbbreviation(seg.text);
      if (segAbbr !== undefined) {
        out += segAbbr;
      } else {
        const segTok = store.getToken(seg.text);
        if (segTok !== undefined) {
          out += segTok;
        } else {
          out += formatEnglishToken(transliteratePhonetic(seg.text));
        }
      }
    }
  }
  return out;
}

/**
 * Hot-path synchronous single-name converter.
 * Allocates minimal intermediate data and avoids metadata tracking.
 */
export function convertNameFast(name: string, store: DictionaryStore): string {
  if (typeof name !== "string") {
    throw new TypeError("Expected name to be a string");
  }
  if (name.length === 0) {
    return "";
  }

  let text: string;
  const fastState = inspectFastPath(name);
  if (fastState === FAST_PASSTHROUGH) {
    return name;
  }
  if (fastState === FAST_BENGALI_READY) {
    text = name;
  } else {
    const normalized = normalizeSlowForFastPath(name);
    text = normalized.text;
    if (text.length === 0) {
      return "";
    }
    if (normalized.isAsciiOnly || !normalized.hasBengali) {
      return text;
    }
  }

  // Exact full-name or compound-name O(1) match before splitting tokens
  if (!store.hasCustomOverrides) {
    const exactFull = store.getFullName(text) ?? store.getCompound(text);
    if (exactFull !== undefined) {
      return exactFull;
    }
  } else {
    const exactCompound = store.getCompound(text);
    if (exactCompound !== undefined) {
      return exactCompound;
    }
  }

  // Single-word fast path (no spaces)
  if (text.indexOf(" ") === -1) {
    if (text.indexOf("\u0983") !== -1) {
      const attached = trySplitAttachedAbbreviation(text, store);
      if (attached !== null) {
        return (
          store.getAbbreviation(attached[0])! +
          " " +
          convertSubWordFast(attached[1], store)
        );
      }
    }
    return convertSubWordFast(text, store);
  }

  // Multi-word processing
  const words = splitWordsWithAbbreviations(text, store);

  const wordCount = words.length;
  const maxSpan = store.maxCompoundWords;
  let result = "";
  let idx = 0;

  while (idx < wordCount) {
    const word = words[idx]!;

    // Stage 2: Abbreviation
    const abbr = store.getAbbreviation(word);
    if (abbr !== undefined) {
      result = result.length === 0 ? abbr : result + " " + abbr;
      idx++;
      continue;
    }

    // Stage 4: Longest-match compound lookup
    let compoundHit: string | undefined;
    let compoundSpan = 0;
    const limit = Math.min(maxSpan, wordCount - idx);
    for (let span = limit; span >= 2; span--) {
      let phrase = word;
      for (let k = 1; k < span; k++) {
        phrase += " " + words[idx + k]!;
      }
      const hit = store.getCompound(phrase);
      if (hit !== undefined) {
        compoundHit = hit;
        compoundSpan = span;
        break;
      }
    }

    if (compoundHit !== undefined) {
      result = result.length === 0 ? compoundHit : result + " " + compoundHit;
      idx += compoundSpan;
      continue;
    }

    // Stage 5-7: Token dictionary or phonetic fallback + formatting
    const converted = convertSubWordFast(word, store);
    if (converted.length > 0) {
      result = result.length === 0 ? converted : result + " " + converted;
    }
    idx++;
  }

  return result;
}

function collectUnsupportedCharacters(text: string): UnsupportedCharacterInfo[] {
  const unsupported: UnsupportedCharacterInfo[] = [];
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)!;
    const step = cp > 0xffff ? 2 : 1;
    const isSupportedAscii = cp >= 0x20 && cp <= 0x7e;
    const isSupportedBengali = cp >= 0x0980 && cp <= 0x09ff;
    if (!isSupportedAscii && !isSupportedBengali) {
      unsupported.push({
        char: text.slice(i, i + step),
        codePoint: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
        index: i
      });
    }
    i += step;
  }
  return unsupported;
}

interface DetailedPart {
  readonly primary: string;
  readonly alts: readonly string[];
}

/**
 * Detailed conversion path separated from the fast path to preserve hot-path performance.
 */
export function convertNameDetailed(
  name: string,
  store: DictionaryStore
): ConversionResult {
  if (typeof name !== "string") {
    throw new TypeError("Expected name to be a string");
  }

  const normalized = normalizeInput(name);
  const text = normalized.text;
  const unsupportedCharacters = collectUnsupportedCharacters(text);
  const hasUnsupportedCharacters = unsupportedCharacters.length > 0;

  if (text.length === 0) {
    return {
      input: name,
      output: "",
      method: "passthrough",
      dictionaryCoverage: { matchedTokens: 0, totalTokens: 0, ratio: 0 },
      unsupportedCharacters,
      hasUnsupportedCharacters,
      alternatives: [],
      reviewIndicators: {
        needsReview: true,
        reasons: hasUnsupportedCharacters
          ? ["empty-input", "unsupported-characters"]
          : ["empty-input"]
      },
      dictionaryVersion: store.version,
      isOfficialVerified: false
    };
  }

  if (!normalized.hasBengali) {
    const reasons: ReviewReason[] = hasUnsupportedCharacters
      ? ["unsupported-characters"]
      : [];
    return {
      input: name,
      output: text,
      method: "passthrough",
      dictionaryCoverage: { matchedTokens: 0, totalTokens: 0, ratio: 0 },
      unsupportedCharacters,
      hasUnsupportedCharacters,
      alternatives: [],
      reviewIndicators: {
        needsReview: reasons.length > 0,
        reasons
      },
      dictionaryVersion: store.version,
      isOfficialVerified: false
    };
  }

  let matchedTokens = 0;
  let totalBengaliTokens = 0;
  let usedPhonetic = false;
  let usedDictionary = false;
  let hasEnglishTokens = false;

  const parts: DetailedPart[] = [];

  // Exact full-name hit (only when custom overrides are absent)
  const exactFull = !store.hasCustomOverrides
    ? store.getFullName(text)
    : store.getCompound(text);

  if (exactFull !== undefined) {
    const wordCount = splitWords(text).length;
    matchedTokens = wordCount;
    totalBengaliTokens = wordCount;
    usedDictionary = true;
    const alts = store.getAlternatives(text) ?? [];
    parts.push({ primary: exactFull, alts });
  } else {
    const words = splitWordsWithAbbreviations(text, store);

    let idx = 0;
    while (idx < words.length) {
      const word = words[idx]!;

      const abbr = store.getAbbreviation(word);
      if (abbr !== undefined) {
        matchedTokens++;
        totalBengaliTokens++;
        usedDictionary = true;
        parts.push({
          primary: abbr,
          alts: store.getAlternatives(word) ?? []
        });
        idx++;
        continue;
      }

      let compoundHit: string | undefined;
      let compoundPhrase = "";
      let compoundSpan = 0;
      const limit = Math.min(store.maxCompoundWords, words.length - idx);
      for (let span = limit; span >= 2; span--) {
        let phrase = word;
        for (let k = 1; k < span; k++) {
          phrase += " " + words[idx + k]!;
        }
        const hit = store.getCompound(phrase);
        if (hit !== undefined) {
          compoundHit = hit;
          compoundPhrase = phrase;
          compoundSpan = span;
          break;
        }
      }

      if (compoundHit !== undefined) {
        matchedTokens += compoundSpan;
        totalBengaliTokens += compoundSpan;
        usedDictionary = true;
        let compoundAlts = store.getAlternatives(compoundPhrase);
        if (!compoundAlts || compoundAlts.length === 0) {
          const derived: string[] = [];
          for (let k = 0; k < compoundSpan; k++) {
            const subWord = words[idx + k]!;
            const subPrimary = store.getToken(subWord);
            const subAlts = store.getAlternatives(subWord);
            if (subPrimary && subAlts && subAlts.length > 0 && compoundHit.includes(subPrimary)) {
              for (const sa of subAlts) {
                const altCompound: string = compoundHit.replace(subPrimary, sa);
                if (altCompound !== compoundHit && !derived.includes(altCompound)) {
                  derived.push(altCompound);
                }
              }
            }
          }
          compoundAlts = derived;
        }
        parts.push({
          primary: compoundHit,
          alts: compoundAlts
        });
        idx += compoundSpan;
        continue;
      }

      // Single word or segmented word
      const directTok = store.getToken(word);
      if (directTok !== undefined) {
        matchedTokens++;
        totalBengaliTokens++;
        usedDictionary = true;
        parts.push({
          primary: directTok,
          alts: store.getAlternatives(word) ?? []
        });
        idx++;
        continue;
      }

      if (isAllAscii(word)) {
        hasEnglishTokens = true;
        parts.push({ primary: word, alts: [] });
        idx++;
        continue;
      }

      const segments = segmentToken(word);
      let segOut = "";
      const segAlts: string[] = [];
      let wordHasBengali = false;
      let wordMatchedAll = true;
      let wordMatchedAny = false;

      for (const seg of segments) {
        if (seg.kind === "punct" || seg.kind === "other") {
          segOut += seg.text;
        } else if (isAllAscii(seg.text)) {
          hasEnglishTokens = true;
          segOut += seg.text;
        } else if (containsBengali(seg.text)) {
          wordHasBengali = true;
          const segAbbr = store.getAbbreviation(seg.text);
          if (segAbbr !== undefined) {
            usedDictionary = true;
            wordMatchedAny = true;
            segOut += segAbbr;
          } else {
            const segTok = store.getToken(seg.text);
            if (segTok !== undefined) {
              usedDictionary = true;
              wordMatchedAny = true;
              const altsForSeg = store.getAlternatives(seg.text);
              if (altsForSeg && altsForSeg.length > 0 && segOut.length === 0) {
                for (const a of altsForSeg) segAlts.push(a);
              }
              segOut += segTok;
            } else {
              wordMatchedAll = false;
              usedPhonetic = true;
              segOut += formatEnglishToken(transliteratePhonetic(seg.text));
            }
          }
        } else {
          segOut += seg.text;
        }
      }

      if (wordHasBengali) {
        totalBengaliTokens++;
        if (wordMatchedAll && wordMatchedAny) {
          matchedTokens++;
        }
      }

      parts.push({ primary: segOut, alts: segAlts });
      idx++;
    }
  }

  const output = cleanFormattedOutput(parts.map((p) => p.primary).join(" "));

  // Generate clean full-name alternatives from per-part alternatives (capped to avoid combinatorial explosion)
  const alternatives: string[] = [];
  const seenAlt = new Set<string>([output]);
  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const part = parts[pIdx]!;
    for (const altVal of part.alts) {
      const variantTokens = parts.map((p, j) => (j === pIdx ? altVal : p.primary));
      const candidate = cleanFormattedOutput(variantTokens.join(" "));
      if (candidate.length > 0 && !seenAlt.has(candidate)) {
        seenAlt.add(candidate);
        alternatives.push(candidate);
      }
    }
  }

  let method: ConversionMethod;
  if (usedDictionary && !usedPhonetic && !hasEnglishTokens) {
    method = "dictionary";
  } else if (!usedDictionary && usedPhonetic && !hasEnglishTokens) {
    method = "phonetic";
  } else if (usedDictionary || usedPhonetic) {
    method = "mixed";
  } else {
    method = "passthrough";
  }

  const reasons: ReviewReason[] = [];
  if (usedPhonetic) reasons.push("phonetic-fallback");
  if (hasUnsupportedCharacters) reasons.push("unsupported-characters");
  if (alternatives.length > 0) reasons.push("multiple-conventional-spellings");
  if (hasEnglishTokens) reasons.push("mixed-script");

  const ratio =
    totalBengaliTokens > 0
      ? Math.round((matchedTokens / totalBengaliTokens) * 10000) / 10000
      : 0;

  return {
    input: name,
    output,
    method,
    dictionaryCoverage: {
      matchedTokens,
      totalTokens: totalBengaliTokens,
      ratio
    },
    unsupportedCharacters,
    hasUnsupportedCharacters,
    alternatives,
    reviewIndicators: {
      needsReview: reasons.length > 0,
      reasons
    },
    dictionaryVersion: store.version,
    isOfficialVerified: false
  };
}
