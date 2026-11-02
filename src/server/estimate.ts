import { buildOption, resolveTariff } from "@/domain/quote";
import { pickActiveRule, type Dated, type PriceRule, type SubsidyRule } from "@/domain/rules";
import { segmentFromTariff, type ConfirmedBill } from "@/domain/bill";
import { istDate } from "@/domain/format";
import type { Settings } from "@/domain/settings";
import { db } from "@/server/db";

const toIso = (date: Date) => date.toISOString().slice(0, 10);

function dated<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(row: T) {
  return { ...row, effectiveFrom: toIso(row.effectiveFrom), effectiveTo: row.effectiveTo ? toIso(row.effectiveTo) : null };
}

export async function loadRules() {
  const [subsidy, price] = await Promise.all([
    db.subsidyRule.findMany({ orderBy: { effectiveFrom: "desc" } }),
    db.priceRule.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ]);
  return {
    subsidy: subsidy.map((row) => dated(row)) as unknown as (SubsidyRule & Dated)[],
    price: price.map((row) => dated(row)) as unknown as (PriceRule & Dated)[],
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

/** The homeowner's early estimate on the result page. Same engine as the quote. */
export async function estimateFor(systemKw: number, bill: ConfirmedBill | null, monthlyUnits: number, settings: Settings) {
  const rules = await loadRules();
  const segment = segmentFromTariff(bill?.tariffCategory);
  const { subsidy, price } = rulesFor(rules, istDate(), segment);
  if (!price) return null;
  const tariffPerUnit = resolveTariff(
    { ratePerUnit: bill?.ratePerUnit ?? null, billAmount: bill?.billAmount ?? null, units: bill?.unitsLatestMonth ?? null },
    settings,
  );
  return buildOption(systemKw, { monthlyUnits, tariffPerUnit, maxKw: systemKw, segment }, { subsidy, price }, settings);
}
