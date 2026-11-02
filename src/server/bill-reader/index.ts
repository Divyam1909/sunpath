import { parseBillResponse, type BillParseResult } from "@/domain/bill";
import { GeminiBillReader } from "./gemini";
import { MockBillReader } from "./mock";

export interface BillFile {
  bytes: Buffer;
  mimeType: string;
  sha256: string;
}

/** A reader returns raw model text. Parsing and every decision about it stays in the domain layer. */
export interface BillReader {
  name: string;
  model: string | null;
  read(file: BillFile): Promise<string>;
}

export class BillReaderUnavailable extends Error {}

export type BillReadOutcome =
  | { status: "read"; reader: string; model: string | null; result: Extract<BillParseResult, { kind: "ok" }> }
  | { status: "poor"; reader: string; model: string | null; reason: Extract<BillParseResult, { kind: "poor" }>["reason"] }
  | { status: "unavailable"; detail: string };

function readerChain(): BillReader[] {
  const mode = process.env.BILL_READER || "auto";
  const key = process.env.GEMINI_API_KEY;
  if (mode === "mock" || !key) return [new MockBillReader()];
  // The free tier allows few requests a day per model, so a busy day moves on to the lighter model.
  const models = [process.env.GEMINI_MODEL || "gemini-3.5-flash", process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite"];
  const gemini = [...new Set(models)].map((model) => new GeminiBillReader(key, model));
  // In auto mode a Gemini outage still lets sample bills work; real bills fall through to manual entry.
  return mode === "gemini" ? gemini : [...gemini, new MockBillReader()];
}

/** Never throws: a read that cannot be done becomes `unavailable`, and the lead goes to manual entry. */
export async function readBill(
  file: BillFile,
  lowConfidenceBelow: number,
  readers: BillReader[] = readerChain(),
): Promise<BillReadOutcome> {
  let detail = "No bill reader available";
  for (const reader of readers) {
    try {
      const parsed = parseBillResponse(await reader.read(file), lowConfidenceBelow);
      if (parsed.kind === "invalid") {
        detail = parsed.error;
        continue;
      }
      const { name, model } = reader;
      return parsed.kind === "ok"
        ? { status: "read", reader: name, model, result: parsed }
        : { status: "poor", reader: name, model, reason: parsed.reason };
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
  }
  return { status: "unavailable", detail };
}
