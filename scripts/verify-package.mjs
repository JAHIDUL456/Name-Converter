#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

if (rootPkg.dependencies && Object.keys(rootPkg.dependencies).length > 0) {
  throw new Error("Package must have zero runtime dependencies");
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "easybn-verify-"));

try {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const packOut = execFileSync(npmCmd, ["pack", "--json", "--pack-destination", tmpDir], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32"
  }).trim();

  const packInfo = JSON.parse(packOut)[0];
  if (!packInfo || !packInfo.filename) {
    throw new Error("npm pack did not produce valid JSON metadata");
  }

  for (const fileInfo of packInfo.files ?? []) {
    const f = fileInfo.path;
    if (
      f.startsWith("tests/") ||
      f.startsWith("scripts/") ||
      f.startsWith("benchmarks/") ||
      f.startsWith("data/") ||
      f.startsWith("src/") ||
      f.startsWith(".github/") ||
      f.includes(".env")
    ) {
      throw new Error(`Unexpected development/source file in tarball: ${f}`);
    }
  }

  const tgzPath = path.join(tmpDir, packInfo.filename);
  const consumerDir = path.join(tmpDir, "consumer");
  fs.mkdirSync(consumerDir, { recursive: true });
  fs.writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify({ name: "easybn-consumer-test", private: true, type: "module" }, null, 2),
    "utf8"
  );

  execFileSync(npmCmd, ["install", "--no-save", tgzPath], {
    cwd: consumerDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  // Verify browser-compatibility of unpacked dist/esm (no node:* imports, process, or Buffer)
  const installedEsmDir = path.join(consumerDir, "node_modules", "easybn", "dist", "esm");
  const stack = [installedEsmDir];
  while (stack.length > 0) {
    const curr = stack.pop();
    for (const entry of fs.readdirSync(curr, { withFileTypes: true })) {
      const full = path.join(curr, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name.endsWith(".js")) {
        const content = fs.readFileSync(full, "utf8");
        if (/node:|process\.|Buffer\./.test(content)) {
          throw new Error(`Node-specific API found in browser-compatible ESM output: ${full}`);
        }
      }
    }
  }

  // Verify ESM consumption
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import assert from "node:assert/strict";
       import { convert, convertBulk, convertDetailed, convertStream, createConverter } from "easybn";
       assert.equal(convert("মোঃ আব্দুর রহমান"), "Md. Abdur Rahman");
       assert.deepEqual(convertBulk(["নীল", "আকাশ"]), ["Nil", "Akash"]);
       const det = convertDetailed("মোছাঃ খৈরুন্নেছা");
       assert.equal(det.output, "Mst. Khairunnessa");
       assert.equal(det.isOfficialVerified, false);
       const custom = createConverter({ dictionary: { "হোসেন": "Hossen" } });
       assert.equal(custom.convert("হোসেন"), "Hossen");
       const streamed = [];
       for await (const item of convertStream(["আলো", "আশা"])) streamed.push(item);
       assert.deepEqual(streamed, ["Alo", "Asha"]);
       console.log("ESM tarball verification passed");`
    ],
    { cwd: consumerDir, stdio: "inherit" }
  );

  // Verify CJS consumption
  execFileSync(
    process.execPath,
    [
      "-e",
      `const assert = require("node:assert/strict");
       const { convert, convertDetailed } = require("easybn");
       assert.equal(convert("সৈয়দ গোলাম মাওলা"), "Syed Golam Mawla");
       assert.equal(convertDetailed("আকাশ").output, "Akash");
       console.log("CJS tarball verification passed");`
    ],
    { cwd: consumerDir, stdio: "inherit" }
  );

  // Verify TypeScript declaration types via consumer check using repo's tsc
  const tsConsumerFile = path.join(consumerDir, "type-check.ts");
  fs.writeFileSync(
    tsConsumerFile,
    `import { convert, convertBulk, convertDetailed, convertStream, createConverter, type ConversionResult } from "easybn";
     const a: string = convert("নীল");
     const b: string[] = convertBulk(["আকাশ"]);
     const c: ConversionResult = convertDetailed("আলো");
     const d = createConverter({ dictionary: { "হোসেন": "Hossen" } });
     const e: AsyncGenerator<string> = convertStream(["আশা"]);
     void [a, b, c, d, e];
    `,
    "utf8"
  );
  const tscBin = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");
  execFileSync(
    process.execPath,
    [tscBin, "--noEmit", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", tsConsumerFile],
    { cwd: consumerDir, stdio: "inherit" }
  );

  console.log(
    `Tarball verified successfully: ${packInfo.filename} (packed=${packInfo.size} bytes, unpacked=${packInfo.unpackedSize} bytes, files=${packInfo.entryCount})`
  );
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
