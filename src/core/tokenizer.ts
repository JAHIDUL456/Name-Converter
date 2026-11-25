// Lightweight, non-recursive tokenizer for Bengali, English, punctuation, and unsupported chars.

export interface Segment {
  readonly text: string;
  readonly kind: "word" | "space" | "punct" | "other";
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function isBengaliCode(code: number): boolean {
  return code >= 0x0980 && code <= 0x09ff;
}

function isBengaliDigit(code: number): boolean {
  return code >= 0x09e6 && code <= 0x09ef;
}

/**
 * Splits normalized input into space-delimited tokens for fast dictionary matching.
 * Avoids regex allocations on the hot path.
 */
export function splitWords(normalized: string): string[] {
  const words: string[] = [];
  let start = 0;
  const len = normalized.length;
  for (let i = 0; i <= len; i++) {
    if (i === len || normalized.charCodeAt(i) === 32) {
      if (i > start) {
        words.push(normalized.slice(start, i));
      }
      start = i + 1;
    }
  }
  return words;
}

/**
 * Splits an individual space-free token into sub-segments (e.g. hyphenated parts,
 * trailing punctuation, abbreviations with `ঃ`/`:`/`.`, or mixed scripts).
 */
export function segmentToken(token: string): Segment[] {
  const segments: Segment[] = [];
  const len = token.length;
  let i = 0;

  while (i < len) {
    const code = token.charCodeAt(i);

    // Bengali word run (include internal visarga only if at end of abbreviation like মোঃ or ডঃ)
    if (isBengaliCode(code) && !isBengaliDigit(code)) {
      const start = i;
      i++;
      while (i < len) {
        const c = token.charCodeAt(i);
        if (isBengaliCode(c) && !isBengaliDigit(c)) {
          i++;
        } else if ((c === 58 || c === 46) && i === len - 1) {
          // Trailing ASCII ':' or '.' attached to Bengali token (e.g. মো:, মো.)
          i++;
        } else {
          break;
        }
      }
      segments.push({ text: token.slice(start, i), kind: "word" });
      continue;
    }

    // ASCII word run (letters/digits/internal apostrophe)
    if (isAsciiLetter(code) || isAsciiDigit(code)) {
      const start = i;
      i++;
      while (i < len) {
        const c = token.charCodeAt(i);
        if (isAsciiLetter(c) || isAsciiDigit(c) || (c === 39 && i + 1 < len && isAsciiLetter(token.charCodeAt(i + 1)))) {
          i++;
        } else {
          break;
        }
      }
      segments.push({ text: token.slice(start, i), kind: "word" });
      continue;
    }

    // Bengali digits run
    if (isBengaliDigit(code)) {
      const start = i;
      i++;
      while (i < len && isBengaliDigit(token.charCodeAt(i))) {
        i++;
      }
      segments.push({ text: token.slice(start, i), kind: "word" });
      continue;
    }

    // Known safe punctuation: - . , : ' / ( )
    if (
      code === 45 ||
      code === 46 ||
      code === 44 ||
      code === 58 ||
      code === 39 ||
      code === 47 ||
      code === 40 ||
      code === 41
    ) {
      segments.push({ text: token[i] ?? "", kind: "punct" });
      i++;
      continue;
    }

    // Any other non-Bengali, non-ASCII character (e.g. Arabic/Devanagari/emoji/symbols):
    // preserve faithfully and mark as `other` so detailed mode can report it.
    const cp = token.codePointAt(i) ?? code;
    const step = cp > 0xffff ? 2 : 1;
    segments.push({ text: token.slice(i, i + step), kind: "other" });
    i += step;
  }

  return segments;
}
