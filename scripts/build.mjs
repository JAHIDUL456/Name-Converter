#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

try {
  fs.rmSync(distDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
} catch {
  // Fallback if Windows briefly holds a directory lock on dist/
  fs.rmSync(path.join(distDir, "esm"), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  fs.rmSync(path.join(distDir, "cjs"), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

const tscBin = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");
execFileSync(process.execPath, [path.join(__dirname, "compile-dictionary.mjs")], {
  cwd: rootDir,
  stdio: "inherit"
});
execFileSync(process.execPath, [tscBin, "-p", "tsconfig.esm.json"], {
  cwd: rootDir,
  stdio: "inherit"
});
execFileSync(process.execPath, [tscBin, "-p", "tsconfig.cjs.json"], {
  cwd: rootDir,
  stdio: "inherit"
});

fs.writeFileSync(
  path.join(distDir, "esm", "package.json"),
  JSON.stringify({ type: "module" }, null, 2) + "\n",
  "utf8"
);
fs.writeFileSync(
  path.join(distDir, "cjs", "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
  "utf8"
);
