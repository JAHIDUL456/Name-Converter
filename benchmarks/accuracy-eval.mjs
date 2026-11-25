import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertDetailed } from "../dist/esm/index.js";
import {
  ABBREVIATIONS_ENTRIES,
  COMPOUNDS_ENTRIES,
  FULL_NAMES_ENTRIES,
  TOKENS_ENTRIES
} from "../dist/esm/dictionary/compiled-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDatasetPath = path.join(__dirname, "fixtures", "holdout-eval.json");

function parseArgs(argv) {
  let datasetPath = defaultDatasetPath;
  let strictNoLeakage = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dataset" && argv[i + 1]) {
      datasetPath = path.resolve(process.cwd(), argv[i + 1]);
      i++;
    } else if (argv[i] === "--strict-no-leakage") {
      strictNoLeakage = true;
    }
  }
  return { datasetPath, strictNoLeakage };
}

function buildDictionaryKeySet() {
  const keys = new Set();
  for (const [k] of ABBREVIATIONS_ENTRIES) keys.add(k);
  for (const [k] of FULL_NAMES_ENTRIES) keys.add(k);
  for (const [k] of COMPOUNDS_ENTRIES) keys.add(k);
  for (const [k] of TOKENS_ENTRIES) keys.add(k);
  return keys;
}

function pct(num, den) {
  if (den === 0) return "N/A (0/0)";
  return `${((num / den) * 100).toFixed(2)}% (${num}/${den})`;
}

const { datasetPath, strictNoLeakage } = parseArgs(process.argv.slice(2));
const raw = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
const entries = Array.isArray(raw) ? raw : raw.entries;
const externalIndependentCorpus = Boolean(!Array.isArray(raw) && raw.externalIndependentCorpus);
const datasetName = (!Array.isArray(raw) && raw.datasetName) || path.basename(datasetPath);

const dictKeys = buildDictionaryKeySet();

let total = 0;
let exactMatches = 0;
let acceptedAltMatches = 0;
let invalidOutputs = 0;
let charPreserved = 0;
let coverageSum = 0;

let fullyLeakedEntries = 0;
let zeroDictTokensEntries = 0;
let zeroDictExact = 0;
let zeroDictAlt = 0;

const byCategory = new Map();
const failuresByRule = new Map();

for (const item of entries) {
  const bn = item.bn;
  const expected = item.en;
  const acceptedAlts = Array.isArray(item.alt) ? item.alt : [];
  const category = item.category || "general";
  const rule = item.rule || "unspecified";

  // Check token-level dictionary overlap for leakage auditing
  const normWords = bn.normalize("NFC").trim().split(/\s+/);
  const inDictCount = normWords.filter((w) => dictKeys.has(w)).length;
  const isFullyInDict = dictKeys.has(bn.normalize("NFC").trim()) || inDictCount === normWords.length;

  if (isFullyInDict) {
    fullyLeakedEntries++;
    if (strictNoLeakage) {
      continue;
    }
  }

  const res = convertDetailed(bn);
  total++;
  coverageSum += res.dictionaryCoverage.ratio;

  if (res.isOfficialVerified !== false || typeof res.output !== "string" || (bn.trim().length > 0 && res.output.trim().length === 0)) {
    invalidOutputs++;
  }

  // Check unsupported/punctuation preservation
  const nonBengaliNonSpace = [...bn].filter((ch) => {
    const cp = ch.codePointAt(0);
    return !(cp >= 0x0980 && cp <= 0x09ff) && !/\s/.test(ch);
  });
  const preservedAll = nonBengaliNonSpace.every((ch) => res.output.includes(ch));
  if (preservedAll) charPreserved++;

  const isExact = res.output === expected;
  const isAccepted = isExact || acceptedAlts.includes(res.output);

  if (isExact) exactMatches++;
  if (isAccepted) acceptedAltMatches++;

  if (inDictCount === 0) {
    zeroDictTokensEntries++;
    if (isExact) zeroDictExact++;
    if (isAccepted) zeroDictAlt++;
  }

  const catStats = byCategory.get(category) || { total: 0, exact: 0, accepted: 0 };
  catStats.total++;
  if (isExact) catStats.exact++;
  if (isAccepted) catStats.accepted++;
  byCategory.set(category, catStats);

  if (!isExact) {
    const list = failuresByRule.get(rule) || [];
    list.push({
      bn,
      expected,
      actual: res.output,
      acceptedViaAlt: isAccepted,
      method: res.method
    });
    failuresByRule.set(rule, list);
  }
}

console.log("=== easybn Accuracy Evaluation Report ===");
console.log(`Dataset:                 ${datasetName}`);
console.log(
  `External Verification:   ${
    externalIndependentCorpus
      ? "VERIFIED EXTERNAL CORPUS"
      : "UNVERIFIED (internal holdout fixture; supply --dataset <external.json> for independent accuracy)"
  }`
);
console.log(`Dictionary Leakage:      ${fullyLeakedEntries} fully-covered entries detected${strictNoLeakage ? " (excluded by --strict-no-leakage)" : ""}`);
console.log(`Evaluated Entries:       ${total}`);
console.log(`Exact-Match Accuracy:    ${pct(exactMatches, total)}`);
console.log(`Accepted-Alt Accuracy:   ${pct(acceptedAltMatches, total)}`);
console.log(`Avg Dictionary Coverage: ${total > 0 ? ((coverageSum / total) * 100).toFixed(2) + "%" : "N/A"}`);
console.log(`Unknown-Token Exact:     ${pct(zeroDictExact, zeroDictTokensEntries)}`);
console.log(`Unknown-Token Alt:       ${pct(zeroDictAlt, zeroDictTokensEntries)}`);
for (const [cat, st] of byCategory.entries()) {
  console.log(`Category [${cat}]`.padEnd(25) + `Exact: ${pct(st.exact, st.total)}, Alt: ${pct(st.accepted, st.total)}`);
}
console.log(`Character Preservation:  ${pct(charPreserved, total)}`);
console.log(`Invalid-Output Rate:     ${pct(invalidOutputs, total)}`);

if (failuresByRule.size > 0) {
  console.log("\n--- Non-Exact Cases Grouped by Linguistic Rule ---");
  for (const [rule, items] of failuresByRule.entries()) {
    console.log(`Rule: ${rule}`);
    for (const f of items) {
      console.log(`  - ${f.bn} => "${f.actual}" (expected "${f.expected}", altAccepted=${f.acceptedViaAlt}, method=${f.method})`);
    }
  }
}
