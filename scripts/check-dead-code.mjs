/**
 * Fail the build if any file under src/ is unreachable from an App Router
 * entry point.
 *
 * The audit found ~4,400 lines of unreachable code in src/, including a second
 * policy engine using a decision vocabulary incompatible with the real one.
 * That is worse than clutter: a reader looking for how decisions are made can
 * land on code that has never run, and a reviewer can spend their attention on
 * something that cannot affect behaviour.
 *
 * Entry points are the files Next.js itself invokes — pages, layouts, route
 * handlers, error boundaries — plus middleware. Everything else has to be
 * reachable from one of them by an import chain.
 *
 * Usage: node scripts/check-dead-code.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = "src";

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(p.split(path.sep).join("/"));
  }
}

if (!fs.existsSync(ROOT)) {
  console.error(`${ROOT}/ not found — run this from the repository root.`);
  process.exit(2);
}
walk(ROOT);

const isEntry = (f) =>
  /^src\/app\/.*\/(page|layout|route|error|not-found|template|loading)\.tsx?$/.test(f) ||
  /^src\/app\/(page|layout|error|global-error|not-found)\.tsx?$/.test(f) ||
  f === "src/middleware.ts" ||
  f === "src/instrumentation.ts";

function resolveImport(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null; // bare specifier: a package, not our source

  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (files.includes(base + ext)) return base + ext;
  }
  return files.includes(base) ? base : null;
}

const reachable = new Set();
const queue = files.filter(isEntry);
for (const f of queue) reachable.add(f);

while (queue.length > 0) {
  const file = queue.shift();
  const source = fs.readFileSync(file, "utf8");
  // Covers `import ... from "x"` and `export ... from "x"`. Dynamic imports
  // resolved from a variable are not traceable statically; if one is ever
  // needed, add the target to KNOWN_DYNAMIC below with a reason.
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
    const resolved = resolveImport(match[1], file);
    if (resolved && !reachable.has(resolved)) {
      reachable.add(resolved);
      queue.push(resolved);
    }
  }
}

/** Files that are genuinely used but not reachable by a static import chain. */
const KNOWN_DYNAMIC = new Set([
  // e.g. "src/lib/foo.ts", // loaded by name at runtime from a config value
]);

const dead = files.filter((f) => !reachable.has(f) && !KNOWN_DYNAMIC.has(f));

if (dead.length === 0) {
  console.log(`✓ no dead code — all ${files.length} files under ${ROOT}/ are reachable`);
  process.exit(0);
}

let deadLines = 0;
console.error(`✗ ${dead.length} unreachable file(s) under ${ROOT}/:\n`);
for (const f of dead) {
  const lines = fs.readFileSync(f, "utf8").split("\n").length;
  deadLines += lines;
  console.error(`   ${f}  (${lines} lines)`);
}
console.error(
  `\n${deadLines} unreachable lines. Delete them, or add to KNOWN_DYNAMIC in this script with a reason if they are loaded dynamically.`,
);
process.exit(1);
