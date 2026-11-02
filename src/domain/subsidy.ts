import type { SubsidyRule } from "./rules";

export interface SubsidyLine {
  kw: number;
  ratePerKw: number;
  amount: number;
}

export interface SubsidyResult {
  amount: number;
  lines: SubsidyLine[];
  uncapped: number;
  capped: boolean;
}

/** Slab maths: each slab pays its rate on the part of the system inside it, pro rata for fractional kW. */
export function calculateSubsidy(systemKw: number, rule: Pick<SubsidyRule, "slabs" | "capAmount"> | null): SubsidyResult {
  if (!rule) return { amount: 0, lines: [], uncapped: 0, capped: false };
  const lines: SubsidyLine[] = [];
  for (const slab of rule.slabs) {
    const kw = Math.min(systemKw, slab.toKw) - slab.fromKw;
    if (kw <= 0) continue;
    lines.push({ kw, ratePerKw: slab.ratePerKw, amount: Math.round(kw * slab.ratePerKw) });
  }
  const uncapped = lines.reduce((sum, line) => sum + line.amount, 0);
  return { amount: Math.min(uncapped, rule.capAmount), lines, uncapped, capped: uncapped > rule.capAmount };
}
