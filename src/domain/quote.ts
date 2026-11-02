import type { PriceRule, SubsidyRule } from "./rules";
import type { Settings } from "./settings";
import { calculateSubsidy, type SubsidyLine } from "./subsidy";

export interface QuoteInputs {
  monthlyUnits: number;
  tariffPerUnit: number;
  /** Largest size roof and sanctioned load allow. */
  maxKw: number;
  segment: string;
}

export interface QuoteOption {
  systemKw: number;
  pricePerKw: number;
  grossCost: number;
  subsidy: number;
  subsidyLines: SubsidyLine[];
  subsidyCapped: boolean;
  netCost: number;
  yearlyGeneration: number;
  unitsOffset: number;
  unitsSurplus: number;
  yearlySavings: number;
  paybackYears: number | null;
  savings25Years: number;
}

export function pricePerKw(systemKw: number, rule: Pick<PriceRule, "bands">) {
  const band = rule.bands.find((b) => b.upToKw === null || systemKw <= b.upToKw);
  return band!.pricePerKw; // schema guarantees an open-ended last band
}

/** A07: printed rate if the bill shows one, else bill amount ÷ units, else the fallback setting. */
export function resolveTariff(
  bill: { ratePerUnit: number | null; billAmount: number | null; units: number | null },
  settings: Settings,
) {
  if (bill.ratePerUnit && bill.ratePerUnit > 0) return bill.ratePerUnit;
  if (bill.billAmount && bill.units) return Number((bill.billAmount / bill.units).toFixed(2));
  return settings.netMetering.fallbackTariffPerUnit;
}

export function optionSizes(recommendedKw: number, maxKw: number, settings: Settings) {
  const { optionStepKw, minKw } = settings.sizing;
  const sizes = [recommendedKw - optionStepKw, recommendedKw, recommendedKw + optionStepKw];
  return sizes.filter((kw) => kw === recommendedKw || (kw >= minKw && kw <= maxKw));
}

export function buildOption(
  systemKw: number,
  inputs: QuoteInputs,
  rules: { subsidy: Pick<SubsidyRule, "slabs" | "capAmount"> | null; price: Pick<PriceRule, "bands"> },
  settings: Settings,
): QuoteOption {
  const rate = pricePerKw(systemKw, rules.price);
  const grossCost = Math.round(systemKw * rate);
  const subsidy = calculateSubsidy(systemKw, rules.subsidy);
  const netCost = grossCost - subsidy.amount;

  const yearlyGeneration = Math.round(systemKw * settings.generationKwhPerKwYear);
  // A06: generated units offset consumption at the full tariff; only the surplus earns the lower rate.
  const yearlyConsumption = inputs.monthlyUnits * 12;
  const unitsOffset = Math.min(yearlyGeneration, yearlyConsumption);
  const unitsSurplus = yearlyGeneration - unitsOffset;
  const yearlySavings = Math.round(
    unitsOffset * inputs.tariffPerUnit + unitsSurplus * settings.netMetering.surplusRatePerUnit,
  );

  return {
    systemKw,
    pricePerKw: rate,
    grossCost,
    subsidy: subsidy.amount,
    subsidyLines: subsidy.lines,
    subsidyCapped: subsidy.capped,
    netCost,
    yearlyGeneration,
    unitsOffset,
    unitsSurplus,
    yearlySavings,
    paybackYears: yearlySavings > 0 ? Number((netCost / yearlySavings).toFixed(1)) : null,
    savings25Years: yearlySavings * 25 - netCost, // A08
  };
}

export function buildQuoteOptions(
  sizes: number[],
  inputs: QuoteInputs,
  rules: { subsidy: Pick<SubsidyRule, "slabs" | "capAmount"> | null; price: Pick<PriceRule, "bands"> },
  settings: Settings,
) {
  return sizes.map((kw) => buildOption(kw, inputs, rules, settings));
}
