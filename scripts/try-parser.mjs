// Run sample messages through the full parser (rules, then local model) and
// compare with expectations.
//   node scripts/try-parser.mjs
//   node scripts/try-parser.mjs "Pizza 2400 Hasaru"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// Not every Node build can run .ts files, so transpile lib/ai with the
// project's TypeScript. Output goes under node_modules/ so "ollama" and "zod"
// still resolve.
const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = `${root}/node_modules/.cache/splitmate-ai/ai`;
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(`${root}/lib/ai`).filter((f) => f.endsWith(".ts"))) {
  const source = readFileSync(`${root}/lib/ai/${file}`, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const withExtensions = outputText.replace(/from "(\.\/[\w-]+)"/g, 'from "$1.mjs"');
  writeFileSync(`${outDir}/${file.replace(/\.ts$/, ".mjs")}`, withExtensions);
}
const { parseExpense } = await import(pathToFileURL(`${outDir}/index.mjs`).href);

const MEMBERS = ["Dhamith", "Hasaru", "Sidath", "Kasun"].map((name) => ({
  id: name,
  name,
}));

// Rule-based cases first (instant), then cases that need the model.
const CASES = [
  ["Uber 1200 Kasun", { amount: 1200, payer: "Kasun", participants: null }],
  ["3000 (Sidath,Dhamith)", { amount: 3000, payer: null, participants: ["Sidath", "Dhamith"] }],
  ["Pizza 3600 Sidath (Kasun, Hasaru, Dhamith)", { amount: 3600, payer: "Sidath", participants: ["Kasun", "Hasaru", "Dhamith"] }],
  ["Rs.850 tuk tuk Hasaru", { amount: 850, payer: "Hasaru", participants: null }],
  ["Kasun paid 4500 LKR for dinner with Hasaru and Dhamith", { amount: 4500, payer: "Kasun", participants: ["Kasun", "Hasaru", "Dhamith"] }],
  ["Hasaru paid 2,750 for groceries", { amount: 2750, payer: "Hasaru", participants: null }],
  ["party drinks 12.5k paid by dhamith", { amount: 12500, payer: "Dhamith", participants: null }],
  ["Rs. 850 tuk tuk with Kasun", { amount: 850, payer: null, participants: ["Kasun"] }],
  ["kottu 1800 hasaru with sidath", { amount: 1800, payer: "Hasaru", participants: ["Hasaru", "Sidath"] }],
];

const cases = process.argv[2] ? [[process.argv[2], null]] : CASES;
const sameNames = (a, b) =>
  JSON.stringify(a?.map((n) => n.toLowerCase()).sort() ?? null) ===
  JSON.stringify(b?.map((n) => n.toLowerCase()).sort() ?? null);

let passed = 0;
for (const [text, expected] of cases) {
  const started = performance.now();
  try {
    const { expense, source } = await parseExpense(text, MEMBERS);
    const ms = Math.round(performance.now() - started);
    const ok =
      !expected ||
      (expense.amount === expected.amount &&
        (expense.payer?.toLowerCase() ?? null) === (expected.payer?.toLowerCase() ?? null) &&
        sameNames(expense.participants, expected.participants));
    if (ok) passed++;
    console.log(`${ok ? "PASS" : "FAIL"} [${source} ${ms}ms]  ${text}\n      ${JSON.stringify(expense)}`);
    if (!ok) console.log(`      expected ${JSON.stringify(expected)}`);
  } catch (error) {
    console.log(`ERROR  ${text}\n      ${error.message}`);
  }
}
if (!process.argv[2]) console.log(`\n${passed}/${cases.length} passed`);
