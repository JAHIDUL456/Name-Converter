#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const outFile = path.join(rootDir, "src", "dictionary", "compiled-data.ts");

const checkOnly = process.argv.includes("--check");

function readJson(fileName) {
  const fullPath = path.join(dataDir, fileName);
  const raw = fs.readFileSync(fullPath, "utf8");
  return { raw, data: JSON.parse(raw), fullPath };
}

/**
 * Detect duplicate keys in a flat JSON object source file before JSON.parse collapses them.
 */
function findDuplicateJsonKeys(raw, fileName) {
  const keyRegex = /^\s*"((?:[^"\\]|\\.)*)"\s*:/gm;
  const seen = new Set();
  const dups = [];
  let match;
  while ((match = keyRegex.exec(raw)) !== null) {
    const key = JSON.parse(`"${match[1]}"`);
    if (seen.has(key)) {
      dups.push(`${fileName}: duplicate key "${key}"`);
    }
    seen.add(key);
  }
  return dups;
}

function normalizeBengaliKey(key) {
  return key
    .normalize("NFC")
    .replace(/\u09A1\u09BC/g, "\u09DC")
    .replace(/\u09A2\u09BC/g, "\u09DD")
    .replace(/\u09AF\u09BC/g, "\u09DF")
    .trim()
    .replace(/\s+/g, " ");
}

function validateValue(key, rawVal, fileName) {
  let en;
  let alt = [];
  if (typeof rawVal === "string") {
    en = rawVal.trim();
  } else if (rawVal && typeof rawVal === "object" && !Array.isArray(rawVal)) {
    if (typeof rawVal.en !== "string") {
      throw new Error(`${fileName}["${key}"]: expected string "en" property`);
    }
    en = rawVal.en.trim();
    if (rawVal.alt !== undefined) {
      if (!Array.isArray(rawVal.alt)) {
        throw new Error(`${fileName}["${key}"]: "alt" must be an array of strings`);
      }
      for (const a of rawVal.alt) {
        if (typeof a !== "string" || a.trim().length === 0) {
          throw new Error(`${fileName}["${key}"]: invalid alternative value`);
        }
        const trimmed = a.trim();
        if (trimmed !== en && !alt.includes(trimmed)) {
          alt.push(trimmed);
        }
      }
    }
  } else {
    throw new Error(`${fileName}["${key}"]: entry must be a string or { en, alt? }`);
  }

  if (en.length === 0) {
    throw new Error(`${fileName}["${key}"]: empty English spelling`);
  }
  if (/[\x00-\x1F\x7F]/.test(en)) {
    throw new Error(`${fileName}["${key}"]: control characters in English spelling`);
  }
  return { en, alt };
}

function loadTier(fileName) {
  const { raw, data } = readJson(fileName);
  const errors = findDuplicateJsonKeys(raw, fileName);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  const map = new Map();
  const alts = new Map();

  for (const [rawKey, rawVal] of Object.entries(data)) {
    const key = normalizeBengaliKey(rawKey);
    if (!key) {
      throw new Error(`${fileName}: empty key encountered`);
    }
    const { en, alt } = validateValue(rawKey, rawVal, fileName);
    if (map.has(key)) {
      const prev = map.get(key);
      if (prev !== en) {
        throw new Error(`${fileName}: NFC key collision for "${key}" ("${prev}" vs "${en}")`);
      }
      throw new Error(`${fileName}: duplicate key after NFC normalization "${key}"`);
    }
    map.set(key, en);
    if (alt.length > 0) {
      alts.set(key, alt);
    }
  }
  return { map, alts };
}

function compile() {
  const { data: metadata } = readJson("metadata.json");
  if (!metadata || typeof metadata.version !== "string" || !metadata.version.trim()) {
    throw new Error("metadata.json: missing valid version string");
  }

  const abbr = loadTier("abbreviations.json");
  const fullNames = loadTier("full-names.json");
  const compounds = loadTier("compounds.json");
  const givenNames = loadTier("given-names.json");
  const surnames = loadTier("surnames.json");
  const exceptions = loadTier("exceptions.json");

  // Merge token-level dictionaries: exceptions, surnames, given-names.
  // Detect any cross-file collisions or conflicting spellings.
  const tokensMap = new Map();
  const tokenSources = new Map();
  const allAlts = new Map();

  function mergeAlts(altsMap) {
    for (const [k, v] of altsMap.entries()) {
      const existing = allAlts.get(k);
      if (!existing) {
        allAlts.set(k, [...v]);
      } else {
        for (const item of v) {
          if (!existing.includes(item)) {
            existing.push(item);
          }
        }
      }
    }
  }

  mergeAlts(abbr.alts);
  mergeAlts(fullNames.alts);
  mergeAlts(compounds.alts);

  for (const [tierName, tier] of [
    ["exceptions.json", exceptions],
    ["surnames.json", surnames],
    ["given-names.json", givenNames]
  ]) {
    for (const [k, v] of tier.map.entries()) {
      if (k.includes(" ")) {
        throw new Error(`${tierName}: multi-word key "${k}" belongs in compounds.json or full-names.json`);
      }
      if (tokensMap.has(k)) {
        const existingVal = tokensMap.get(k);
        const existingSrc = tokenSources.get(k);
        throw new Error(
          `Cross-file duplicate token "${k}" in ${tierName} ("${v}") and ${existingSrc} ("${existingVal}")`
        );
      }
      tokensMap.set(k, v);
      tokenSources.set(k, tierName);
    }
    mergeAlts(tier.alts);
  }

  let maxCompoundWords = 1;
  for (const key of compounds.map.keys()) {
    const wordCount = key.split(" ").length;
    if (wordCount < 2) {
      throw new Error(`compounds.json: "${key}" must contain at least 2 space-separated words`);
    }
    if (wordCount > maxCompoundWords) {
      maxCompoundWords = wordCount;
    }
  }

  for (const key of fullNames.map.keys()) {
    if (!key.includes(" ")) {
      throw new Error(`full-names.json: "${key}" is a single token; place in given-names/surnames/exceptions`);
    }
  }

  const sortEntries = (m) =>
    [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const abbrEntries = sortEntries(abbr.map);
  const fullNameEntries = sortEntries(fullNames.map);
  const compoundEntries = sortEntries(compounds.map);
  const tokenEntries = sortEntries(tokensMap);
  const altEntries = sortEntries(allAlts);

  const totalEntries =
    abbrEntries.length +
    fullNameEntries.length +
    compoundEntries.length +
    tokenEntries.length;

  const stats = {
    version: metadata.version,
    provenance: metadata.provenance,
    totalEntries,
    abbreviations: abbrEntries.length,
    fullNames: fullNameEntries.length,
    compounds: compoundEntries.length,
    tokens: tokenEntries.length,
    alternativesCount: altEntries.length,
    maxCompoundWords
  };

  if (checkOnly) {
    console.log("Dictionary validation passed:", JSON.stringify(stats));
    return;
  }

  const content = `// AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
// Run \`npm run dict:compile\` to regenerate from data/*.json.

export interface CompiledDictionaryMetadata {
  readonly version: string;
  readonly provenance: string;
  readonly totalEntries: number;
  readonly abbreviations: number;
  readonly fullNames: number;
  readonly compounds: number;
  readonly tokens: number;
  readonly alternativesCount: number;
  readonly maxCompoundWords: number;
}

export const DICTIONARY_METADATA: CompiledDictionaryMetadata = ${JSON.stringify(stats, null, 2)} as const;

export const ABBREVIATIONS_ENTRIES: readonly (readonly [string, string])[] = ${JSON.stringify(abbrEntries)};

export const FULL_NAMES_ENTRIES: readonly (readonly [string, string])[] = ${JSON.stringify(fullNameEntries)};

export const COMPOUNDS_ENTRIES: readonly (readonly [string, string])[] = ${JSON.stringify(compoundEntries)};

export const TOKENS_ENTRIES: readonly (readonly [string, string])[] = ${JSON.stringify(tokenEntries)};

export const ALTERNATIVES_ENTRIES: readonly (readonly [string, readonly string[]])[] = ${JSON.stringify(altEntries)};
`;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, content, "utf8");
  console.log(`Compiled ${totalEntries} dictionary entries -> ${path.relative(rootDir, outFile)}`);
}

compile();
