/** Runs the real Gemini reader over every sample bill. Run: pnpm tsx scripts/try-gemini.ts [model] */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { parseBillResponse } from "../src/domain/bill";
import { GeminiBillReader } from "../src/server/bill-reader/gemini";

config({ path: [".env.local", ".env"] });

async function main() {
  const model = process.argv[2] || process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const reader = new GeminiBillReader(process.env.GEMINI_API_KEY!, model);
  for (const file of readdirSync("public/samples")) {
    const bytes = readFileSync(path.join("public/samples", file));
    const started = Date.now();
    try {
      const raw = await reader.read({ bytes, mimeType: "image/jpeg", sha256: createHash("sha256").update(bytes).digest("hex") });
      const result = parseBillResponse(raw, 0.75);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (result.kind === "ok") {
        const e = result.extraction;
        console.log(`${file} (${seconds}s) ok conf=${result.confidence} low=[${result.lowConfidence}]`);
        console.log(`  ${e.consumerNumber.value} | ${e.tariffCategory.value} | rate ${e.ratePerUnit.value} | ${e.sanctionedLoadKw.value} kW | ${e.unitsLatestMonth.value} units | Rs ${e.billAmount.value} | ${e.billingMonth.value} | hist ${e.monthlyUnitsHistory.length}`);
      } else console.log(`${file} (${seconds}s)`, JSON.stringify(result));
    } catch (error) {
      console.log(`${file} ERROR`, error instanceof Error ? error.message.slice(0, 200) : error);
    }
  }
}

main();
