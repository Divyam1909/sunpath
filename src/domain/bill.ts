import { z } from "zod";

const field = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.nullable(), confidence: z.number().min(0).max(1) });

const optional = <T extends z.ZodType>(value: T) => field(value).default({ value: null, confidence: 0 } as never);

/** The exact shape the vision model must return. Anything else is treated as a failed read. */
export const billExtractionSchema = z.object({
  isElectricityBill: z.boolean(),
  imageQuality: z.enum(["good", "blurry", "cropped", "dark", "unreadable"]),
  consumerNumber: field(z.string()),
  tariffCategory: field(z.string()),
  ratePerUnit: field(z.number().positive()),
  sanctionedLoadKw: field(z.number().positive()),
  unitsLatestMonth: field(z.number().min(0)),
  billAmount: field(z.number().min(0)),
  billingMonth: field(z.string()),
  monthlyUnitsHistory: z.array(z.number().min(0)).default([]),
  // Added for real MSEDCL bills. They default to "not read", so older reads stay valid.
  consumerName: optional(z.string()),
  arrearsAmount: optional(z.number()),
  currentBillAmount: optional(z.number().min(0)),
  connectionPhase: optional(z.number()),
  meterStatus: optional(z.string()),
  solarImportUnits: optional(z.number().min(0)),
  solarExportUnits: optional(z.number().min(0)),
  solarBankedUnits: optional(z.number().min(0)),
  solarBilledUnits: optional(z.number().min(0)),
  monthlyUsage: z.array(z.object({ month: z.string().nullable(), units: z.number().min(0) })).default([]),
});

export type BillExtraction = z.infer<typeof billExtractionSchema>;

export const BILL_FIELDS = [
  "consumerNumber",
  "tariffCategory",
  "ratePerUnit",
  "sanctionedLoadKw",
  "unitsLatestMonth",
  "billAmount",
  "billingMonth",
] as const;

export type BillField = (typeof BILL_FIELDS)[number];

/** Printed on only some bills, so a blank here never lowers the read's confidence. */
export const EXTRA_BILL_FIELDS = ["consumerName", "arrearsAmount"] as const;

export type PoorReason = "notBill" | "blurry" | "cropped" | "dark" | "unreadable";

export type BillParseResult =
  | { kind: "ok"; extraction: BillExtraction; confidence: number; lowConfidence: (BillField | (typeof EXTRA_BILL_FIELDS)[number])[] }
  | { kind: "poor"; reason: PoorReason }
  | { kind: "invalid"; error: string };

/** Turns raw model text into a decision: usable, retake the photo, or treat the read as failed. */
export function parseBillResponse(raw: string, lowConfidenceBelow: number): BillParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: "invalid", error: "Model returned text that is not JSON" };
  }
  const parsed = billExtractionSchema.safeParse(json);
  if (!parsed.success) return { kind: "invalid", error: `Model JSON failed validation: ${parsed.error.issues[0]?.message}` };

  const extraction = parsed.data;
  if (!extraction.isElectricityBill) return { kind: "poor", reason: "notBill" };
  if (extraction.imageQuality !== "good") {
    const hasUnits = extraction.unitsLatestMonth.value !== null;
    const hasConsumer = extraction.consumerNumber.value !== null;
    // A slightly soft photo with the key values legible can still go to confirmation.
    if (!hasUnits || !hasConsumer || extraction.imageQuality === "unreadable") {
      return { kind: "poor", reason: extraction.imageQuality };
    }
  }
  if (extraction.unitsLatestMonth.value === null && extraction.billAmount.value === null) {
    return { kind: "poor", reason: "unreadable" };
  }

  // A value the model could not find counts as zero confidence, never as a guess.
  // Most bills print slabs rather than one rate, so a missing rate is normal and not held against the read.
  const expected = BILL_FIELDS.filter((f) => f !== "ratePerUnit" || extraction.ratePerUnit.value !== null);
  const score = (f: BillField) => (extraction[f].value === null ? 0 : extraction[f].confidence);
  const confidence = Number((expected.reduce((sum, f) => sum + score(f), 0) / expected.length).toFixed(2));
  const shaky = EXTRA_BILL_FIELDS.filter((f) => extraction[f].value !== null && extraction[f].confidence < lowConfidenceBelow);
  const lowConfidence = [...expected.filter((f) => score(f) < lowConfidenceBelow), ...shaky];
  return { kind: "ok", extraction, confidence, lowConfidence };
}

/** Editable form of the bill values, and the shape stored as `confirmed`. */
export const confirmedBillSchema = z.object({
  consumerNumber: z.string().trim().max(30).nullable(),
  tariffCategory: z.string().trim().max(60).nullable(),
  ratePerUnit: z.number().positive().max(100).nullable(),
  sanctionedLoadKw: z.number().positive().max(500).nullable(),
  unitsLatestMonth: z.number().min(1).max(100000),
  billAmount: z.number().int().min(1).max(10000000),
  billingMonth: z.string().trim().max(30).nullable(),
  averageMonthlyUnits: z.number().min(1).max(100000),
  consumerName: z.string().trim().max(120).nullable().default(null),
  arrearsAmount: z.number().min(-10000000).max(10000000).nullable().default(null),
  // Carried through from the read. Not shown as form fields.
  connectionPhase: z.number().nullable().default(null),
  meterStatus: z.string().max(60).nullable().default(null),
  solarExportUnits: z.number().min(0).nullable().default(null),
  monthlyUsage: z.array(z.object({ month: z.string().max(10), units: z.number().min(0) })).max(14).default([]),
});

export type ConfirmedBill = z.infer<typeof confirmedBillSchema>;

/** A24: the average of the history evens out seasons; the latest month alone is a fallback. */
export function averageUnits(latest: number, history: number[]) {
  const months = history.filter((u) => u > 0);
  if (months.length === 0) return latest;
  return Math.round(months.reduce((a, b) => a + b, 0) / months.length);
}

/** Show only the last 4 digits anywhere outside the bill check itself. */
export function maskConsumerNumber(value: string | null | undefined) {
  if (!value) return "Not read";
  const tail = value.replace(/\s/g, "").slice(-4);
  return `•••• ${tail}`;
}

/** A20: the subsidy rule is residential, so commercial tariffs get a different segment and no subsidy. */
export function segmentFromTariff(tariffCategory: string | null | undefined) {
  if (!tariffCategory) return "RESIDENTIAL";
  const t = tariffCategory.toUpperCase();
  const commercial = /COMMERCIAL|NON.?RESIDENTIAL|INDUSTRIAL|LT[\s-]*(II|III|IV|V|VI)\b/.test(t);
  return commercial ? "COMMERCIAL" : "RESIDENTIAL";
}
