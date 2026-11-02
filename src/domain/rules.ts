import { z } from "zod";

// Dates in rule tables are plain YYYY-MM-DD strings, compared lexically. Both ends are inclusive.
export type IsoDate = string;

export interface Dated {
  id: string;
  segment: string;
  effectiveFrom: IsoDate;
  effectiveTo: IsoDate | null;
}

export function isActiveOn(rule: Dated, date: IsoDate) {
  return rule.effectiveFrom <= date && (rule.effectiveTo === null || date <= rule.effectiveTo);
}

export function pickActiveRule<T extends Dated>(rules: T[], date: IsoDate, segment: string): T | null {
  return rules.find((r) => r.segment === segment && isActiveOn(r, date)) ?? null;
}

function overlaps(a: Dated, b: Dated) {
  const aEndsBeforeB = a.effectiveTo !== null && a.effectiveTo < b.effectiveFrom;
  const bEndsBeforeA = b.effectiveTo !== null && b.effectiveTo < a.effectiveFrom;
  return !aEndsBeforeB && !bEndsBeforeA;
}

/** Returns the first existing rule the candidate clashes with, ignoring the candidate's own saved row. */
export function findOverlap<T extends Dated>(candidate: Dated, existing: T[]): T | null {
  return (
    existing.find(
      (r) => r.id !== candidate.id && r.segment === candidate.segment && overlaps(candidate, r),
    ) ?? null
  );
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const slabSchema = z.object({
  fromKw: z.number().min(0),
  toKw: z.number().positive(),
  ratePerKw: z.number().int().min(0),
});

export const subsidyRuleSchema = z
  .object({
    id: z.string().default(""),
    schemeName: z.string().trim().min(3).max(120),
    segment: z.string().trim().min(3).max(40),
    slabs: z.array(slabSchema).min(1),
    capAmount: z.number().int().min(0),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable(),
    sourceNote: z.string().trim().max(500),
    verifyBeforeLaunch: z.boolean(),
  })
  .superRefine((rule, ctx) => {
    if (rule.effectiveTo !== null && rule.effectiveTo < rule.effectiveFrom) {
      ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "End date is before start date" });
    }
    let expectedFrom = 0;
    for (const slab of rule.slabs) {
      if (slab.fromKw !== expectedFrom || slab.toKw <= slab.fromKw) {
        ctx.addIssue({ code: "custom", path: ["slabs"], message: "Slabs must start at 0 kW and run on without gaps" });
        break;
      }
      expectedFrom = slab.toKw;
    }
  });

export type SubsidyRule = z.infer<typeof subsidyRuleSchema>;

const bandSchema = z.object({
  upToKw: z.number().positive().nullable(),
  pricePerKw: z.number().int().positive(),
});

export const priceRuleSchema = z
  .object({
    id: z.string().default(""),
    name: z.string().trim().min(3).max(120),
    segment: z.string().trim().min(3).max(40),
    bands: z.array(bandSchema).min(1),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable(),
    note: z.string().trim().max(500),
  })
  .superRefine((rule, ctx) => {
    if (rule.effectiveTo !== null && rule.effectiveTo < rule.effectiveFrom) {
      ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "End date is before start date" });
    }
    const last = rule.bands.length - 1;
    let previous = 0;
    rule.bands.forEach((band, i) => {
      if (i === last ? band.upToKw !== null : band.upToKw === null || band.upToKw <= previous) {
        ctx.addIssue({ code: "custom", path: ["bands"], message: "Bands must ascend and the last must be open-ended" });
      }
      previous = band.upToKw ?? previous;
    });
  });

export type PriceRule = z.infer<typeof priceRuleSchema>;
