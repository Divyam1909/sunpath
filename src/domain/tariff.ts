import { z } from "zod";
import type { IsoDate } from "./rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const tariffSlabSchema = z.object({
  /** Upper limit of the slab in units a month. The last slab is open-ended. */
  upToUnits: z.number().positive().nullable(),
  energyPerUnit: z.number().min(0),
  facPerUnit: z.number().min(0),
});

export type TariffSlab = z.infer<typeof tariffSlabSchema>;

export const tariffRuleSchema = z
  .object({
    id: z.string().default(""),
    name: z.string().trim().min(3).max(120),
    segment: z.string().trim().min(3).max(40),
    slabs: z.array(tariffSlabSchema).min(1),
    fixedSinglePhase: z.number().min(0),
    fixedThreePhase: z.number().min(0),
    wheelingPerUnit: z.number().min(0),
    dutyPercent: z.number().min(0).max(100),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable(),
    sourceNote: z.string().trim().max(500),
    verifyBeforeLaunch: z.boolean(),
  })
  .superRefine((rule, ctx) => {
    if (rule.effectiveTo !== null && rule.effectiveTo < rule.effectiveFrom) {
      ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "End date is before start date" });
    }
    const last = rule.slabs.length - 1;
    let previous = 0;
    rule.slabs.forEach((slab, i) => {
      if (i === last ? slab.upToUnits !== null : slab.upToUnits === null || slab.upToUnits <= previous) {
        ctx.addIssue({ code: "custom", path: ["slabs"], message: "Slabs must ascend and the last must be open-ended" });
      }
      previous = slab.upToUnits ?? previous;
    });
  });

export type TariffRule = z.infer<typeof tariffRuleSchema>;

/** The parts of a dated rule the bill needs. A quote keeps a copy of exactly this. */
export type BillTariff = Pick<TariffRule, "slabs" | "fixedSinglePhase" | "fixedThreePhase" | "wheelingPerUnit" | "dutyPercent"> & {
  name: string;
  effectiveFrom: IsoDate;
};

export interface BillOptions {
  phase?: 1 | 3;
  /** MSEDCL widens the slabs in step with the billing period, for example 1.03 months. */
  periodMonths?: number;
  /** Rebates and credits on the bill. Electricity duty is charged after them. */
  otherCharges?: number;
}

export interface BillLines {
  fixed: number;
  energy: number;
  wheeling: number;
  fac: number;
  other: number;
  duty: number;
  total: number;
}

const rupees = (value: number) => Math.round(value * 100) / 100;

/** A40: one month's bill by slabs. Reproduces real MSEDCL bills to the paisa; see tariff.test.ts. */
export function calculateBill(units: number, tariff: BillTariff, options: BillOptions = {}): BillLines {
  const { phase = 1, periodMonths = 1, otherCharges = 0 } = options;
  let remaining = units;
  let floor = 0;
  let energy = 0;
  let fac = 0;
  for (const slab of tariff.slabs) {
    const ceiling = slab.upToUnits === null ? Infinity : slab.upToUnits * periodMonths;
    const inSlab = Math.min(remaining, ceiling - floor);
    energy += inSlab * slab.energyPerUnit;
    fac += inSlab * slab.facPerUnit;
    remaining -= inSlab;
    floor = ceiling;
    if (remaining <= 0) break;
  }
  const fixed = phase === 3 ? tariff.fixedThreePhase : tariff.fixedSinglePhase;
  const wheeling = units * tariff.wheelingPerUnit;
  const taxable = fixed + energy + wheeling + fac + otherCharges;
  const duty = taxable * (tariff.dutyPercent / 100);
  return {
    fixed: rupees(fixed),
    energy: rupees(energy),
    wheeling: rupees(wheeling),
    fac: rupees(fac),
    other: rupees(otherCharges),
    duty: rupees(duty),
    total: rupees(taxable + duty),
  };
}

/** The rate paid for the last unit used. This is the rate solar removes first. */
export function topSlabRate(units: number, tariff: BillTariff) {
  const slab = tariff.slabs.find((s) => s.upToUnits === null || units <= s.upToUnits) ?? tariff.slabs[tariff.slabs.length - 1];
  const beforeDuty = slab.energyPerUnit + slab.facPerUnit + tariff.wheelingPerUnit;
  return rupees(beforeDuty * (1 + tariff.dutyPercent / 100));
}
