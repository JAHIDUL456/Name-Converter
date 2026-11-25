import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  convert,
  convertBulk,
  convertDetailed,
  convertStream,
  createConverter
} from "../dist/esm/index.js";

const require = createRequire(import.meta.url);
const cjsPkg = require("../dist/cjs/package.json");
const cjsMod = require("../dist/cjs/index.js");

test("1. Canonical Bangladeshi personal name examples", () => {
  assert.equal(convert("নীল"), "Nil");
  assert.equal(convert("আকাশ"), "Akash");
  assert.equal(convert("আলো"), "Alo");
  assert.equal(convert("আশা"), "Asha");
  assert.equal(convert("মোঃ আব্দুর রহমান"), "Md. Abdur Rahman");
  assert.equal(convert("মোছাঃ খৈরুন্নেছা"), "Mst. Khairunnessa");
  assert.equal(convert("মৃত্যুঞ্জয় চক্রবর্তী"), "Mrityunjay Chakraborty");
  assert.equal(convert("খন্দকার মিজানুর রহমান"), "Khandaker Mizanur Rahman");
  assert.equal(convert("নৃপেন্দ্র নাথ রায়"), "Nripendra Nath Roy");
  assert.equal(convert("সৈয়দ গোলাম মাওলা"), "Syed Golam Mawla");
  // Difficult rural, Arabic/Persian, and Sanskritic names (never semantically translated)
  assert.equal(convert("মছিরুদ্দিন"), "Masiruddin");
  assert.equal(convert("ছমিরন নেছা"), "Samiron Nessa");
  assert.equal(convert("মমতাজুন্নাহার"), "Momtajunnahar");
  assert.equal(convert("মোজাহারুল ইসলাম"), "Mozaharul Islam");
  assert.equal(convert("ছহির উদ্দিন"), "Sahir Uddin");
  assert.equal(convert("জিন্নাতুন্নেছা"), "Jinnatunnessa");
  assert.equal(convert("জয়নুল আবেদীন"), "Zainul Abedin");
  assert.equal(convert("ঋত্বিক"), "Ritwik");
  assert.equal(convert("ঐন্দ্রিলা"), "Oindrila");
  assert.equal(convert("ক্ষিতীশ"), "Kshitish");
  assert.equal(convert("জ্ঞানেন্দ্র"), "Gyanendra");
  assert.equal(convert("বিশ্বজিৎ"), "Biswajit");
  assert.equal(convert("পঞ্চানন"), "Panchanan");
  assert.equal(convert("শ্রীমন্ত"), "Srimanta");
  assert.notEqual(convert("নীল"), "Blue");
  assert.notEqual(convert("আকাশ"), "Sky");
  assert.notEqual(convert("আলো"), "Light");
  assert.notEqual(convert("আশা"), "Hope");
});

test("2. NID-style abbreviations and attached abbreviations", () => {
  assert.equal(convert("মো: আব্দুল করিম"), "Md. Abdul Karim");
  assert.equal(convert("মো. নুরুল ইসলাম"), "Md. Nurul Islam");
  assert.equal(convert("মোসাঃ ফাতেমা খাতুন"), "Mst. Fatema Khatun");
  assert.equal(convert("ডঃ মুহাম্মদ ইউনুস"), "Dr. Muhammad Yunus");
  assert.equal(convert("ডাঃ তাসনিম জারা"), "Dr. Tasnim Jara");
  assert.equal(convert("ইঞ্জিঃ কামরুল হাসান"), "Engr. Kamrul Hasan");
  assert.equal(convert("এ্যাডঃ সিরাজুল হক"), "Adv. Sirajul Haque");
  assert.equal(convert("অ্যাডঃ জহিরুল ইসলাম"), "Adv. Zahirul Islam");
  assert.equal(convert("মিঃ সুনীল কুমার"), "Mr. Sunil Kumar");
  assert.equal(convert("শ্রী অজয় রায়"), "Sri Ajoy Roy");
  // Missing space after visarga
  assert.equal(convert("মোঃআব্দুর রহমান"), "Md. Abdur Rahman");
  assert.equal(convert("মোছাঃখৈরুন্নেছা"), "Mst. Khairunnessa");
});

test("3. Phonetic engine on uncurated / unknown complex Bengali names", () => {
  const cases = [
    ["তানভীরুল", "Tanvirul"],
    ["মজহারুল", "Majharul"],
    ["শবনম", "Shabnam"],
    ["আকবরুল", "Akbarul"],
    ["রবিউল্লাহ", "Rabiullah"],
    ["নিত্যগোপাল", "Nityagopal"],
    ["বিপ্লবুল", "Biplabul"],
    ["সূর্য", "Surya"],
    ["কর্ণ", "Karna"],
    ["স্বাধীন", "Swadhin"],
    ["উদ্যোগ", "Udyog"],
    ["আশরাফুল্লাহ", "Ashrafullah"],
    ["মাহবুবুল", "Mahbubul"],
    ["সাবিকুন", "Sabikun"],
    ["তাপসী", "Tapsi"]
  ];
  for (const [bn, expected] of cases) {
    const det = convertDetailed(bn);
    assert.equal(det.method, "phonetic", `Expected phonetic method for ${bn}`);
    assert.equal(det.output, expected, `Failed phonetic output for ${bn}`);
  }
});

test("4. Unicode normalization edge cases (NFD, nukta, legacy encodings, zero-width)", () => {
  // NFD decomposed nukta: ড + ় = ড়, য + ় = য়
  const decomposedRay = "রায়".normalize("NFD");
  assert.equal(convert(decomposedRay), "Roy");
  assert.equal(convert("বা\u09A1\u09BCি"), "Bari");

  // Decomposed ো (ে + া) and ৌ (ে + ৗ)
  assert.equal(convert("আ\u09B2\u09C7\u09BE"), "Alo");
  assert.equal(convert("স\u09C7\u09D7রভ"), "Sourav");

  // Legacy অ + া for আ
  assert.equal(convert("\u0985\u09BEকাশ"), "Akash");

  // Legacy ত + ্ + ZWJ for Khanda Ta (ৎ)
  assert.equal(convert("সত্যজি\u09A4\u09CD\u200D"), "Satyajit");

  // Zero-width spaces, ZWNJ, BOM, curly apostrophes, dashes, excessive whitespace
  assert.equal(
    convert("  \uFEFFমোঃ\u200B  আব্দুর\u200C   রহমান  "),
    "Md. Abdur Rahman"
  );
  assert.equal(convert("আল\u2013আমিন"), "Al-Amin");
});

test("5. Mixed Bengali-English, hyphenated names, and English passthrough", () => {
  assert.equal(convert("মোঃ Rahim"), "Md. Rahim");
  assert.equal(convert("S. M. তানভীর"), "S. M. Tanvir");
  assert.equal(convert("Dr. আসাদুজ্জামান"), "Dr. Asaduzzaman");
  assert.equal(convert("আল-আমিন"), "Al-Amin");
  assert.equal(convert("Md. Abdur Rahman"), "Md. Abdur Rahman");
  assert.equal(convert("  John   Doe  "), "John Doe");

  const passthrough = convertDetailed("Md. Abdur Rahman");
  assert.equal(passthrough.method, "passthrough");
  assert.equal(passthrough.reviewIndicators.needsReview, false);
  assert.equal(passthrough.isOfficialVerified, false);

  const mixed = convertDetailed("মোঃ Rahim");
  assert.equal(mixed.method, "mixed");
  assert.ok(mixed.reviewIndicators.reasons.includes("mixed-script"));
});

test("6. Unsupported characters are preserved and reported", () => {
  const emojiOut = convert("রহমান 😊");
  assert.equal(emojiOut, "Rahman 😊");

  const detEmoji = convertDetailed("রহমান 😊");
  assert.equal(detEmoji.output, "Rahman 😊");
  assert.equal(detEmoji.hasUnsupportedCharacters, true);
  assert.equal(detEmoji.unsupportedCharacters.length, 1);
  assert.equal(detEmoji.unsupportedCharacters[0]?.char, "😊");
  assert.equal(detEmoji.unsupportedCharacters[0]?.codePoint, "U+1F60A");
  assert.ok(detEmoji.reviewIndicators.needsReview);
  assert.ok(detEmoji.reviewIndicators.reasons.includes("unsupported-characters"));

  const arabicOut = convert("আকাশ محمد");
  assert.equal(arabicOut, "Akash محمد");
  const detArabic = convertDetailed("আকাশ محمد");
  assert.equal(detArabic.hasUnsupportedCharacters, true);
  assert.equal(detArabic.unsupportedCharacters.length, 4);
});

test("7. Detailed conversion metadata and safety invariants", () => {
  const dictRes = convertDetailed("মোঃ আব্দুর রহমান");
  assert.equal(dictRes.input, "মোঃ আব্দুর রহমান");
  assert.equal(dictRes.output, "Md. Abdur Rahman");
  assert.equal(dictRes.method, "dictionary");
  assert.equal(dictRes.dictionaryCoverage.matchedTokens, 3);
  assert.equal(dictRes.dictionaryCoverage.totalTokens, 3);
  assert.equal(dictRes.dictionaryCoverage.ratio, 1);
  assert.equal(dictRes.isOfficialVerified, false);
  assert.ok(dictRes.dictionaryVersion.length > 0);
  assert.equal("confidence" in dictRes, false);
  assert.equal("accuracy" in dictRes, false);

  const altRes = convertDetailed("বেলাল হোসেন");
  assert.equal(altRes.output, "Belal Hossain");
  assert.ok(altRes.alternatives.includes("Belal Hosain"));
  assert.ok(altRes.alternatives.includes("Belal Hossen"));
  assert.ok(altRes.reviewIndicators.reasons.includes("multiple-conventional-spellings"));

  const mixedMethod = convertDetailed("আকাশ তানভীরুল");
  assert.equal(mixedMethod.method, "mixed");
  assert.equal(mixedMethod.dictionaryCoverage.matchedTokens, 1);
  assert.equal(mixedMethod.dictionaryCoverage.totalTokens, 2);
  assert.equal(mixedMethod.dictionaryCoverage.ratio, 0.5);
  assert.ok(mixedMethod.reviewIndicators.reasons.includes("phonetic-fallback"));
});

test("8. Empty and invalid inputs", () => {
  assert.equal(convert(""), "");
  assert.equal(convert("   \t\n "), "");

  const emptyDet = convertDetailed("   ");
  assert.equal(emptyDet.output, "");
  assert.equal(emptyDet.method, "passthrough");
  assert.equal(emptyDet.reviewIndicators.needsReview, true);
  assert.ok(emptyDet.reviewIndicators.reasons.includes("empty-input"));

  // @ts-expect-error runtime guard verification
  assert.throws(() => convert(null), TypeError);
  // @ts-expect-error runtime guard verification
  assert.throws(() => convert(123), TypeError);
  // @ts-expect-error runtime guard verification
  assert.throws(() => convertDetailed(undefined), TypeError);
  // @ts-expect-error runtime guard verification
  assert.throws(() => convertBulk("not-array"), TypeError);
});

test("9. Custom converter overrides and isolation", () => {
  const converter = createConverter({
    dictionary: {
      "হোসেন": "Hossen",
      "শাহীন": "Shahin"
    },
    compounds: {
      "আব্দুর রহমান": "Abdur Rehman"
    },
    abbreviations: {
      "মোঃ": "Mohammad"
    }
  });

  assert.equal(converter.convert("শাহীন হোসেন"), "Shahin Hossen");
  assert.equal(converter.convert("মোঃ আব্দুর রহমান"), "Mohammad Abdur Rehman");

  // Default global converter remains untouched
  assert.equal(convert("বেলাল হোসেন"), "Belal Hossain");
  assert.equal(convert("মোঃ আব্দুর রহমান"), "Md. Abdur Rahman");
});

test("10. Bulk processing and streaming order preservation", async () => {
  const inputs = [
    "নীল আকাশ",
    "মৃত্যুঞ্জয় চক্রবর্তী",
    "মোছাঃ খৈরুন্নেছা",
    "John Doe",
    ""
  ];
  const bulk = convertBulk(inputs);
  assert.deepEqual(bulk, [
    "Nil Akash",
    "Mrityunjay Chakraborty",
    "Mst. Khairunnessa",
    "John Doe",
    ""
  ]);

  const syncStreamOut = [];
  for await (const item of convertStream(inputs)) {
    syncStreamOut.push(item);
  }
  assert.deepEqual(syncStreamOut, bulk);

  async function* asyncGen() {
    for (const item of inputs) {
      await Promise.resolve();
      yield item;
    }
  }
  const asyncStreamOut = [];
  for await (const item of convertStream(asyncGen())) {
    asyncStreamOut.push(item);
  }
  assert.deepEqual(asyncStreamOut, bulk);
});

test("11. CommonJS distribution parity", () => {
  assert.equal(cjsPkg.type, "commonjs");
  assert.equal(cjsMod.convert("মোঃ আব্দুর রহমান"), "Md. Abdur Rahman");
  assert.equal(cjsMod.convert("সৈয়দ গোলাম মাওলা"), "Syed Golam Mawla");
  assert.deepEqual(cjsMod.convertBulk(["নীল", "আলো"]), ["Nil", "Alo"]);
});
