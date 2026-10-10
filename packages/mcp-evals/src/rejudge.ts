import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, type Outcome } from "./cases";

/**
 * Re-applies the current checks to a saved results file without calling any model or database.
 * Use it after fixing a judging bug: it costs nothing and shows exactly which verdicts changed.
 *
 *   pnpm --filter @feedbackport/mcp-evals rejudge [results/<file>.json]   (default: newest)
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../results");
const arg = process.argv[2];
const file = arg
  ? path.resolve(arg)
  : path.join(dir, readdirSync(dir).filter((f) => f.endsWith(".json")).sort().at(-1) ?? "");

const saved = JSON.parse(readFileSync(file, "utf8")) as {
  model: string;
  details: Array<{ id: string; verdict: { pass: boolean; reason: string }; outcome: Outcome }>;
};

console.log(`File: ${path.relative(process.cwd(), file)}   Model: ${saved.model}\n`);
let passed = 0;
for (const d of saved.details) {
  const c = CASES.find((x) => x.id === d.id);
  if (!c) continue;
  const now = c.check(d.outcome);
  if (now.pass) passed++;
  const changed = now.pass !== d.verdict.pass ? `  (was ${d.verdict.pass ? "PASS" : "FAIL"})` : "";
  console.log(`  ${now.pass ? "PASS" : "FAIL"}  ${d.id.padEnd(30)}${now.pass ? "" : now.reason}${changed}`);
}
console.log(`\n${passed}/${saved.details.length} pass under the current checks.`);
