import { describe, expect, it } from "vitest";
import { calculateBill, tariffRuleSchema, topSlabRate, type BillTariff } from "./tariff";

const slabs = (rows: [number | null, number, number][]) => rows.map(([upToUnits, energyPerUnit, facPerUnit]) => ({ upToUnits, energyPerUnit, facPerUnit }));

// Rates exactly as printed on MSEDCL's published LT bill, October 2026.
const FY2026: BillTariff = {
  name: "LT-I(B) Residential FY 2026-27",
  effectiveFrom: "2026-04-01",
  slabs: slabs([[100, 3.96, 0.25], [300, 10.8, 0.5], [500, 15.03, 0.65], [1000, 17.53, 0.7], [null, 17.53, 0.7]]),
  fixedSinglePhase: 130,
  fixedThreePhase: 435,
  wheelingPerUnit: 1.6,
  dutyPercent: 16,
};

// Rates exactly as printed on MSEDCL's published LT bill, September 2022.
const FY2022: BillTariff = {
  name: "LT-I(B) Residential 2022",
  effectiveFrom: "2022-04-01",
  slabs: slabs([[100, 3.36, 0.65], [300, 7.34, 1.45], [500, 10.37, 2.05], [1000, 11.86, 2.35], [null, 11.86, 2.35]]),
  fixedSinglePhase: 105,
  fixedThreePhase: 105,
  wheelingPerUnit: 1.35,
  dutyPercent: 16,
};

describe("calculateBill against real MSEDCL bills", () => {
  it("matches the October 2026 bill line by line: 146 units, ₹1,473.66", () => {
    expect(calculateBill(146, FY2026, { otherCharges: -34 })).toEqual({
      fixed: 130,
      energy: 892.8,
      wheeling: 233.6,
      fac: 48,
      other: -34,
      duty: 203.26,
      total: 1473.66,
    });
  });

  it("matches the September 2022 bill, whose period of 1.03 months widens the slabs: 202 units, ₹1,926.69", () => {
    expect(calculateBill(202, FY2022, { periodMonths: 1.03 })).toEqual({
      fixed: 105,
      energy: 1072.74,
      wheeling: 272.7,
      fac: 210.5,
      other: 0,
      duty: 265.75,
      total: 1926.69,
    });
  });
});

describe("calculateBill", () => {
  it("still charges the fixed part at zero units", () => {
    expect(calculateBill(0, FY2026)).toMatchObject({ energy: 0, wheeling: 0, total: 150.8 });
  });

  it("uses the three-phase fixed charge when asked", () => {
    expect(calculateBill(0, FY2026, { phase: 3 }).fixed).toBe(435);
  });

  it("charges the open-ended slab above 1,000 units", () => {
    expect(calculateBill(1200, FY2026).energy).toBe(396 + 2160 + 3006 + 8765 + 3506);
  });
});

describe("topSlabRate", () => {
  it("rises with use, which is why solar saves more for a big user", () => {
    expect(topSlabRate(90, FY2026)).toBe(6.74);
    expect(topSlabRate(340, FY2026)).toBe(20.04);
    expect(topSlabRate(340, FY2026)).toBeGreaterThan(topSlabRate(90, FY2026) * 2.5);
  });
});

describe("tariffRuleSchema", () => {
  const rule = {
    id: "",
    name: "Test tariff",
    segment: "RESIDENTIAL",
    slabs: FY2026.slabs,
    fixedSinglePhase: 130,
    fixedThreePhase: 435,
    wheelingPerUnit: 1.6,
    dutyPercent: 16,
    effectiveFrom: "2026-04-01",
    effectiveTo: "2027-03-31",
    sourceNote: "",
    verifyBeforeLaunch: false,
  };

  it("accepts a real tariff", () => {
    expect(tariffRuleSchema.safeParse(rule).success).toBe(true);
  });

  it("refuses slabs that do not end open-ended", () => {
    expect(tariffRuleSchema.safeParse({ ...rule, slabs: slabs([[100, 3, 0]]) }).success).toBe(false);
  });

  it("refuses an end date before the start date", () => {
    expect(tariffRuleSchema.safeParse({ ...rule, effectiveTo: "2026-01-01" }).success).toBe(false);
  });
});
