import { BENGALI_BLOCK_END, BENGALI_BLOCK_START } from "./unicode-tables.js";

const RE_ZERO_WIDTH = /[\u200B\u200E\u200F\uFEFF]/g;
const RE_KHANDA_TA_LEGACY = /\u09A4\u09CD\u200D/g;
const RE_JOINERS = /[\u200C\u200D]/g;
const RE_AA_LEGACY = /\u0985\u09BE/g;
const RE_DECOMPOSED_O = /\u09C7\u09BE/g;
const RE_DECOMPOSED_OU = /\u09C7\u09D7/g;
const RE_NUKTA_RRA = /\u09A1\u09BC/g;
const RE_NUKTA_RHA = /\u09A2\u09BC/g;
const RE_NUKTA_YYA = /\u09AF\u09BC/g;
const RE_APOSTROPHES = /[\u2018\u2019\u02BC]/g;
const RE_DASHES = /[\u2010\u2011\u2012\u2013\u2014]/g;
const RE_DANDA = /[\u0964\u0965]/g;
const RE_WHITESPACE = /\s+/g;

export interface NormalizedInput {
  readonly text: string;
  readonly isAsciiOnly: boolean;
  readonly hasBengali: boolean;
}

/**
 * Full normalization fallback for strings requiring NFC, nukta composition,
 * zero-width stripping, legacy keyboard repair, or whitespace collapse.
 */
function normalizeSlow(raw: string, hasNonAscii: boolean): string {
  if (!hasNonAscii) {
    return raw.trim().replace(RE_WHITESPACE, " ");
  }

  let s = raw;
  if (s.indexOf("\u200D") !== -1 || s.indexOf("\u200C") !== -1) {
    s = s.replace(RE_KHANDA_TA_LEGACY, "\u09CE").replace(RE_JOINERS, "");
  }
  if (
    s.indexOf("\u200B") !== -1 ||
    s.indexOf("\uFEFF") !== -1 ||
    s.indexOf("\u200E") !== -1 ||
    s.indexOf("\u200F") !== -1
  ) {
    s = s.replace(RE_ZERO_WIDTH, "");
  }

  s = s.normalize("NFC");

  // Compose nukta-consonant pairs excluded from Unicode NFC composition (ড়, ঢ়, য়).
  if (s.indexOf("\u09BC") !== -1) {
    s = s
      .replace(RE_NUKTA_RRA, "\u09DC")
      .replace(RE_NUKTA_RHA, "\u09DD")
      .replace(RE_NUKTA_YYA, "\u09DF");
  }

  if (s.indexOf("\u0985\u09BE") !== -1) {
    s = s.replace(RE_AA_LEGACY, "\u0986");
  }
  if (s.indexOf("\u09C7\u09BE") !== -1) {
    s = s.replace(RE_DECOMPOSED_O, "\u09CB");
  }
  if (s.indexOf("\u09C7\u09D7") !== -1) {
    s = s.replace(RE_DECOMPOSED_OU, "\u09CC");
  }

  if (
    s.indexOf("\u2018") !== -1 ||
    s.indexOf("\u2019") !== -1 ||
    s.indexOf("\u02BC") !== -1
  ) {
    s = s.replace(RE_APOSTROPHES, "'");
  }
  if (
    s.indexOf("\u2010") !== -1 ||
    s.indexOf("\u2011") !== -1 ||
    s.indexOf("\u2012") !== -1 ||
    s.indexOf("\u2013") !== -1 ||
    s.indexOf("\u2014") !== -1
  ) {
    s = s.replace(RE_DASHES, "-");
  }
  if (s.indexOf("\u0964") !== -1 || s.indexOf("\u0965") !== -1) {
    s = s.replace(RE_DANDA, " ");
  }

  return s.trim().replace(RE_WHITESPACE, " ");
}

export const FAST_PASSTHROUGH = 1;
export const FAST_BENGALI_READY = 2;
export const FAST_NEEDS_SLOW = 3;

/**
 * Inspects `raw` in a single linear pass with zero allocations.
 * - FAST_PASSTHROUGH: `raw` is already clean, single-spaced ASCII (return `raw` unchanged).
 * - FAST_BENGALI_READY: `raw` contains Bengali and is already clean NFC with single spaces.
 * - FAST_NEEDS_SLOW: requires `normalizeInputSlow`.
 */
export function inspectFastPath(raw: string): number {
  const len = raw.length;
  let hasBengali = false;
  let prevSpace = true;

  for (let i = 0; i < len; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 0x7f) {
      if (code === 0x20) {
        if (prevSpace) return FAST_NEEDS_SLOW;
        prevSpace = true;
      } else if (code <= 0x1f || code === 0x7f) {
        return FAST_NEEDS_SLOW;
      } else {
        prevSpace = false;
      }
    } else if (code >= BENGALI_BLOCK_START && code <= BENGALI_BLOCK_END) {
      hasBengali = true;
      prevSpace = false;
      if (code === 0x09bc || code === 0x09d7) {
        return FAST_NEEDS_SLOW;
      }
      if (code === 0x09be && i > 0) {
        const prev = raw.charCodeAt(i - 1);
        if (prev === 0x0985 || prev === 0x09c7) {
          return FAST_NEEDS_SLOW;
        }
      }
    } else {
      return FAST_NEEDS_SLOW;
    }
  }

  if (prevSpace) {
    return FAST_NEEDS_SLOW;
  }
  return hasBengali ? FAST_BENGALI_READY : FAST_PASSTHROUGH;
}

export function normalizeSlowForFastPath(raw: string): NormalizedInput {
  let hasNonAscii = false;
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) > 0x7f) {
      hasNonAscii = true;
      break;
    }
  }
  const text = normalizeSlow(raw, hasNonAscii);
  let isAsciiOnly = true;
  let hasBengali = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) {
      isAsciiOnly = false;
      if (code >= BENGALI_BLOCK_START && code <= BENGALI_BLOCK_END) {
        hasBengali = true;
      }
    }
  }
  return { text, isAsciiOnly, hasBengali };
}

export function normalizeInput(raw: string): NormalizedInput {
  const len = raw.length;
  if (len === 0) {
    return { text: "", isAsciiOnly: true, hasBengali: false };
  }

  const fast = inspectFastPath(raw);
  if (fast === FAST_PASSTHROUGH) {
    return { text: raw, isAsciiOnly: true, hasBengali: false };
  }
  if (fast === FAST_BENGALI_READY) {
    return { text: raw, isAsciiOnly: false, hasBengali: true };
  }
  return normalizeSlowForFastPath(raw);
}

export function normalizeDictionaryKey(key: string): string {
  return normalizeInput(key).text;
}
