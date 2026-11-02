import { parseBillMonth } from "./usage";

export type FieldOutcome = "CORRECT" | "WRONG" | "MISSED" | "INVENTED";

export type TruthValue = string | number | null;

const digits = (value: string) => value.replace(/\D/g, "");
const compact = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

function sameValue(field: string, read: TruthValue, truth: Exclude<TruthValue, null>) {
  if (typeof truth === "number") return typeof read === "number" && Math.abs(read - truth) < 0.01;
  const text = String(read);
  if (field === "billingMonth") return parseBillMonth(text) === parseBillMonth(truth);
  if (field === "consumerNumber") return digits(text) === digits(truth);
  // A tariff can be written many ways, so the truth is the code that must appear, such as LTI.
  return compact(text).includes(compact(truth));
}

/**
 * Marks one field. A null truth means the value is hidden or absent on the document, so reading one
 * there is an invented value: the worst outcome, as the design relies on the model not guessing.
 */
export function compareField(field: string, read: TruthValue | undefined, truth: TruthValue): FieldOutcome {
  const value = read ?? null;
  if (truth === null) return value === null ? "CORRECT" : "INVENTED";
  if (value === null) return "MISSED";
  return sameValue(field, value, truth) ? "CORRECT" : "WRONG";
}

export interface UsageRow {
  month: string | null;
  units: number;
}

/** The share of the printed history read correctly, month by month. */
export function compareHistory(read: UsageRow[], truth: UsageRow[]) {
  if (truth.length === 0) return { correct: 0, total: 0 };
  const months = new Map(read.map((row) => [parseBillMonth(row.month), row.units]));
  const correct = truth.filter((row) => months.get(parseBillMonth(row.month)) === row.units).length;
  return { correct, total: truth.length };
}

export interface FieldScore {
  field: string;
  correct: number;
  total: number;
  invented: number;
}

export function scoreFields(rows: { field: string; outcome: FieldOutcome }[]): FieldScore[] {
  const scores = new Map<string, FieldScore>();
  for (const { field, outcome } of rows) {
    const score = scores.get(field) ?? { field, correct: 0, total: 0, invented: 0 };
    score.total += 1;
    if (outcome === "CORRECT") score.correct += 1;
    if (outcome === "INVENTED") score.invented += 1;
    scores.set(field, score);
  }
  return [...scores.values()];
}

export const percentOf = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct / total) * 100));
