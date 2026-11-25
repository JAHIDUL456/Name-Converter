export type ConversionMethod = "dictionary" | "phonetic" | "mixed" | "passthrough";

export type ReviewReason =
  | "phonetic-fallback"
  | "unsupported-characters"
  | "multiple-conventional-spellings"
  | "mixed-script"
  | "empty-input";

export interface UnsupportedCharacterInfo {
  readonly char: string;
  readonly codePoint: string;
  readonly index: number;
}

export interface DictionaryCoverage {
  readonly matchedTokens: number;
  readonly totalTokens: number;
  readonly ratio: number;
}

export interface ReviewIndicators {
  readonly needsReview: boolean;
  readonly reasons: readonly ReviewReason[];
}

export interface ConversionResult {
  readonly input: string;
  readonly output: string;
  readonly method: ConversionMethod;
  readonly dictionaryCoverage: DictionaryCoverage;
  readonly unsupportedCharacters: readonly UnsupportedCharacterInfo[];
  readonly hasUnsupportedCharacters: boolean;
  readonly alternatives: readonly string[];
  readonly reviewIndicators: ReviewIndicators;
  readonly dictionaryVersion: string;
  readonly isOfficialVerified: false;
}

export type DictionaryEntryValue =
  | string
  | {
      readonly en: string;
      readonly alt?: readonly string[];
    };

export interface ConverterOptions {
  readonly dictionary?: Readonly<Record<string, DictionaryEntryValue>>;
  readonly abbreviations?: Readonly<Record<string, DictionaryEntryValue>>;
  readonly compounds?: Readonly<Record<string, DictionaryEntryValue>>;
}

export interface NameConverter {
  convert(name: string): string;
  convertBulk(names: readonly string[]): string[];
  convertDetailed(name: string): ConversionResult;
  convertStream(source: Iterable<string> | AsyncIterable<string>): AsyncGenerator<string>;
}
