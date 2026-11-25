import {
  BENGALI_ANUSVARA,
  BENGALI_BLOCK_END,
  BENGALI_BLOCK_START,
  BENGALI_CHANDRABINDU,
  BENGALI_KHANDA_TA,
  BENGALI_NUKTA,
  BENGALI_VIRAMA,
  BENGALI_VISARGA,
  CAT_CONSONANT,
  CAT_DIGIT,
  CAT_INDEPENDENT_VOWEL,
  CAT_SIGN,
  CAT_VOWEL_SIGN,
  CONSONANT_MAP,
  DIGIT_MAP,
  INDEPENDENT_VOWEL_MAP,
  VOWEL_SIGN_MAP,
  getBengaliCategory
} from "./unicode-tables.js";

const CP_KA = 0x0995;
const CP_KHA = 0x0996;
const CP_GA = 0x0997;
const CP_GHA = 0x0998;
const CP_NGA = 0x0999;
const CP_CHA = 0x099a;
const CP_CHHA = 0x099b;
const CP_JA = 0x099c;
const CP_JHA = 0x099d;
const CP_NYA = 0x099e;
const CP_TA = 0x09a4;
const CP_DA = 0x09a6;
const CP_DHA = 0x09a7;
const CP_BA = 0x09ac;
const CP_BHA = 0x09ad;
const CP_MA = 0x09ae;
const CP_YA = 0x09af;
const CP_RA = 0x09b0;
const CP_SHA = 0x09b6;
const CP_SSA = 0x09b7;
const CP_SA = 0x09b8;
const CP_HA = 0x09b9;
const CP_YYA = 0x09df;

const CP_SIGN_I = 0x09bf;
const CP_SIGN_AA = 0x09be;
const CP_NA = 0x09a8;
const CP_SIGN_E = 0x09c7;

function endsWithAsciiVowel(str: string): boolean {
  if (str.length === 0) return false;
  const c = str.charCodeAt(str.length - 1);
  return c === 97 || c === 101 || c === 105 || c === 111 || c === 117;
}

interface SyllableUnit {
  readonly kind: "vowel" | "cluster" | "digit" | "other";
  readonly text: string;
  readonly consonants: number[]; // code points in cluster
  readonly vowelSignCp: number;  // 0 if none
  readonly hasAnusvara: boolean;
  readonly hasVisarga: boolean;
  readonly isKhandaTa: boolean;
  readonly isConjunct: boolean;
}

function isVelarStop(cp: number): boolean {
  return cp === CP_KA || cp === CP_KHA || cp === CP_GA || cp === CP_GHA;
}

function isPalatalStop(cp: number): boolean {
  return cp === CP_CHA || cp === CP_CHHA || cp === CP_JA || cp === CP_JHA;
}

function isBaPhalaTransparent(cp: number): boolean {
  return (
    cp === CP_SA ||
    cp === CP_SHA ||
    cp === CP_DA ||
    cp === CP_DHA ||
    cp === CP_JA ||
    cp === CP_TA
  );
}

/**
 * Parses a single normalized Bengali token into syllabic/phonotactic units.
 * Pure iterative O(n) scan with flat unit array.
 */
function parseUnits(word: string): SyllableUnit[] {
  const units: SyllableUnit[] = [];
  const len = word.length;
  let i = 0;

  while (i < len) {
    const cp = word.charCodeAt(i);
    const cat = getBengaliCategory(cp);

    if (cat === CAT_INDEPENDENT_VOWEL) {
      let hasAnusvara = false;
      let hasVisarga = false;
      i++;
      while (i < len && getBengaliCategory(word.charCodeAt(i)) === CAT_SIGN) {
        const s = word.charCodeAt(i);
        if (s === BENGALI_ANUSVARA) hasAnusvara = true;
        else if (s === BENGALI_VISARGA) hasVisarga = true;
        i++;
      }
      units.push({
        kind: "vowel",
        text: INDEPENDENT_VOWEL_MAP[cp - BENGALI_BLOCK_START] ?? "",
        consonants: [],
        vowelSignCp: 0,
        hasAnusvara,
        hasVisarga,
        isKhandaTa: false,
        isConjunct: false
      });
      continue;
    }

    if (cat === CAT_CONSONANT) {
      const consonants: number[] = [cp];
      let isKhandaTa = cp === BENGALI_KHANDA_TA;
      i++;

      // Skip stray nukta if any survived NFC
      if (i < len && word.charCodeAt(i) === BENGALI_NUKTA) {
        i++;
      }

      // Read conjunct chain: (virama + consonant)*
      while (i + 1 < len && word.charCodeAt(i) === BENGALI_VIRAMA) {
        const nextCp = word.charCodeAt(i + 1);
        if (getBengaliCategory(nextCp) === CAT_CONSONANT) {
          consonants.push(nextCp);
          isKhandaTa = false;
          i += 2;
          if (i < len && word.charCodeAt(i) === BENGALI_NUKTA) {
            i++;
          }
        } else {
          break;
        }
      }

      // Trailing virama with no following consonant suppresses inherent vowel (halant).
      let hasTrailingVirama = false;
      if (i < len && word.charCodeAt(i) === BENGALI_VIRAMA) {
        hasTrailingVirama = true;
        i++;
      }

      let vowelSignCp = 0;
      if (!hasTrailingVirama && i < len && getBengaliCategory(word.charCodeAt(i)) === CAT_VOWEL_SIGN) {
        vowelSignCp = word.charCodeAt(i);
        i++;
      }

      let hasAnusvara = false;
      let hasVisarga = false;
      while (i < len && getBengaliCategory(word.charCodeAt(i)) === CAT_SIGN) {
        const s = word.charCodeAt(i);
        if (s === BENGALI_ANUSVARA) hasAnusvara = true;
        else if (s === BENGALI_VISARGA) hasVisarga = true;
        else if (s === BENGALI_CHANDRABINDU) {
          // Nasalization marker; conventional BD transliteration omits or absorbs into dictionary.
        }
        i++;
      }

      units.push({
        kind: "cluster",
        text: "",
        consonants,
        vowelSignCp,
        hasAnusvara,
        hasVisarga,
        isKhandaTa: isKhandaTa || hasTrailingVirama,
        isConjunct: consonants.length > 1
      });
      continue;
    }

    if (cat === CAT_DIGIT) {
      units.push({
        kind: "digit",
        text: DIGIT_MAP[cp - BENGALI_BLOCK_START] ?? "",
        consonants: [],
        vowelSignCp: 0,
        hasAnusvara: false,
        hasVisarga: false,
        isKhandaTa: false,
        isConjunct: false
      });
      i++;
      continue;
    }

    // Standalone vowel sign or non-Bengali character inside token: preserve faithfully
    if (cat === CAT_VOWEL_SIGN) {
      units.push({
        kind: "vowel",
        text: VOWEL_SIGN_MAP[cp - BENGALI_BLOCK_START] ?? "",
        consonants: [],
        vowelSignCp: 0,
        hasAnusvara: false,
        hasVisarga: false,
        isKhandaTa: false,
        isConjunct: false
      });
      i++;
      continue;
    }

    if (cp >= BENGALI_BLOCK_START && cp <= BENGALI_BLOCK_END) {
      if (cp === BENGALI_ANUSVARA) {
        units.push({
          kind: "other",
          text: "ng",
          consonants: [],
          vowelSignCp: 0,
          hasAnusvara: false,
          hasVisarga: false,
          isKhandaTa: false,
          isConjunct: false
        });
      }
      // Stray virama / chandrabindu / visarga / nukta at unexpected boundary
      i++;
      continue;
    }

    const fullCp = word.codePointAt(i) ?? cp;
    const step = fullCp > 0xffff ? 2 : 1;
    units.push({
      kind: "other",
      text: word.slice(i, i + step),
      consonants: [],
      vowelSignCp: 0,
      hasAnusvara: false,
      hasVisarga: false,
      isKhandaTa: false,
      isConjunct: false
    });
    i += step;
  }

  return units;
}

function renderConsonantCluster(
  consonants: readonly number[],
  isInitial: boolean,
  hasVisargaAfter: boolean
): string {
  const len = consonants.length;

  // Single consonant
  if (len === 1) {
    const cp = consonants[0]!;
    if (cp === CP_BHA && !isInitial) {
      return "v";
    }
    const base = CONSONANT_MAP[cp - BENGALI_BLOCK_START] ?? "";
    return hasVisargaAfter && base.length > 0 ? base : base;
  }

  // Two-consonant special conjuncts
  if (len === 2) {
    const c1 = consonants[0]!;
    const c2 = consonants[1]!;

    // ক্ষ (ক + ষ)
    if (c1 === CP_KA && c2 === CP_SSA) {
      return isInitial ? "kh" : "ksh";
    }
    // জ্ঞ (জ + ঞ)
    if (c1 === CP_JA && c2 === CP_NYA) {
      return "gy";
    }
    // ঙ্গ (ঙ + গ) -> ng
    if (c1 === CP_NGA && c2 === CP_GA) {
      return "ng";
    }
    // ঙ্ক, ঙ্খ, ঙ্ঘ
    if (c1 === CP_NGA && isVelarStop(c2)) {
      return "n" + (CONSONANT_MAP[c2 - BENGALI_BLOCK_START] ?? "");
    }
    // ঞ্চ, ঞ্ছ, ঞ্জ, ঞ্ঝ
    if (c1 === CP_NYA && isPalatalStop(c2)) {
      return "n" + (CONSONANT_MAP[c2 - BENGALI_BLOCK_START] ?? "");
    }
    // শ্র (শ + র): word-initially sr (Srabon), medially shr (Ashraf)
    if (c1 === CP_SHA && c2 === CP_RA) {
      return isInitial ? "sr" : "shr";
    }
    // হ্ম (হ + ম) -> hm
    if (c1 === CP_HA && c2 === CP_MA) {
      return "hm";
    }
    // Reph (র + C2) -> r + C2 (with র্য -> ry)
    if (c1 === CP_RA) {
      const c2Str =
        c2 === CP_YA
          ? "y"
          : c2 === CP_BHA
            ? "bh"
            : (CONSONANT_MAP[c2 - BENGALI_BLOCK_START] ?? "");
      return "r" + c2Str;
    }
    // Ya-phala (C1 + য) -> C1 + y
    if (c2 === CP_YA) {
      const c1Str = c1 === CP_BHA && !isInitial ? "v" : (CONSONANT_MAP[c1 - BENGALI_BLOCK_START] ?? "");
      return c1Str + "y";
    }
    // Ba-phala (C1 + ব)
    if (c2 === CP_BA) {
      const c1Str = CONSONANT_MAP[c1 - BENGALI_BLOCK_START] ?? "";
      if (isBaPhalaTransparent(c1)) {
        return c1Str + "w";
      }
      return isInitial ? c1Str : c1Str + c1Str;
    }
    // Ra-phala (C1 + র) -> C1 + r
    if (c2 === CP_RA) {
      const c1Str = CONSONANT_MAP[c1 - BENGALI_BLOCK_START] ?? "";
      return c1Str + "r";
    }
  }

  // General multi-consonant cluster (3+ consonants, e.g., ন্দ্র, জ্জ্ব, ক্ষ্ম, স্ত্র)
  let out = "";
  for (let i = 0; i < len; i++) {
    const c = consonants[i]!;
    if (i === len - 1 && c === CP_YA) {
      out += "y";
    } else if (i === len - 1 && c === CP_BA) {
      const prev = consonants[i - 1]!;
      out += isBaPhalaTransparent(prev) ? "w" : (CONSONANT_MAP[prev - BENGALI_BLOCK_START] ?? "");
    } else if (i === 0 && c === CP_NGA && i + 1 < len && isVelarStop(consonants[i + 1]!)) {
      out += consonants[i + 1] === CP_GA ? "n" : "n";
    } else if (i === 0 && c === CP_NYA && i + 1 < len && isPalatalStop(consonants[i + 1]!)) {
      out += "n";
    } else if (c === CP_KA && i + 1 < len && consonants[i + 1] === CP_SSA) {
      out += i === 0 && isInitial ? "kh" : "ksh";
      i++; // consume ষে
    } else {
      out += CONSONANT_MAP[c - BENGALI_BLOCK_START] ?? "";
    }
  }
  return out;
}

/**
 * Context-aware deterministic Bengali personal name phonetic transliterator.
 * Operates synchronously in O(n) time without recursion or regex backtracking.
 */
export function transliteratePhonetic(word: string): string {
  if (word.length === 0) {
    return "";
  }

  const units = parseUnits(word);
  const count = units.length;
  let out = "";
  let prevHadVowel = false;

  for (let i = 0; i < count; i++) {
    const u = units[i]!;
    const isInitial = i === 0;
    const isFinal = i === count - 1;

    if (u.kind === "vowel") {
      out += u.text;
      if (u.hasAnusvara) {
        const nextU = i + 1 < count ? units[i + 1] : undefined;
        const nextC = nextU?.consonants[0];
        out += nextC !== undefined && isVelarStop(nextC) ? "n" : "ng";
      }
      prevHadVowel = true;
      continue;
    }

    if (u.kind === "digit" || u.kind === "other") {
      out += u.text;
      prevHadVowel = false;
      continue;
    }

    // Consonant cluster unit
    // Special glide: িয় + া -> "ia" (e.g. সাদিয়া -> Sadia, তানিয়া -> Tania)
    if (
      u.consonants.length === 1 &&
      u.consonants[0] === CP_YYA &&
      u.vowelSignCp === CP_SIGN_AA &&
      i > 0 &&
      units[i - 1]!.vowelSignCp === CP_SIGN_I
    ) {
      out += "a";
      prevHadVowel = true;
      continue;
    }

    let clusterText = renderConsonantCluster(u.consonants, isInitial, u.hasVisarga);

    // Conventional Bangladeshi female suffix: -ুন্নেছা / -ন্নেছা -> -unnessa / -nessa
    if (
      isFinal &&
      u.consonants.length === 1 &&
      u.consonants[0] === CP_CHHA &&
      u.vowelSignCp === CP_SIGN_AA &&
      i > 0
    ) {
      const prev = units[i - 1]!;
      if (
        prev.kind === "cluster" &&
        prev.vowelSignCp === CP_SIGN_E &&
        prev.consonants.length === 2 &&
        prev.consonants[0] === CP_NA &&
        prev.consonants[1] === CP_NA
      ) {
        clusterText = "ss";
      }
    }

    // Visarga medially doubles the next consonant (e.g. দুঃখ), or is silent at end
    if (u.hasVisarga && !isFinal) {
      const nextU = units[i + 1];
      if (nextU && nextU.kind === "cluster" && nextU.consonants.length > 0) {
        // Keep clean spelling without awkward doubling unless needed
      }
    }

    out += clusterText;

    if (u.vowelSignCp !== 0) {
      out += VOWEL_SIGN_MAP[u.vowelSignCp - BENGALI_BLOCK_START] ?? "";
      prevHadVowel = true;
    } else if (u.isKhandaTa) {
      prevHadVowel = false;
    } else if (u.hasAnusvara) {
      // e.g. স + ং + ... -> inherent vowel + anusvara
      out += "a";
      prevHadVowel = true;
    } else {
      // Decide whether inherent vowel 'a' is pronounced or suppressed
      let keepInherent = false;
      if (isInitial) {
        keepInherent = true;
      } else if (u.isConjunct) {
        keepInherent = true;
      } else if (isFinal) {
        keepInherent = false;
      } else if (!prevHadVowel) {
        keepInherent = true;
      } else {
        // Check if next unit is a conjunct (e.g. শ্রীমন্ত -> Srimanta) or a bare final single consonant.
        const nextU = units[i + 1]!;
        const nextIsConjunctOrBareFinal =
          nextU.kind === "cluster" &&
          (nextU.isConjunct || (i + 1 === count - 1 && nextU.vowelSignCp === 0));
        keepInherent = nextIsConjunctOrBareFinal;
      }

      if (keepInherent) {
        // Avoid double vowel if cluster somehow ended with vowel
        if (!endsWithAsciiVowel(out)) {
          out += "a";
        }
        prevHadVowel = true;
      } else {
        prevHadVowel = false;
      }
    }

    if (u.hasAnusvara) {
      const nextU = i + 1 < count ? units[i + 1] : undefined;
      const nextC = nextU?.consonants[0];
      out += nextC !== undefined && isVelarStop(nextC) ? "n" : "ng";
      prevHadVowel = false;
    }
  }

  return out;
}
