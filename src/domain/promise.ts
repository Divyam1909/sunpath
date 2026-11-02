import type { BillProjection } from "./projection";
import type { Settings } from "./settings";
import { calendarIndex } from "./usage";

export type PromiseVerdict = "ON_TRACK" | "WATCH" | "BEHIND";

export interface PromiseCheck {
  beforeBill: number;
  promisedBill: number;
  promisedSaving: number;
  actualSaving: number;
  /** Actual saving as a share of the promised saving. */
  ratio: number;
  verdict: PromiseVerdict;
}

/** A43: compares a bill after solar with what the quote promised for that same month. */
export function checkPromise(
  input: { month: string; currentBillAmount: number; projection: Pick<BillProjection, "months"> },
  settings: Pick<Settings, "promise">,
): PromiseCheck | null {
  const promised = input.projection.months.find((m) => m.index === calendarIndex(input.month));
  if (!promised) return null;
  const promisedSaving = promised.before - promised.after;
  const actualSaving = promised.before - input.currentBillAmount;
  const ratio = promisedSaving > 0 ? Number((actualSaving / promisedSaving).toFixed(2)) : 1;
  const { onTrackRatio, watchRatio } = settings.promise;
  return {
    beforeBill: Math.round(promised.before),
    promisedBill: Math.round(promised.after),
    promisedSaving: Math.round(promisedSaving),
    actualSaving: Math.round(actualSaving),
    ratio,
    verdict: ratio >= onTrackRatio ? "ON_TRACK" : ratio >= watchRatio ? "WATCH" : "BEHIND",
  };
}

export interface PromiseTotals {
  bills: number;
  promisedSaving: number;
  actualSaving: number;
  /** Null until there is a bill to measure. */
  percent: number | null;
}

export function sumPromises(checks: { promisedSaving: number; actualSaving: number }[]): PromiseTotals {
  const promisedSaving = checks.reduce((sum, c) => sum + c.promisedSaving, 0);
  const actualSaving = checks.reduce((sum, c) => sum + c.actualSaving, 0);
  return {
    bills: checks.length,
    promisedSaving,
    actualSaving,
    percent: promisedSaving > 0 ? Math.round((actualSaving / promisedSaving) * 100) : null,
  };
}
