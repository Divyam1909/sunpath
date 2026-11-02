import type { Settings } from "./settings";

/** One billed month. `month` is always YYYY-MM. */
export interface MonthUsage {
  month: string;
  units: number;
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Reads the ways bills write a month: "Sep 2026", "SEP-2022", "Oct-26", "2026-09", "09/2026". */
export function parseBillMonth(text: string | null | undefined) {
  if (!text) return null;
  const value = text.trim().toLowerCase();
  const iso = value.match(/^(\d{4})-(\d{1,2})$/);
  if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  const slashed = value.match(/^(\d{1,2})[/-](\d{4})$/);
  if (slashed && Number(slashed[1]) >= 1 && Number(slashed[1]) <= 12) return `${slashed[2]}-${slashed[1].padStart(2, "0")}`;
  const named = value.match(/([a-z]{3})[a-z]*[\s,.'-]*(\d{4}|\d{2})\b/);
  if (!named) return null;
  const index = MONTH_NAMES.indexOf(named[1]);
  if (index < 0) return null;
  const year = named[2].length === 2 ? `20${named[2]}` : named[2];
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

/** The YYYY-MM a number of months before `month`. */
export function monthsBefore(month: string, count: number) {
  const [year, m] = month.split("-").map(Number);
  const total = year * 12 + (m - 1) - count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export const calendarIndex = (month: string) => Number(month.slice(5, 7)) - 1;

interface BillUsageSource {
  billingMonth: string | null;
  unitsLatestMonth: number | null;
  /** Labelled history from a real bill. */
  monthlyUsage?: { month: string | null; units: number }[];
  /** Unlabelled history, oldest first. The last entry is the billing month. */
  monthlyUnitsHistory?: number[];
}

/** Puts a bill's history in month order and keeps the latest reading of each month, up to twelve. */
export function usageFromBill(bill: BillUsageSource): MonthUsage[] {
  const billed = parseBillMonth(bill.billingMonth);
  const byMonth = new Map<string, number>();
  for (const row of bill.monthlyUsage ?? []) {
    const month = parseBillMonth(row.month);
    if (month) byMonth.set(month, row.units);
  }
  if (byMonth.size === 0 && billed) {
    const history = bill.monthlyUnitsHistory ?? [];
    history.forEach((units, i) => byMonth.set(monthsBefore(billed, history.length - 1 - i), units));
  }
  if (billed && bill.unitsLatestMonth !== null) byMonth.set(billed, bill.unitsLatestMonth);
  return [...byMonth.entries()]
    .map(([month, units]) => ({ month, units }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}

/** A36: with one bill and no history, this month is scaled to a typical year by the season. */
export function seasonalAverage(latestUnits: number, month: string | null, settings: Pick<Settings, "seasonalUseFactor">) {
  if (!month) return latestUnits;
  return Math.round(latestUnits / settings.seasonalUseFactor[calendarIndex(month)]);
}

/** A24: the average of the months on the bill. A month of zero means an empty house, so it is left out. */
export function averageFromUsage(usage: MonthUsage[], latestUnits: number, settings: Pick<Settings, "seasonalUseFactor">) {
  const months = usage.filter((row) => row.units > 0);
  if (months.length <= 1) return seasonalAverage(latestUnits, usage[0]?.month ?? null, settings);
  return Math.round(months.reduce((sum, row) => sum + row.units, 0) / months.length);
}

export type UsageBasis = "BILL_HISTORY" | "PARTIAL_HISTORY" | "ONE_MONTH";

export interface UsageMonth {
  /** 0 is January. */
  index: number;
  units: number;
  /** True when the bill did not print this month and the season filled it in. */
  estimated: boolean;
}

export interface UsageYear {
  months: UsageMonth[];
  basis: UsageBasis;
  annualUnits: number;
  averageUnits: number;
  peak: UsageMonth;
  low: UsageMonth;
}

/** Twelve calendar months of use. Months the bill did not print are filled from the seasonal pattern. */
export function buildUsageYear(usage: MonthUsage[], averageUnits: number, settings: Pick<Settings, "seasonalUseFactor">): UsageYear {
  const factors = settings.seasonalUseFactor;
  const known = new Map(usage.filter((row) => row.units > 0).map((row) => [calendarIndex(row.month), row.units]));
  const scales = [...known].map(([index, units]) => units / factors[index]);
  const scale = scales.length > 0 ? scales.reduce((a, b) => a + b, 0) / scales.length : averageUnits;
  const months = factors.map((factor, index) => {
    const printed = known.get(index);
    return { index, units: printed ?? Math.round(scale * factor), estimated: printed === undefined };
  });
  const annualUnits = months.reduce((sum, m) => sum + m.units, 0);
  const by = (direction: 1 | -1) => months.reduce((best, m) => ((m.units - best.units) * direction > 0 ? m : best));
  return {
    months,
    basis: known.size >= 10 ? "BILL_HISTORY" : known.size >= 2 ? "PARTIAL_HISTORY" : "ONE_MONTH",
    annualUnits,
    averageUnits: Math.round(annualUnits / 12),
    peak: by(1),
    low: by(-1),
  };
}

export interface SeasonalCheck {
  /** Latest month as a share of the year's average, for example 1.4 is 40% above. */
  ratio: number;
  misleading: boolean;
  direction: "ABOVE" | "BELOW" | "TYPICAL";
}

/** Flags a bill from an unusual month, which would size the system wrongly if it were taken alone. */
export function checkSeason(latestUnits: number, averageUnits: number, threshold: number): SeasonalCheck {
  const ratio = averageUnits > 0 ? Number((latestUnits / averageUnits).toFixed(2)) : 1;
  const misleading = Math.abs(ratio - 1) >= threshold;
  return { ratio, misleading, direction: !misleading ? "TYPICAL" : ratio > 1 ? "ABOVE" : "BELOW" };
}
