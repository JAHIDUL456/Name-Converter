import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  convert,
  convertBulk,
  convertDetailed,
  convertStream,
  createConverter
} from "../dist/esm/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("Security: Prototype pollution and malformed custom dictionary rejection", () => {
  const malicious = JSON.parse(
    '{"__proto__":"polluted","constructor":"bad","prototype":"bad","আকাশ":"CustomAkash"}'
  );
  const conv = createConverter({ dictionary: malicious });
  assert.equal(conv.convert("আকাশ"), "CustomAkash");
  assert.equal(({}).toString !== "polluted", true);
  assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted"), false);

  // Reject malformed options / entries
  // @ts-expect-error testing invalid runtime input
  assert.throws(() => createConverter(null), TypeError);
  // @ts-expect-error testing invalid runtime input
  assert.throws(() => createConverter("invalid"), TypeError);
  // @ts-expect-error testing invalid runtime input
  assert.throws(() => createConverter({ dictionary: [] }), TypeError);
  // @ts-expect-error testing invalid runtime input
  assert.throws(() => createConverter({ dictionary: { "আকাশ": 123 } }), TypeError);
  // @ts-expect-error testing invalid runtime input
  assert.throws(() => createConverter({ dictionary: { "আকাশ": { en: 42 } } }), TypeError);
  assert.throws(
    // @ts-expect-error testing invalid runtime input
    () => createConverter({ dictionary: { "আকাশ": { en: "Akash", alt: "not-array" } } }),
    TypeError
  );
  assert.throws(
    // @ts-expect-error testing invalid runtime input
    () => createConverter({ dictionary: { "আকাশ": { en: "Akash", alt: [123] } } }),
    TypeError
  );
});

test("Security: Defensive input type validation across all APIs", () => {
  for (const bad of [null, undefined, 0, 42, true, {}, [], Symbol("x")]) {
    // @ts-expect-error testing invalid runtime input
    assert.throws(() => convert(bad), TypeError);
    // @ts-expect-error testing invalid runtime input
    assert.throws(() => convertDetailed(bad), TypeError);
    // @ts-expect-error testing invalid runtime input
    assert.throws(() => convertBulk([bad]), TypeError);
  }
  // @ts-expect-error testing invalid runtime input
  assert.throws(() => convertBulk(null), TypeError);
  // @ts-expect-error testing invalid runtime input
  assert.throws(() => convertBulk({}), TypeError);
});

test("Security: Extremely long input completes linearly without ReDoS", () => {
  const longBn = "আকাশ ".repeat(20_000).trim(); // ~120,000 chars
  const start = performance.now();
  const out = convert(longBn);
  const elapsedMs = performance.now() - start;
  assert.ok(out.startsWith("Akash Akash"));
  assert.ok(elapsedMs < 2000, `Expected <2000ms for 120k chars, took ${elapsedMs.toFixed(1)}ms`);

  const singleLongToken = "তানভীরুল".repeat(10_000); // 80,000-char single Bengali word
  const t2 = performance.now();
  const out2 = convert(singleLongToken);
  const elapsed2 = performance.now() - t2;
  assert.ok(out2.length > 50_000);
  assert.ok(elapsed2 < 2000, `Expected <2000ms for 80k-char word, took ${elapsed2.toFixed(1)}ms`);
});

test("Reliability: Malformed Unicode (unpaired surrogates, stray virama/nukta/signs)", () => {
  const highSurrogate = convertDetailed("আকাশ\uD800");
  assert.equal(highSurrogate.output, "Akash\uD800");
  assert.equal(highSurrogate.hasUnsupportedCharacters, true);
  assert.equal(highSurrogate.unsupportedCharacters[0]?.codePoint, "U+D800");

  const lowSurrogate = convertDetailed("\uDFFFনীল");
  assert.equal(lowSurrogate.output, "\uDFFFNil");
  assert.equal(lowSurrogate.hasUnsupportedCharacters, true);

  // Stray virama / nukta / combining vowel sign should not crash or drop valid text
  assert.equal(typeof convert("্া়"), "string");
  assert.equal(convert("ক্"), "K");
});

test("Reliability: Immutability of custom options & concurrent isolated converters", async () => {
  const userDict = { "হোসেন": "Hossen", "করিম": "Kareem" };
  const c1 = createConverter({ dictionary: userDict });
  const c2 = createConverter({ dictionary: { "হোসেন": "Hosain", "করিম": "Karim" } });

  // Mutating input object after creation must not affect converter
  userDict["হোসেন"] = "MUTATED";
  assert.equal(c1.convert("হোসেন"), "Hossen");
  assert.equal(c2.convert("হোসেন"), "Hosain");
  assert.equal(convert("বেলাল হোসেন"), "Belal Hossain");

  // Concurrent streaming across isolated converters preserves per-instance overrides and order
  const inputs = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? "হোসেন" : "করিম"));
  const collect = async (conv) => {
    const out = [];
    for await (const item of conv.convertStream(inputs)) {
      out.push(item);
    }
    return out;
  };
  const [r1, r2] = await Promise.all([collect(c1), collect(c2)]);
  assert.equal(r1[0], "Hossen");
  assert.equal(r1[1], "Kareem");
  assert.equal(r2[0], "Hosain");
  assert.equal(r2[1], "Karim");
});

test("Reliability: Streaming backpressure and error propagation", async () => {
  let produced = 0;
  async function* lazySource() {
    for (let i = 0; i < 10; i++) {
      produced++;
      yield "আকাশ";
    }
  }

  const stream = convertStream(lazySource());
  const first = await stream.next();
  assert.equal(first.value, "Akash");
  assert.equal(produced, 1, "Stream must pull lazily without pre-buffering");
  await stream.return(undefined);

  async function* failingSource() {
    yield "নীল";
    throw new Error("downstream-io-failure");
  }
  await assert.rejects(async () => {
    for await (const _item of convertStream(failingSource())) {
      // consume
    }
  }, /downstream-io-failure/);

  async function* badItemSource() {
    yield "নীল";
    // @ts-expect-error testing invalid runtime item
    yield 999;
  }
  await assert.rejects(async () => {
    for await (const _item of convertStream(badItemSource())) {
      // consume
    }
  }, TypeError);
});

test("Security: Runtime dist/ has zero network, fs, eval, or telemetry calls", () => {
  const forbiddenPatterns = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /node:fs/,
    /node:http/,
    /node:https/,
    /node:net/,
    /node:child_process/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /console\.log\s*\(/
  ];

  for (const sub of ["esm", "cjs"]) {
    const dir = path.join(rootDir, "dist", sub);
    const stack = [dir];
    while (stack.length > 0) {
      const curr = stack.pop();
      for (const entry of fs.readdirSync(curr, { withFileTypes: true })) {
        const full = path.join(curr, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.name.endsWith(".js")) {
          const code = fs.readFileSync(full, "utf8");
          for (const pat of forbiddenPatterns) {
            assert.equal(
              pat.test(code),
              false,
              `Forbidden pattern ${pat} found in ${path.relative(rootDir, full)}`
            );
          }
        }
      }
    }
  }
});
