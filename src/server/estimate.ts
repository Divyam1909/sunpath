import { buildOption, resolveTariff } from "@/domain/quote";
import { pickActiveRule, type Dated, type PriceRule, type SubsidyRule } from "@/domain/rules";
import { billForThisMonth, segmentFromTariff, type ConfirmedBill } from "@/domain/bill";
import { istDate } from "@/domain/format";
import { projectBills } from "@/domain/projection";
import type { Settings } from "@/domain/settings";
import type { BillTariff, TariffRule } from "@/domain/tariff";
import { buildUsageYear, type UsageYear } from "@/domain/usage";
import { db } from "@/server/db";

const toIso = (date: Date) => date.toISOString().slice(0, 10);

function dated<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(row: T) {
  return { ...row, effectiveFrom: toIso(row.effectiveFrom), effectiveTo: row.effectiveTo ? toIso(row.effectiveTo) : null };
}

export async function loadRules() {
  const [subsidy, price, tariff] = await Promise.all([
    db.subsidyRule.findMany({ orderBy: { effectiveFrom: "desc" } }),
    db.priceRule.findMany({ orderBy: { effectiveFrom: "desc" } }),
    db.tariffRule.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ]);
  return {
    subsidy: subsidy.map((row) => dated(row)) as unknown as (SubsidyRule & Dated)[],
    price: price.map((row) => dated(row)) as unknown as (PriceRule & Dated)[],
    tariff: tariff.map((row) => dated(row)) as unknown as (TariffRule & Dated)[],
  };
}

export type LoadedRules = Awaited<ReturnType<typeof loadRules>>;

/** Picks the rules for a quote. Price rules fall back to residential so commercial leads still get a price. */
export function rulesFor(rules: LoadedRules, date: string, segment: string) {
  return {
    subsidy: pickActiveRule(rules.subsidy, date, segment),
    price: pickActiveRule(rules.price, date, segment) ?? pickActiveRule(rules.price, date, "RESIDENTIAL"),
  };
}

/** The dated tariff for a date, in the form a quote keeps a copy of. Null for a segment with no tariff rule. */
export function tariffFor(rules: LoadedRules, date: string, segment: string): BillTariff | null {
  const rule = pickActiveRule(rules.tariff, date, segment);
  if (!rule) return null;
  const { name, effectiveFrom, slabs, fixedSinglePhase, fixedThreePhase, wheelingPerUnit, dutyPercent } = rule;
  return { name, effectiveFrom, slabs, fixedSinglePhase, fixedThreePhase, wheelingPerUnit, dutyPercent };
}

export const usageYearOf = (bill: ConfirmedBill | null, monthlyUnits: number, settings: Settings): UsageYear =>
  buildUsageYear(bill?.monthlyUsage ?? [], monthlyUnits, settings);

export const phaseOf = (bill: ConfirmedBill | null): 1 | 3 => (bill?.connectionPhase === 3 ? 3 : 1);

/** The homeowner's real bills before and after solar. Null where no tariff rule applies. */
export async function billViewFor(systemKw: number, bill: ConfirmedBill | null, monthlyUnits: number, settings: Settings) {
  const rules = await loadRules();
  const tariff = tariffFor(rules, istDate(), segmentFromTariff(bill?.tariffCategory));
  if (!tariff) return null;
  const year = usageYearOf(bill, monthlyUnits, settings);
  const projection = projectBills({ monthlyUnits: year.months.map((m) => m.units), systemKw, tariff, phase: phaseOf(bill) }, settings);
  return { tariff, year, projection };
}

/** The homeowner's early estimate on the result page. Same engine as the quote. */
export async function estimateFor(systemKw: number, bill: ConfirmedBill | null, monthlyUnits: number, settings: Settings) {
  const rules = await loadRules();
  const segment = segmentFromTariff(bill?.tariffCategory);
  const { subsidy, price } = rulesFor(rules, istDate(), segment);
  if (!price) return null;
  const tariffPerUnit = resolveTariff(
    { ratePerUnit: bill?.ratePerUnit ?? null, billAmount: bill ? billForThisMonth(bill) : null, units: bill?.unitsLatestMonth ?? null },
    settings,
  );
  return buildOption(systemKw, { monthlyUnits, tariffPerUnit, maxKw: systemKw, segment }, { subsidy, price }, settings);
}
