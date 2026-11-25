# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-11-25

### Changed
- Standardized package branding, npm metadata, repository links, documentation, and verification scripts under `easybn`.
- Updated `README.md` with complete API documentation, ESM/CJS/TypeScript usage guides, complex name examples, and measured benchmark results.

## [1.0.0] - 2026-11-25

### Added
- Hybrid 7-stage deterministic Bangladeshi Bengali personal name transliteration engine (`convert`, `convertBulk`, `convertDetailed`, `convertStream`, `createConverter`).
- Curated starter dictionaries (`1,034` compiled entries across abbreviations, full names, compounds, given names, surnames, and exceptions) with build-time NFC/conflict validation.
- Zero-allocation ASCII/precomposed-Bengali fast path in `normalizer.ts` and `converter.ts`.
- Pre-conjunct inherent vowel preservation (e.g. `শ্রীমন্ত` → `Srimanta`) and `-ুন্নেছা` / `-ন্নেছা` → `-unnessa` / `-nessa` suffix rule.
- Strict input and custom-dictionary validation with prototype-pollution protection.
- Independent accuracy evaluation pipeline (`benchmarks/accuracy-eval.mjs`) with dictionary-leakage detection.
- Comprehensive performance benchmark suite (`benchmarks/run.mjs`) covering 1k–10M conversions and latency percentiles.
- Security, reliability, and dual ESM/CJS/TypeScript tarball verification suite.
