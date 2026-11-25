# easybn

Deterministic, zero-dependency, offline transliteration of Bangladeshi Bengali personal names into conventional English spellings.

[![npm version](https://img.shields.io/npm/v/easybn.svg?style=flat-square)](https://www.npmjs.com/package/easybn)
[![npm downloads](https://img.shields.io/npm/dm/easybn.svg?style=flat-square)](https://www.npmjs.com/package/easybn)
[![license](https://img.shields.io/npm/l/easybn.svg?style=flat-square)](./LICENSE)
[![package size](https://img.shields.io/bundlephobia/minzip/easybn?style=flat-square&label=minzipped)](https://bundlephobia.com/package/easybn)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](./package.json)

---

`easybn` converts Bengali personal names—including NID-style honorifics, compound names, Arabic/Persian/Sanskrit loan spellings, and rural variants—into conventional Bangladeshi English spellings. It runs completely offline with deterministic output and is built for high-volume banking, fintech, insurance, KYC, and government data pipelines.

This library performs **personal name transliteration**, never semantic translation (`নীল` becomes `Nil`, never `Blue`; `আকাশ` becomes `Akash`, never `Sky`).

## Features

- **Zero runtime dependencies** — no AI/LLM models, external APIs, network requests, or databases.
- **Deterministic & offline** — identical inputs always yield identical outputs inside your process.
- **Hybrid 7-stage engine** — Unicode NFC/nukta normalization, NID abbreviation expansion, O(1) full/compound/token dictionaries, context-aware Bengali phonetic rules, and English formatting.
- **High throughput** — separates hot-path conversion from detailed metadata; supports synchronous single, preallocated bulk, and lazy streaming APIs.
- **TypeScript-first & dual module** — ships ESM, CommonJS, and strict `.d.ts` declarations (`41.6 kB` packed tarball).
- **Character-safe** — unsupported characters and mixed scripts are preserved intact rather than silently dropped.

## Installation

```bash
npm install easybn
```

```bash
pnpm add easybn
```

```bash
yarn add easybn
```

## Quick Start

```ts
import { convert } from "easybn";

convert("মোঃ আব্দুর রহমান");    // "Md. Abdur Rahman"
convert("মোছাঃ খৈরুন্নেছা");    // "Mst. Khairunnessa"
convert("মৃত্যুঞ্জয় চক্রবর্তী"); // "Mrityunjay Chakraborty"
```

## Usage

### ESM, CommonJS, and TypeScript

```ts
// ESM / TypeScript
import { convert, convertBulk, convertDetailed, convertStream, createConverter } from "easybn";
import type { ConversionResult, ConverterOptions } from "easybn";
```

```js
// CommonJS
const { convert, convertBulk, convertDetailed, convertStream, createConverter } = require("easybn");
```

### Single-Name Conversion

```ts
import { convert } from "easybn";

convert("নীল আকাশ");              // "Nil Akash"
convert("সৈয়দ গোলাম মাওলা");     // "Syed Golam Mawla"
convert("খন্দকার মিজানুর রহমান"); // "Khandaker Mizanur Rahman"
convert("নৃপেন্দ্র নাথ রায়");    // "Nripendra Nath Roy"
```

### Bulk Conversion

Processes arrays synchronously using a preallocated output array while preserving exact input order:

```ts
import { convertBulk } from "easybn";

const names = [
  "নীল আকাশ",
  "মৃত্যুঞ্জয় চক্রবর্তী",
  "মোছাঃ খৈরুন্নেছা"
];

const results = convertBulk(names);
// ["Nil Akash", "Mrityunjay Chakraborty", "Mst. Khairunnessa"]
```

### Streaming Conversion

Lazily transforms any synchronous `Iterable<string>` or `AsyncIterable<string>` without buffering the full dataset in memory:

```ts
import { convertStream } from "easybn";

async function* incomingRecords() {
  yield "মোঃ আব্দুর রহমান";
  yield "সাদিয়া আফরিন";
  yield "তানভীর আহমেদ";
}

for await (const englishName of convertStream(incomingRecords())) {
  console.log(englishName);
}
```

### Custom Dictionaries

Create isolated converter instances with organization-specific overrides without mutating global defaults. Base dictionary entries are layered rather than copied (`O(1)` lookup):

```ts
import { createConverter } from "easybn";

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

converter.convert("শাহীন হোসেন");      // "Shahin Hossen"
converter.convert("মোঃ আব্দুর রহমান"); // "Mohammad Abdur Rehman"
```

**Lookup precedence**:
1. Custom overrides (`abbreviations`, `compounds`, `dictionary`)
2. Base NID abbreviations (`49` entries)
3. Base exact full-name dictionary (bypassed when custom overrides apply)
4. Base longest-match compound dictionary (`157` entries, up to 3 words)
5. Base token dictionary (`819` entries across given names, surnames, and exceptions)
6. Context-aware deterministic phonetic engine

### Detailed Conversion (KYC & Review Workflows)

Use `convertDetailed()` when you need dictionary coverage, alternative conventional spellings, unsupported-character diagnostics, or human-review indicators:

```ts
import { convertDetailed } from "easybn";

const result = convertDetailed("বেলাল হোসেন");
console.log(result);
/*
{
  input: "বেলাল হোসেন",
  output: "Belal Hossain",
  method: "dictionary",
  dictionaryCoverage: { matchedTokens: 2, totalTokens: 2, ratio: 1 },
  unsupportedCharacters: [],
  hasUnsupportedCharacters: false,
  alternatives: ["Belal Hosain", "Belal Hossen"],
  reviewIndicators: {
    needsReview: true,
    reasons: ["multiple-conventional-spellings"]
  },
  dictionaryVersion: "1.0.0",
  isOfficialVerified: false
}
*/
```

## Bangladeshi Name Examples

| Bengali Input | Converted Output | Notes |
| --- | --- | --- |
| `নীল আকাশ` | `Nil Akash` | Transliterated, never translated |
| `মোঃ আব্দুর রহমান` | `Md. Abdur Rahman` | NID abbreviation + compound |
| `মোছাঃ খৈরুন্নেছা` | `Mst. Khairunnessa` | Female NID abbreviation + exception |
| `মৃত্যুঞ্জয় চক্রবর্তী` | `Mrityunjay Chakraborty` | Conjuncts + ya-phala + reph |
| `খন্দকার মিজানুর রহমান` | `Khandaker Mizanur Rahman` | Surname + compound |
| `নৃপেন্দ্র নাথ রায়` | `Nripendra Nath Roy` | `ri`-kar + `ndra` conjunct |
| `সৈয়দ গোলাম মাওলা` | `Syed Golam Mawla` | Conventional Arabic/Persian spelling |
| `জিন্নাতুন্নেছা` | `Jinnatunnessa` | Phonetic `-ন্নেছা` suffix rule |
| `শ্রীমন্ত` | `Srimanta` | Pre-conjunct inherent vowel preservation |
| `মছিরুদ্দিন` | `Masiruddin` | Rural conventional spelling |
| `ডঃ মুহাম্মদ ইউনুস` | `Dr. Muhammad Yunus` | Academic honorific |
| `মোঃ Rahim` | `Md. Rahim` | Mixed Bengali–English preservation |

## API Reference

### Functions

| Function | Signature | Description |
| --- | --- | --- |
| `convert` | `(name: string) => string` | Fast synchronous single-name conversion |
| `convertBulk` | `(names: readonly string[]) => string[]` | Preallocated batch conversion preserving order |
| `convertDetailed` | `(name: string) => ConversionResult` | Conversion with coverage, alternatives, and review flags |
| `convertStream` | `(source: Iterable<string> \| AsyncIterable<string>) => AsyncGenerator<string>` | Lazy streaming conversion with bounded memory |
| `createConverter` | `(options?: ConverterOptions) => NameConverter` | Creates an isolated converter with custom overrides |

### Types

- **`ConverterOptions`**:
  - `dictionary?: Record<string, string | { en: string; alt?: string[] }>`
  - `compounds?: Record<string, string | { en: string; alt?: string[] }>`
  - `abbreviations?: Record<string, string | { en: string; alt?: string[] }>`
- **`ConversionResult`**:
  - `input: string` — original input string
  - `output: string` — converted English output
  - `method: "dictionary" | "phonetic" | "mixed" | "passthrough"`
  - `dictionaryCoverage: { matchedTokens: number; totalTokens: number; ratio: number }`
  - `unsupportedCharacters: Array<{ char: string; codePoint: string; index: number }>`
  - `hasUnsupportedCharacters: boolean`
  - `alternatives: string[]` — alternative conventional spellings when known
  - `reviewIndicators: { needsReview: boolean; reasons: ReviewReason[] }`
  - `dictionaryVersion: string`
  - `isOfficialVerified: false` — always `false` for inferred transliterations

## Performance Benchmarks

Measured locally using `npm run bench` on `Node v22.20.0` (`win32/x64`, Intel Core i5-10400 @ 2.90GHz) with warm-up iterations across multiple runs:

| Workload | Throughput | Avg Latency |
| --- | --- | --- |
| `convert()` (1,000,000 mixed) | 962,086 names/sec | 1.039 µs/name |
| `convertBulk()` (1,000,000 mixed) | 859,787 names/sec | 1.163 µs/name |
| `convertStream()` (10,000,000 mixed) | 680,327 names/sec | 1.470 µs/name |
| Dictionary-hit workload (100k) | 1,468,050 names/sec | 0.681 µs/name |
| Dictionary-miss phonetic workload (100k) | 1,153,498 names/sec | 0.867 µs/name |
| English passthrough (100k) | 19,157,529 names/sec | 0.052 µs/name |

- **Single-name latency (20,000 samples)**: `avg = 1.14 µs`, `P50 = 0.80 µs`, `P95 = 4.20 µs`, `P99 = 5.20 µs`.
- **Startup & memory**: Cold import + dictionary initialization `14.49 ms`; baseline RSS `48.8 MB` (`HeapUsed: 5.3 MB`), peak RSS across the full 10M+ benchmark `149.0 MB` (`HeapUsed: 47.5 MB`).

## Supported Environments

- **Node.js**: `>= 18.0.0` (ESM and CommonJS)
- **TypeScript**: Strict `.d.ts` declarations bundled for `NodeNext` and `Bundler` resolution
- **Browsers & Edge Runtimes**: Core runtime contains zero Node-specific APIs (`fs`, `process`, `Buffer`, `http`)

## Privacy and Security

- **Offline by design**: Zero network calls, zero runtime filesystem reads/writes, and zero telemetry or personal data logging.
- **Hardened inputs**: Rejects non-string inputs with `TypeError`, filters prototype-pollution keys (`__proto__`, `constructor`, `prototype`) in custom dictionaries, handles malformed UTF-16 surrogates safely, and runs in linear $O(n)$ time without backtracking regular expressions.
- See [SECURITY.md](./SECURITY.md) for reporting security issues.

## KYC, NID, and Linguistic Limitations

- **Not official NID verification**: Personal English spellings in Bangladesh vary by individual preference (for example, `শাহীন` as `Shahin` or `Shaheen`, `হোসেন` as `Hossain`, `Hossen`, or `Hosain`). Authoritative legal identity records (NID, passport, birth certificate) always take precedence. `convertDetailed()` always sets `isOfficialVerified: false`.
- **Unverified external population accuracy**: This library is evaluated on an internal zero-leakage unseen-token holdout (`48` entries, `87.50%` exact / `93.75%` accepted-alt), not an externally collected population corpus. Use `easybn` for assisted data entry, search normalization, and candidate generation rather than standalone identity verification.
- **Phonetic edge cases**: Uncurated Sanskritic multi-stem names (such as `অনুপমা` or `নবনীতা`) may drop medial inherent vowels before open `CV` syllables unless included in the dictionary; Arabic-loan names spelled with `ছ` for `/s/` rely on dictionary entries.

## Contributing

Contributions are welcome—especially curated generic Bangladeshi names, regional variants, and phonetic test cases. See [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

```bash
npm run dict:validate   # Validate source dictionaries in data/
npm run typecheck       # Run strict TypeScript check
npm test                # Build and run unit, security, and reliability tests
npm run eval:accuracy   # Run zero-leakage holdout accuracy evaluation
npm run bench           # Run throughput and latency benchmarks
npm run pack:verify     # Pack tarball and verify ESM, CJS, and TS consumer usage
```

## License

[MIT](./LICENSE) — Copyright (c) 2026 [MD. JAHIDUL ISLAM](https://github.com/JAHIDUL456/Name-Converter) and `easybn` Contributors.
