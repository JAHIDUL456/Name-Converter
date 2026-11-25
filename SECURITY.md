# Security Policy

## Reporting a Vulnerability

`bd-name` executes purely offline with zero network calls, zero file-system writes at runtime, and zero telemetry.

If you discover a security issue (such as a ReDoS vector, prototype pollution in custom dictionary ingestion, or build script vulnerability), please report it privately to the maintainers with reproduction steps before opening a public issue.

## Data Privacy

- `bd-name` never logs, stores, or transmits personal names.
- All transliteration occurs synchronously in memory inside the caller's process.
