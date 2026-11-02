import type { Settings } from "./settings";
import { calculateBill, type BillTariff } from "./tariff";
import { buildUsageYear, type MonthUsage, type UsageBasis } from "./usage";

export interface ProjectionInput {
  /** Units used in each calendar month. Index 0 is January. */
  monthlyUnits: number[];
  systemKw: number;
  tariff: BillTariff;
  phase?: 1 | 3;
}

export interface ProjectedMonth {
  /** 0 is January. */
  index: number;
  use: number;
  generation: number;
  billedUnits: number;
  bankedUnits: number;
  before: number;
  after: number;
}

export interface BillProjection {
  months: ProjectedMonth[];
  yearlyBefore: number;
  yearlyAfter: number;
  /** Units left in the bank on 31 March, paid for at the surplus rate. */
  surplusUnits: number;
  surplusCredit: number;
  yearlySaving: number;
  monthlyBefore: number;
  monthlyAfter: number;
}

type ProjectionSettings = Pick<Settings, "generationKwhPerKwYear" | "generationShare"> & { netMetering: Pick<Settings["netMetering"], "surplusRatePerUnit"> };

/** The MSEDCL banking year runs April to March. */
const YEAR_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

/**
 * A37: a year of real bills, before and after solar. Export is netted against import month by month
 * at full slab rates, spare units bank forward, and the balance on 31 March earns the surplus rate.
 */
export function projectBills(input: ProjectionInput, settings: ProjectionSettings): BillProjection {
  const { monthlyUnits, systemKw, tariff, phase = 1 } = input;
  const yearly = systemKw * settings.generationKwhPerKwYear;
  let banked = 0;
  const months = YEAR_ORDER.map((index) => {
    const use = monthlyUnits[index];
    const generation = Math.round(yearly * settings.generationShare[index]);
    const available = generation + banked;
    const billedUnits = Math.max(use - available, 0);
    banked = Math.max(available - use, 0);
    return {
      index,
      use,
      generation,
      billedUnits,
      bankedUnits: banked,
      before: calculateBill(use, tariff, { phase }).total,
      after: calculateBill(billedUnits, tariff, { phase }).total,
    };
  });
  const sum = (pick: (m: ProjectedMonth) => number) => Math.round(months.reduce((total, m) => total + pick(m), 0));
  const yearlyBefore = sum((m) => m.before);
  const yearlyAfter = sum((m) => m.after);
  const surplusCredit = Math.round(banked * settings.netMetering.surplusRatePerUnit);
  return {
    months,
    yearlyBefore,
    yearlyAfter,
    surplusUnits: banked,
    surplusCredit,
    yearlySaving: yearlyBefore - yearlyAfter + surplusCredit,
    monthlyBefore: Math.round(yearlyBefore / 12),
    monthlyAfter: Math.round(yearlyAfter / 12),
  };
}

/** A37: the year of real bills behind each quote option, frozen with the quote. The promise tracker checks against this. */
export interface BillView {
  tariff: BillTariff;
  basis: UsageBasis;
  monthlyUnits: number[];
  /** Calendar months the bill did not print. */
  estimatedMonths: number[];
  byKw: Record<string, BillProjection>;
}

export function buildBillView(
  input: { tariff: BillTariff; usage: MonthUsage[]; averageUnits: number; phase: 1 | 3; sizes: number[] },
  settings: ProjectionSettings & Pick<Settings, "seasonalUseFactor">,
): BillView {
  const { tariff, usage, averageUnits, phase, sizes } = input;
  const year = buildUsageYear(usage, averageUnits, settings);
  const monthlyUnits = year.months.map((m) => m.units);
  const byKw = Object.fromEntries(sizes.map((systemKw) => [String(systemKw), projectBills({ monthlyUnits, systemKw, tariff, phase }, settings)]));
  const estimatedMonths = year.months.filter((m) => m.estimated).map((m) => m.index);
  return { tariff, basis: year.basis, monthlyUnits, estimatedMonths, byKw };
}

export interface WorthCheck {
  paybackYears: number | null;
  /** True when the honest answer is that solar may not be worth buying. */
  poor: boolean;
}

/** A39: a small user pays cheap slabs, so solar can take too long to pay back. Say so plainly. */
export function checkWorth(netCost: number, yearlySaving: number, poorPaybackYears: number): WorthCheck {
  const paybackYears = yearlySaving > 0 ? Number((netCost / yearlySaving).toFixed(1)) : null;
  return { paybackYears, poor: paybackYears === null || paybackYears > poorPaybackYears };
}

/** How far the published tariff lands from the printed bill. A wide gap suggests a misread, or an average bill. */
export function printedBillGap(printedAmount: number, calculatedAmount: number) {
  if (printedAmount <= 0) return 0;
  return Number(((calculatedAmount - printedAmount) / printedAmount).toFixed(2));
}
