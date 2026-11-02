import { describe, expect, it } from "vitest";
import { checkWorth, printedBillGap, projectBills } from "./projection";
import { DEFAULT_SETTINGS as settings } from "./settings";
import { calculateBill, type BillTariff } from "./tariff";

const tariff: BillTariff = {
  name: "LT-I(B) Residential FY 2026-27",
  effectiveFrom: "2026-04-01",
  slabs: [
    { upToUnits: 100, energyPerUnit: 3.96, facPerUnit: 0.25 },
    { upToUnits: 300, energyPerUnit: 10.8, facPerUnit: 0.5 },
    { upToUnits: 500, energyPerUnit: 15.03, facPerUnit: 0.65 },
    { upToUnits: null, energyPerUnit: 17.53, facPerUnit: 0.7 },
  ],
  fixedSinglePhase: 130,
  fixedThreePhase: 435,
  wheelingPerUnit: 1.6,
  dutyPercent: 16,
};

const flat = (units: number) => Array<number>(12).fill(units);

describe("projectBills", () => {
  it("adds up to the brief's 1,400 units per kW a year", () => {
    const { months } = projectBills({ monthlyUnits: flat(340), systemKw: 3, tariff }, settings);
    const total = months.reduce((sum, m) => sum + m.generation, 0);
    expect(Math.abs(total - 4200)).toBeLessThanOrEqual(6);
  });

  it("generates least in the monsoon", () => {
    const { months } = projectBills({ monthlyUnits: flat(340), systemKw: 3, tariff }, settings);
    const july = months.find((m) => m.index === 6)!;
    const march = months.find((m) => m.index === 2)!;
    expect(july.generation).toBeLessThan(march.generation * 0.6);
  });

  it("removes the dearest slabs first, so the saving beats the average rate", () => {
    const result = projectBills({ monthlyUnits: flat(340), systemKw: 3, tariff }, settings);
    const before = calculateBill(340, tariff).total;
    expect(result.monthlyBefore).toBe(Math.round(before));
    const share = (before - result.monthlyAfter) / before;
    expect(share).toBeGreaterThan(0.75);
  });

  it("still leaves the fixed charge on a month with no billed units", () => {
    const { months } = projectBills({ monthlyUnits: flat(50), systemKw: 3, tariff }, settings);
    expect(months.find((m) => m.index === 2)).toMatchObject({ billedUnits: 0, after: 150.8 });
  });

  it("banks spare units into the monsoon, then pays the year-end balance at the surplus rate", () => {
    const result = projectBills({ monthlyUnits: flat(100), systemKw: 3, tariff }, settings);
    const october = result.months.find((m) => m.index === 9)!;
    expect(october.bankedUnits).toBeGreaterThan(0);
    const generated = result.months.reduce((sum, m) => sum + m.generation, 0);
    expect(result.surplusUnits).toBe(generated - 1200);
    expect(result.surplusCredit).toBe(result.surplusUnits * 3);
  });

  it("starts the bank afresh each April", () => {
    const { months } = projectBills({ monthlyUnits: flat(1), systemKw: 3, tariff }, settings);
    expect(months[0].index).toBe(3);
    expect(months[0].bankedUnits).toBe(months[0].generation - 1);
  });

  it("uses the three-phase fixed charge", () => {
    const result = projectBills({ monthlyUnits: flat(50), systemKw: 3, tariff, phase: 3 }, settings);
    expect(result.months[0].after).toBeCloseTo(435 * 1.16, 2);
  });
});

describe("checkWorth", () => {
  it("accepts a sensible payback", () => {
    expect(checkWorth(117000, 40000, 12)).toEqual({ paybackYears: 2.9, poor: false });
  });

  it("is honest about a long one", () => {
    expect(checkWorth(117000, 6000, 12)).toEqual({ paybackYears: 19.5, poor: true });
  });

  it("is honest when nothing is saved", () => {
    expect(checkWorth(117000, 0, 12)).toEqual({ paybackYears: null, poor: true });
  });
});

describe("printedBillGap", () => {
  it("measures how far the tariff is from the printed bill", () => {
    expect(printedBillGap(3200, 4620)).toBe(0.44);
  });

  it("copes with an empty bill", () => {
    expect(printedBillGap(0, 4620)).toBe(0);
  });
});
