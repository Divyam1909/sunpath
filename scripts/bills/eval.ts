/**
 * Measures the bill reader on documents with known answers and writes docs/BILL_ACCURACY.md.
 * Needs GEMINI_API_KEY. Run: pnpm eval:bills
 * Only flattened, redacted images are sent, so no real customer's details reach the model.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { compareField, compareHistory, percentOf, scoreFields, type FieldOutcome, type TruthValue, type UsageRow } from "../../src/domain/accuracy";
import { parseBillResponse } from "../../src/domain/bill";
import { GeminiBillReader } from "../../src/server/bill-reader/gemini";

config({ path: [".env.local", ".env"], quiet: true });

const FIELDS = [
  "consumerNumber", "consumerName", "tariffCategory", "sanctionedLoadKw", "unitsLatestMonth", "billAmount", "currentBillAmount",
  "arrearsAmount", "billingMonth", "meterStatus", "solarImportUnits", "solarExportUnits", "solarBankedUnits", "solarBilledUnits",
] as const;

const SPACING_MS = 7_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Truth = Partial<Record<(typeof FIELDS)[number], TruthValue>> & { monthlyUsage?: UsageRow[] };
interface Case {
  file: string;
  dir: string;
  group: "real" | "lookalike";
  source: string;
  truth: Truth;
}

function loadCases(): Case[] {
  const real = JSON.parse(readFileSync("eval/real-truth.json", "utf8")) as Record<string, { copyOf?: string; source?: string; truth?: Truth }>;
  const lookalike = JSON.parse(readFileSync("eval/lookalike/truth.json", "utf8")) as Record<string, Truth>;
  return [
    ...Object.entries(real).map(([file, row]) => {
      const original = row.copyOf ? real[row.copyOf] : row;
      const source = row.copyOf ? `${original.source}, as a simulated phone photo` : original.source!;
      return { file, dir: "eval/bills", group: "real" as const, source, truth: original.truth! };
    }),
    ...Object.entries(lookalike).map(([file, truth]) => ({ file, dir: "eval/lookalike", group: "lookalike" as const, source: "Fictional", truth })),
  ];
}

interface Result {
  file: string;
  group: Case["group"];
  source: string;
  status: string;
  outcomes: { field: string; outcome: FieldOutcome; read: unknown; truth: unknown }[];
  history: { correct: number; total: number };
}

async function readWithRetry(reader: GeminiBillReader, file: { bytes: Buffer; mimeType: string; sha256: string }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await reader.read(file);
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(20_000 * attempt);
    }
  }
}

async function evaluate(reader: GeminiBillReader, item: Case): Promise<Result> {
  const bytes = readFileSync(path.join(item.dir, item.file));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const base = { file: item.file, group: item.group, source: item.source };
  const raw = await readWithRetry(reader, { bytes, mimeType: "image/jpeg", sha256 });
  const parsed = parseBillResponse(raw, 0.75);
  if (parsed.kind !== "ok") return { ...base, status: parsed.kind === "poor" ? `rejected: ${parsed.reason}` : "invalid", outcomes: [], history: { correct: 0, total: item.truth.monthlyUsage?.length ?? 0 } };
  const { extraction } = parsed;
  const outcomes = FIELDS.filter((field) => field in item.truth).map((field) => {
    const read = extraction[field].value;
    return { field, outcome: compareField(field, read, item.truth[field] ?? null), read, truth: item.truth[field] };
  });
  return { ...base, status: "read", outcomes, history: compareHistory(extraction.monthlyUsage, item.truth.monthlyUsage ?? []) };
}

function table(results: Result[]) {
  const scores = scoreFields(results.flatMap((r) => r.outcomes));
  const rows = scores.map((s) => `| ${s.field} | ${s.correct} of ${s.total} | ${percentOf(s.correct, s.total)}% | ${s.invented} |`);
  const correct = scores.reduce((sum, s) => sum + s.correct, 0);
  const total = scores.reduce((sum, s) => sum + s.total, 0);
  const invented = scores.reduce((sum, s) => sum + s.invented, 0);
  const history = results.reduce((sum, r) => ({ correct: sum.correct + r.history.correct, total: sum.total + r.history.total }), { correct: 0, total: 0 });
  return {
    correct,
    total,
    invented,
    history,
    markdown: [
      "| Field | Correct | Share | Invented |",
      "|---|---|---|---|",
      ...rows,
      `| **All fields** | **${correct} of ${total}** | **${percentOf(correct, total)}%** | **${invented}** |`,
      `| Months of history | ${history.correct} of ${history.total} | ${percentOf(history.correct, history.total)}% | |`,
    ].join("\n"),
  };
}

function report(results: Result[], model: string) {
  const real = results.filter((r) => r.group === "real");
  const lookalike = results.filter((r) => r.group === "lookalike");
  const realTable = table(real);
  const lookalikeTable = table(lookalike);
  const misses = results
    .flatMap((r) => r.outcomes.filter((o) => o.outcome !== "CORRECT").map((o) => `| ${r.file} | ${o.field} | ${o.outcome.toLowerCase()} | ${String(o.read)} | ${String(o.truth)} |`))
    .join("\n");
  const perBill = results.map((r) => `| ${r.file} | ${r.group} | ${r.status} | ${r.outcomes.filter((o) => o.outcome === "CORRECT").length} of ${r.outcomes.length} | ${r.history.correct} of ${r.history.total} |`).join("\n");
  return `# Bill read accuracy

Generated by \`pnpm eval:bills\` on ${new Date().toISOString().slice(0, 10)} with \`${model}\`. Do not edit by hand.

**On real MSEDCL documents the reader got ${realTable.correct} of ${realTable.total} fields right (${percentOf(realTable.correct, realTable.total)}%) and invented ${realTable.invented === 1 ? "1 value" : `${realTable.invented} values`} behind masks.**

This is a small test of ${real.length} real images from 5 real bills. It shows the reader handles real layouts, Marathi and scans. It is not a measure of field accuracy on thousands of phone photos. The answer to that comes from the stored AI-versus-confirmed values once real customers use the app.

## How it works

- **Real:** bills MSEDCL publishes as format guides and one a college published. Their masks are flattened into the image and redacted further, so the fields hidden there have a true value of "not visible". Reading anything there counts as invented, the worst outcome. The answers were read by hand from each document.
- **Lookalike:** fictional bills in the same layouts, with numbers worked out from the real tariff and stamped SAMPLE. Because every value is known, they test far more cases, including dim, soft and tilted phone shots. They are reported apart from the real bills and never counted with them.
- **Phone photos:** the \`-phone\`, \`-tilted\`, \`-dim\` and \`-soft\` images are simulated from clean renders, not taken with a phone.

## Real documents

${realTable.markdown}

## Lookalike bills

${lookalikeTable.markdown}

## Each document

| File | Group | Outcome | Fields | History months |
|---|---|---|---|---|
${perBill}

## Every miss

| File | Field | Outcome | Read | True value |
|---|---|---|---|---|
${misses || "| None | | | | |"}
`;
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is needed for this test");
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const reader = new GeminiBillReader(key, model);
  const cases = loadCases();
  const only = process.argv[2];
  const results: Result[] = [];
  for (const item of cases.filter((c) => !only || c.file.includes(only))) {
    const result = await evaluate(reader, item);
    results.push(result);
    const right = result.outcomes.filter((o) => o.outcome === "CORRECT").length;
    console.log(`${item.file}: ${result.status}, ${right} of ${result.outcomes.length} fields, ${result.history.correct} of ${result.history.total} months`);
    await sleep(SPACING_MS);
  }
  if (only) {
    console.log(results.flatMap((r) => r.outcomes.filter((o) => o.outcome !== "CORRECT")));
    return;
  }
  writeFileSync("docs/BILL_ACCURACY.md", report(results, model));
}

main();
