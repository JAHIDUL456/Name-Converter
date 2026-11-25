import { execFileSync } from "node:child_process";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { convert, convertBulk, convertStream } from "../dist/esm/index.js";

const DICT_NAMES = [
  "মোঃ আব্দুর রহমান",
  "মোছাঃ খৈরুন্নেছা",
  "মৃত্যুঞ্জয় চক্রবর্তী",
  "খন্দকার মিজানুর রহমান",
  "নৃপেন্দ্র নাথ রায়",
  "সৈয়দ গোলাম মাওলা",
  "নীল আকাশ",
  "বেলাল হোসেন",
  "নুসরাত জাহান",
  "তানভীর আহমেদ",
  "আব্দুল করিম",
  "শফিকুল ইসলাম",
  "মাহমুদুল হাসান",
  "ফাতেমা খাতুন",
  "সাদিয়া আফরিন",
  "জসিম উদ্দিন"
];

const MISS_NAMES = [
  "তানভীরুল",
  "মজহারুল",
  "নিত্যগোপাল",
  "আকবরুল",
  "রবিউল্লাহ",
  "জিন্নাতুন্নেছা",
  "ঐন্দ্রিলা",
  "জ্ঞানেন্দ্র",
  "পঞ্চানন",
  "শ্রীমন্ত",
  "আশরাফুল্লাহ",
  "মাহবুবুল",
  "ফয়জুন্নেছা",
  "রহিমুন্নেছা",
  "সুকান্ত",
  "চিরঞ্জীব"
];

const ENGLISH_NAMES = [
  "Md. Abdur Rahman",
  "Mst. Khairunnessa",
  "Khandaker Mizanur Rahman",
  "Syed Golam Mawla",
  "Nusrat Jahan",
  "Tanvir Ahmed",
  "Belal Hossain",
  "Sadia Afrin"
];

const LONG_COMPLEX_NAMES = [
  "ডঃ আলহাজ্ব খন্দকার মিজানুর রহমান চৌধুরী",
  "মোছাঃ জিন্নাতুন্নেছা ফাতেমা খাতুন সিদ্দিকা",
  "শ্রী নৃপেন্দ্র নাথ রায় ভট্টাচার্য",
  "ইঞ্জিঃ সৈয়দ গোলাম মাওলা তালুকদার"
];

const MIXED_POOL = [...DICT_NAMES, ...MISS_NAMES, ...ENGLISH_NAMES, ...LONG_COMPLEX_NAMES];

function buildDataset(pool, count) {
  const arr = new Array(count);
  const plen = pool.length;
  for (let i = 0; i < count; i++) {
    arr[i] = pool[i % plen];
  }
  return arr;
}

function formatNum(n) {
  return Math.round(n).toLocaleString("en-US");
}

function measureColdStartup() {
  const out = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { performance } from "node:perf_hooks";
       const t0 = performance.now();
       const mod = await import("./dist/esm/index.js");
       const t1 = performance.now();
       const r = mod.convert("মোঃ আব্দুর রহমান");
       const t2 = performance.now();
       console.log(JSON.stringify({ importMs: t1 - t0, firstCallMs: t2 - t1, r }));`
    ],
    { encoding: "utf8" }
  );
  return JSON.parse(out.trim());
}

function measureLatencyPercentiles(pool, samples = 20000) {
  // Warmup
  for (let i = 0; i < 5000; i++) {
    convert(pool[i % pool.length]);
  }
  const times = new Float64Array(samples);
  const plen = pool.length;
  for (let i = 0; i < samples; i++) {
    const s = pool[i % plen];
    const t0 = performance.now();
    convert(s);
    times[i] = (performance.now() - t0) * 1000; // microseconds
  }
  times.sort();
  let sum = 0;
  for (let i = 0; i < samples; i++) sum += times[i];
  const avg = sum / samples;
  const p50 = times[Math.floor(samples * 0.5)];
  const p95 = times[Math.floor(samples * 0.95)];
  const p99 = times[Math.floor(samples * 0.99)];
  return { avgUs: avg, p50Us: p50, p95Us: p95, p99Us: p99 };
}

function benchSync(label, count, dataset, useBulk = false, runs = 3) {
  // Warmup
  const warmSlice = dataset.slice(0, Math.min(2000, dataset.length));
  if (useBulk) convertBulk(warmSlice);
  else for (let i = 0; i < warmSlice.length; i++) convert(warmSlice[i]);

  let bestRate = 0;
  let totalMsSum = 0;
  let checksum = 0;
  const dlen = dataset.length;

  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    if (useBulk && dlen === count) {
      const out = convertBulk(dataset);
      checksum += out.length;
    } else if (useBulk) {
      let remaining = count;
      while (remaining > 0) {
        const chunk = remaining >= dlen ? dataset : dataset.slice(0, remaining);
        const out = convertBulk(chunk);
        checksum += out.length;
        remaining -= chunk.length;
      }
    } else {
      let acc = 0;
      for (let i = 0; i < count; i++) {
        acc += convert(dataset[i % dlen]).length;
      }
      checksum += acc;
    }
    const elapsed = performance.now() - t0;
    totalMsSum += elapsed;
    const rate = (count / elapsed) * 1000;
    if (rate > bestRate) bestRate = rate;
  }

  const avgMs = totalMsSum / runs;
  const avgRate = (count / avgMs) * 1000;
  const avgLatencyUs = (avgMs * 1000) / count;
  console.log(
    `${label.padEnd(36)} | ${formatNum(avgRate).padStart(12)} /s | avg=${avgMs.toFixed(1).padStart(7)} ms (${avgLatencyUs.toFixed(3)} us/name, peak=${formatNum(bestRate)}/s, chk=${checksum % 97})`
  );
}

async function benchStream10M() {
  const total = 10_000_000;
  const poolLen = MIXED_POOL.length;
  function* streamSource() {
    for (let i = 0; i < total; i++) {
      yield MIXED_POOL[i % poolLen];
    }
  }
  const t0 = performance.now();
  let count = 0;
  for await (const _res of convertStream(streamSource())) {
    count++;
  }
  const elapsedMs = performance.now() - t0;
  const rate = (count / elapsedMs) * 1000;
  console.log(
    `${"convertStream() 10,000,000 names".padEnd(36)} | ${formatNum(rate).padStart(12)} /s | total=${elapsedMs.toFixed(1).padStart(7)} ms (${((elapsedMs * 1000) / count).toFixed(3)} us/name)`
  );
}

console.log("=== bd-name Comprehensive Performance Benchmark ===");
console.log(`Node: ${process.version} | Platform: ${process.platform}/${process.arch} | CPUs: ${os.cpus()[0]?.model ?? "unknown"} (${os.cpus().length} cores)`);

const cold = measureColdStartup();
console.log(`Cold import + dict init: ${cold.importMs.toFixed(2)} ms | First cold convert(): ${cold.firstCallMs.toFixed(2)} ms`);

const memStart = process.memoryUsage();
console.log(`Baseline RSS: ${(memStart.rss / 1048576).toFixed(1)} MB | HeapUsed: ${(memStart.heapUsed / 1048576).toFixed(1)} MB`);
console.log("-".repeat(108));

const dict10k = buildDataset(DICT_NAMES, 10_000);
const miss10k = buildDataset(MISS_NAMES, 10_000);
const mixed10k = buildDataset(MIXED_POOL, 10_000);
const repeated10k = buildDataset(["মোঃ আব্দুর রহমান"], 10_000);
const long10k = buildDataset(LONG_COMPLEX_NAMES, 10_000);
const english10k = buildDataset(ENGLISH_NAMES, 10_000);
const mixed100k = buildDataset(MIXED_POOL, 100_000);

benchSync("convert() 1,000 mixed", 1_000, mixed10k, false, 10);
benchSync("convert() 10,000 mixed", 10_000, mixed10k, false, 5);
benchSync("convert() 100,000 mixed", 100_000, mixed100k, false, 5);
benchSync("convert() 1,000,000 mixed", 1_000_000, mixed100k, false, 3);
benchSync("convertBulk() 100,000 mixed", 100_000, mixed100k, true, 5);
benchSync("convertBulk() 1,000,000 mixed", 1_000_000, mixed100k, true, 3);
benchSync("Workload: dictionary-hit (100k)", 100_000, dict10k, false, 5);
benchSync("Workload: dictionary-miss (100k)", 100_000, miss10k, false, 5);
benchSync("Workload: repeated-name (100k)", 100_000, repeated10k, false, 5);
benchSync("Workload: diverse-name (100k)", 100_000, mixed100k, false, 5);
benchSync("Workload: long-complex (100k)", 100_000, long10k, false, 5);
benchSync("Workload: english-passthrough (100k)", 100_000, english10k, false, 5);

await benchStream10M();

const lat = measureLatencyPercentiles(MIXED_POOL, 20000);
console.log("-".repeat(108));
console.log(
  `Single-name latency (20k samples): avg=${lat.avgUs.toFixed(2)} us | P50=${lat.p50Us.toFixed(2)} us | P95=${lat.p95Us.toFixed(2)} us | P99=${lat.p99Us.toFixed(2)} us`
);

const memEnd = process.memoryUsage();
console.log(`Peak/Final RSS: ${(memEnd.rss / 1048576).toFixed(1)} MB | HeapUsed: ${(memEnd.heapUsed / 1048576).toFixed(1)} MB | External: ${(memEnd.external / 1048576).toFixed(1)} MB`);
