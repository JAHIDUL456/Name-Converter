// Precompiled Bengali Unicode block (U+0980..U+09FF) lookup tables.
// Indexed by (codePoint - 0x0980) for O(1) classification and zero heap allocations.

export const BENGALI_BLOCK_START = 0x0980;
export const BENGALI_BLOCK_END = 0x09ff;
export const BENGALI_VIRAMA = 0x09cd;
export const BENGALI_NUKTA = 0x09bc;
export const BENGALI_ANUSVARA = 0x0982;
export const BENGALI_VISARGA = 0x0983;
export const BENGALI_CHANDRABINDU = 0x0981;
export const BENGALI_KHANDA_TA = 0x09ce;

export const CAT_OTHER = 0;
export const CAT_INDEPENDENT_VOWEL = 1;
export const CAT_CONSONANT = 2;
export const CAT_VOWEL_SIGN = 3;
export const CAT_VIRAMA = 4;
export const CAT_SIGN = 5;
export const CAT_DIGIT = 6;
export const CAT_PUNCT = 7;

export const BENGALI_CATEGORY = new Uint8Array(128);
export const INDEPENDENT_VOWEL_MAP: readonly string[] = (() => {
  const arr = new Array<string>(128).fill("");
  const set = (cp: number, val: string): void => {
    const idx = cp - BENGALI_BLOCK_START;
    BENGALI_CATEGORY[idx] = CAT_INDEPENDENT_VOWEL;
    arr[idx] = val;
  };
  set(0x0985, "a");  // অ
  set(0x0986, "a");  // আ
  set(0x0987, "i");  // ই
  set(0x0988, "i");  // ঈ
  set(0x0989, "u");  // উ
  set(0x098a, "u");  // ঊ
  set(0x098b, "ri"); // ঋ
  set(0x098c, "li"); // ঌ
  set(0x098f, "e");  // এ
  set(0x0990, "oi"); // ঐ
  set(0x0993, "o");  // ও
  set(0x0994, "ou"); // ঔ
  set(0x09e0, "ri"); // ৠ
  set(0x09e1, "li"); // ৡ
  return arr;
})();

export const VOWEL_SIGN_MAP: readonly string[] = (() => {
  const arr = new Array<string>(128).fill("");
  const set = (cp: number, val: string): void => {
    const idx = cp - BENGALI_BLOCK_START;
    BENGALI_CATEGORY[idx] = CAT_VOWEL_SIGN;
    arr[idx] = val;
  };
  set(0x09be, "a");  // া
  set(0x09bf, "i");  // ি
  set(0x09c0, "i");  // ী
  set(0x09c1, "u");  // ু
  set(0x09c2, "u");  // ূ
  set(0x09c3, "ri"); // ৃ
  set(0x09c4, "ri"); // ৄ
  set(0x09c7, "e");  // ে
  set(0x09c8, "ai"); // ৈ
  set(0x09cb, "o");  // ো
  set(0x09cc, "ou"); // ৌ
  set(0x09d7, "ou"); // ৗ (AU length mark)
  set(0x09e2, "li"); // ৢ
  set(0x09e3, "li"); // ৣ
  return arr;
})();

export const CONSONANT_MAP: readonly string[] = (() => {
  const arr = new Array<string>(128).fill("");
  const set = (cp: number, val: string): void => {
    const idx = cp - BENGALI_BLOCK_START;
    BENGALI_CATEGORY[idx] = CAT_CONSONANT;
    arr[idx] = val;
  };
  set(0x0995, "k");   // ক
  set(0x0996, "kh");  // খ
  set(0x0997, "g");   // গ
  set(0x0998, "gh");  // ঘ
  set(0x0999, "ng");  // ঙ
  set(0x099a, "ch");  // চ
  set(0x099b, "chh"); // ছ
  set(0x099c, "j");   // জ
  set(0x099d, "jh");  // ঝ
  set(0x099e, "n");   // ঞ
  set(0x099f, "t");   // ট
  set(0x09a0, "th");  // ঠ
  set(0x09a1, "d");   // ড
  set(0x09a2, "dh");  // ঢ
  set(0x09a3, "n");   // ণ
  set(0x09a4, "t");   // ত
  set(0x09a5, "th");  // থ
  set(0x09a6, "d");   // দ
  set(0x09a7, "dh");  // ধ
  set(0x09a8, "n");   // ন
  set(0x09aa, "p");   // প
  set(0x09ab, "f");   // ফ (conventional BD personal-name spelling)
  set(0x09ac, "b");   // ব
  set(0x09ad, "bh");  // ভ
  set(0x09ae, "m");   // ম
  set(0x09af, "j");   // য
  set(0x09b0, "r");   // র
  set(0x09b2, "l");   // ল
  set(0x09b6, "sh");  // শ
  set(0x09b7, "sh");  // ষ
  set(0x09b8, "s");   // স
  set(0x09b9, "h");   // হ
  set(0x09ce, "t");   // ৎ
  set(0x09dc, "r");   // ড়
  set(0x09dd, "rh");  // ঢ়
  set(0x09df, "y");   // য়
  set(0x09f0, "r");   // ৰ (Assamese/historical Bengali Ra)
  set(0x09f1, "w");   // ৱ (Assamese/historical Bengali Wa)
  return arr;
})();

export const DIGIT_MAP: readonly string[] = (() => {
  const arr = new Array<string>(128).fill("");
  for (let i = 0; i <= 9; i++) {
    const idx = 0x09e6 + i - BENGALI_BLOCK_START;
    BENGALI_CATEGORY[idx] = CAT_DIGIT;
    arr[idx] = String(i);
  }
  return arr;
})();

// Initialize virama, signs, and punctuation categories
BENGALI_CATEGORY[BENGALI_VIRAMA - BENGALI_BLOCK_START] = CAT_VIRAMA;
BENGALI_CATEGORY[BENGALI_CHANDRABINDU - BENGALI_BLOCK_START] = CAT_SIGN;
BENGALI_CATEGORY[BENGALI_ANUSVARA - BENGALI_BLOCK_START] = CAT_SIGN;
BENGALI_CATEGORY[BENGALI_VISARGA - BENGALI_BLOCK_START] = CAT_SIGN;
BENGALI_CATEGORY[BENGALI_NUKTA - BENGALI_BLOCK_START] = CAT_SIGN;
BENGALI_CATEGORY[0x09bd - BENGALI_BLOCK_START] = CAT_PUNCT; // ঽ avagraha
BENGALI_CATEGORY[0x09f7 - BENGALI_BLOCK_START] = CAT_PUNCT; // ৷

// Reference side-effect-free exports so TypeScript keeps init order
export function getBengaliCategory(cp: number): number {
  if (cp >= BENGALI_BLOCK_START && cp <= BENGALI_BLOCK_END) {
    return BENGALI_CATEGORY[cp - BENGALI_BLOCK_START] ?? CAT_OTHER;
  }
  return CAT_OTHER;
}

export function isBengaliCharCode(cp: number): boolean {
  return cp >= BENGALI_BLOCK_START && cp <= BENGALI_BLOCK_END;
}
