// English output formatting and validation utilities.

const RE_ASCII_LOWER = /^[a-z]+$/;

/**
 * Formats a transliterated token in conventional Title Case while preserving
 * hyphenated parts (e.g. "al-amin" -> "Al-Amin") and apostrophe segments.
 */
export function formatEnglishToken(token: string): string {
  const len = token.length;
  if (len === 0) {
    return "";
  }

  // Fast path for simple lowercase ASCII word without hyphens/apostrophes
  if (RE_ASCII_LOWER.test(token)) {
    return token[0]!.toUpperCase() + token.slice(1);
  }

  let out = "";
  let capNext = true;
  for (let i = 0; i < len; i++) {
    const ch = token[i]!;
    const code = token.charCodeAt(i);
    if (code >= 97 && code <= 122) {
      out += capNext ? ch.toUpperCase() : ch;
      capNext = false;
    } else if (code >= 65 && code <= 90) {
      out += capNext ? ch : ch.toLowerCase();
      capNext = false;
    } else if (ch === "-" || ch === ".") {
      out += ch;
      capNext = true;
    } else if (ch === "'") {
      out += ch;
      // Only capitalize after apostrophe if preceded by single letter like O'Brien
      capNext = i === 1;
    } else {
      out += ch;
      capNext = false;
    }
  }
  return out;
}

export function cleanFormattedOutput(text: string): string {
  if (text.length === 0) {
    return "";
  }
  return text.replace(/\s+/g, " ").trim();
}
