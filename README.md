# bd-name

> **Beta Notice (`1.0.0-beta.1`)**: Evaluated on an internal zero-leakage unseen-token holdout (`87.50%` exact / `93.75%` accepted-alt), with unit, security, benchmark, and ESM/CJS/TypeScript tarball checks passing. Independent evaluation against an external Bangladeshi population corpus has **not** yet been completed; use for assisted data entry and normalization rather than standalone legal identity verification.

Deterministic, zero-dependency, offline library for converting Bangladeshi Bengali personal names into conventional English spellings.

Designed for banking, insurance, fintech, KYC, NID data processing, and government information management workflows.

## Key Guarantees

- **Zero runtime dependencies** — no AI, LLMs, machine learning, external APIs, network requests, or databases.
- **Privacy by design** — executes synchronously in process memory with zero telemetry, zero filesystem writes at runtime, and zero personal data logging.
- **Deterministic** — identical input always yields identical output.
- **Dual ESM & CommonJS** with strict TypeScript declarations and browser-compatible core APIs.
- **Faithful character preservation** — unsupported characters (e.g. non-Bengali scripts, emojis) are preserved intact and reported in `convertDetailed()`.

## KYC & NID Safety Notice

- **Not official NID verification**: Conventional Bangladeshi English spellings vary by individual preference (e.g., `শাহীন` → `Shahin` / `Shaheen`, `হোসেন` → `Hossain` / `Hossen` / `Hosain`, `আক্তার` → `Akter` / `Akhtar`).
- `convertDetailed()` **always** returns `isOfficialVerified: false`.
- Authoritative legal identity records (NID, passport, birth certificate) always take precedence. Use `bd-name` for assisted data entry, search normalization, and candidate matching—never as standalone identity verification.

## Installation

```bash
npm install bd-name
```

## Usage

### Single Conversion

```ts
import { convert } from "bd-name";

convert("মোঃ আব্দুর রহমান");       // "Md. Abdur Rahman"
convert("মোছাঃ খৈরুন্নেছা");       // "Mst. Khairunnessa"
convert("মৃত্যুঞ্জয় চক্রবর্তী");    // "Mrityunjay Chakraborty"
convert("সৈয়দ গোলাম মাওলা");       // "Syed Golam Mawla"
```

### Bulk Conversion

```ts
import { convertBulk } from "bd-name";

const results = convertBulk([
  "নীল আকাশ",
  "মৃত্যুঞ্জয় চক্রবর্তী",
  "মোছাঃ খৈরুন্নেছা"
]);
// ["Nil Akash", "Mrityunjay Chakraborty", "Mst. Khairunnessa"]
```

### Streaming Conversion

```ts
import { convertStream } from "bd-name";

for await (const englishName of convertStream(sourceIterable)) {
  // Processes lazily without buffering the entire dataset in memory
}
```

### Custom Dictionaries & Precedence

```ts
import { createConverter } from "bd-name";

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

converter.convert("শাহীন হোসেন"); // "Shahin Hossen"
```

Lookup precedence:
1. User overrides (`abbreviations`, `compounds`, `dictionary`)
2. Base NID abbreviations (`abbreviations.json`)
3. Base exact full-name dictionary (`full-names.json`, bypassed when custom overrides apply)
4. Base longest-match compound dictionary (`compounds.json`, up to 3 words)
5. Base token dictionary (`exceptions.json`, `surnames.json`, `given-names.json`)
6. Context-aware deterministic Bengali phonetic engine

### Detailed Conversion (KYC / Review Workflows)

```ts
import { convertDetailed } from "bd-name";

const result = convertDetailed("বেলাল হোসেন");
// {
//   input: "বেলাল হোসেন",
//   output: "Belal Hossain",
//   method: "dictionary",
//   dictionaryCoverage: { matchedTokens: 2, totalTokens: 2, ratio: 1 },
//   unsupportedCharacters: [],
//   hasUnsupportedCharacters: false,
//   alternatives: ["Belal Hosain", "Belal Hossen"],
//   reviewIndicators: { needsReview: true, reasons: ["multiple-conventional-spellings"] },
//   dictionaryVersion: "1.0.0",
//   isOfficialVerified: false
// }
```

## Measured Performance

Measured on `Node v22.20.0` (`win32/x64`, Intel Core i5-10400 @ 2.90GHz) using `npm run bench`:

| Workload | Throughput | Avg Latency |
| --- | --- | --- |
| `convert()` 1,000,000 mixed | 962,086 names/sec | 1.039 µs/name |
| `convertBulk()` 1,000,000 mixed | 859,787 names/sec | 1.163 µs/name |
| `convertStream()` 10,000,000 mixed | 680,327 names/sec | 1.470 µs/name |
| Dictionary-hit workload (100k) | 1,468,050 names/sec | 0.681 µs/name |
| Dictionary-miss phonetic workload (100k) | 1,153,498 names/sec | 0.867 µs/name |
| Repeated-name workload (100k) | 1,917,225 names/sec | 0.522 µs/name |
| English passthrough (100k) | 19,157,529 names/sec | 0.052 µs/name |

- Single-name latency (20,000 samples): `avg=1.14 µs`, `P50=0.80 µs`, `P95=4.20 µs`, `P99=5.20 µs`.
- Cold import + dictionary init: `14.49 ms`; baseline RSS `48.8 MB` (`HeapUsed: 5.3 MB`), peak RSS across 10M+ benchmark `149.0 MB` (`HeapUsed: 47.5 MB`).

## Accuracy Methodology & Limitations

- Run `npm run eval:accuracy` to evaluate against the built-in zero-leakage unseen-token holdout (`benchmarks/fixtures/holdout-eval.json`, `0` leaked dictionary entries) or supply an external dataset via `node benchmarks/accuracy-eval.mjs --dataset <path.json> --strict-no-leakage`.
- **Known linguistic limitations**:
  - Personal English spelling preferences vary regionally and individually; dictionary alternatives cover common variants, not all personal preferences.
  - Uncurated Sanskritic multi-stem compounds (e.g. `অনুপমা`, `নবনীতা`) may drop a medial inherent vowel before open `CV` syllables under general schwa-deletion rules unless added to the dictionary.
  - Arabic-loan names spelled with initial `ছ` for `/s/` (e.g. `ছাদেক`, `ছমিরন`) rely on dictionary/exception entries rather than phonetic fallback (`chh`).

## Contributing & Release Process

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

```bash
npm run dict:validate   # Validate source JSON dictionaries
npm run typecheck       # Strict TypeScript check
npm run build           # Compile dictionaries and emit ESM + CJS + .d.ts
npm test                # Run full unit & security/reliability test suite
npm run eval:accuracy   # Run zero-leakage accuracy evaluation
npm run bench           # Run comprehensive performance benchmarks
npm run pack:verify     # Verify packed npm tarball in clean ESM/CJS/TS consumer
```

## License

[MIT](./LICENSE)
