# Contributing to bd-name

Thank you for contributing to `bd-name`!

## Guidelines

1. **No personal or private NID datasets**: Only submit widely used, generic Bangladeshi personal names, surnames, compounds, or honorifics. Never submit real individual records or restricted datasets.
2. **No runtime dependencies**: The core package must remain zero-dependency, offline, and deterministic.
3. **Dictionary changes**:
   - Edit the appropriate source file in `data/` (`abbreviations.json`, `compounds.json`, `given-names.json`, `surnames.json`, `exceptions.json`, `full-names.json`).
   - Do not edit `src/dictionary/compiled-data.ts` directly.
   - Run `npm run dict:validate` and `npm test` before submitting a pull request.
4. **Tests**: Add unit tests in `tests/` for every new linguistic rule, edge case, or bug fix.
