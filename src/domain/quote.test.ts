import { describe, expect, it } from "vitest";
import { buildOption, buildQuoteOptions, optionSizes, pricePerKw, resolveTariff } from "./quote";
import { DEFAULT_SETTINGS } from "./settings";

const rules = {
  subsidy: {
    slabs: [
      { fromKw: 0, toKw: 2, ratePerKw: 30000 },
      { fromKw: 2, toKw: 3, ratePerKw: 18000 },
    ],
    capAmount: 78000,
  },
  price: {
    bands: [
      { upToKw: 2, pricePerKw: 70000 },
      { upToKw: 3, pricePerKw: 65000 },
      { upToKw: 5, pricePerKw: 60000 },
      { upToKw: 10, pricePerKw: 55000 },
      { upToKw: null, pricePerKw: 52000 },
    ],
  },
};
const inputs = { monthlyUnits: 340, tariffPerUnit: 9.41, maxKw: 10, segment: "RESIDENTIAL" };

describe("LD-30881 worked example, 3 kW at ₹9.41 per unit", () => {
  const option = buildOption(3, inputs, rules, DEFAULT_SETTINGS);

  it("costs ₹1,95,000 before subsidy and ₹1,17,000 after", () => {
    expect(option).toMatchObject({ grossCost: 195000, subsidy: 78000, netCost: 117000 });
  });

  it("generates 4,200 units, offsets 4,080, and credits 120 at the surplus rate", () => {
    expect(option).toMatchObject({ yearlyGeneration: 4200, unitsOffset: 4080, unitsSurplus: 120 });
    expect(option.yearlySavings).toBe(38753); // 4,080 × 9.41 + 120 × 3
  });

  it("pays back in 3 years and saves ₹8,51,825 over 25", () => {
    expect(option.paybackYears).toBe(3);
    expect(option.savings25Years).toBe(38753 * 25 - 117000);
    expect(option.savings25Years).toBe(851825);
  });
});

describe("payback edge cases", () => {
  it("gives no surplus when generation is below consumption", () => {
    const option = buildOption(2, inputs, rules, DEFAULT_SETTINGS);
    expect(option).toMatchObject({ unitsOffset: 2800, unitsSurplus: 0, yearlySavings: 26348 });
  });

  it("values oversizing honestly: extra units earn the surplus rate only", () => {
    const three = buildOption(3, inputs, rules, DEFAULT_SETTINGS);
    const four = buildOption(4, inputs, rules, DEFAULT_SETTINGS);
    expect(four.yearlySavings - three.yearlySavings).toBe(1400 * 3);
    expect(four.paybackYears!).toBeGreaterThan(three.paybackYears!);
  });

  it("returns no payback when there are no savings", () => {
    const option = buildOption(1, { ...inputs, monthlyUnits: 0, tariffPerUnit: 9 }, rules, {
      ...DEFAULT_SETTINGS,
      netMetering: { ...DEFAULT_SETTINGS.netMetering, surplusRatePerUnit: 0 },
    });
    expect(option.paybackYears).toBeNull();
  });

  it("charges full price with no subsidy when no rule applies", () => {
    const option = buildOption(3, inputs, { ...rules, subsidy: null }, DEFAULT_SETTINGS);
    expect(option).toMatchObject({ subsidy: 0, netCost: 195000, subsidyLines: [] });
  });
});

describe("pricePerKw", () => {
  it.each([
    [1, 70000],
    [2, 70000],
    [2.5, 65000],
    [3, 65000],
    [3.5, 60000],
    [10, 55000],
    [25, 52000],
  ])("%s kW costs ₹%s per kW", (kw, rate) => {
    expect(pricePerKw(kw, rules.price)).toBe(rate);
  });
});

describe("optionSizes", () => {
  it("offers one step either side of the recommendation", () => {
    expect(optionSizes(3, 10, DEFAULT_SETTINGS)).toEqual([2, 3, 4]);
  });

  it("drops sizes below the minimum", () => {
    expect(optionSizes(1, 10, DEFAULT_SETTINGS)).toEqual([1, 2]);
  });

  it("drops sizes above roof or load", () => {
    expect(optionSizes(3, 3, DEFAULT_SETTINGS)).toEqual([2, 3]);
  });

  it("keeps the recommendation even if it is the only size", () => {
    expect(optionSizes(1, 1, DEFAULT_SETTINGS)).toEqual([1]);
  });

  it("builds one option per size", () => {
    const options = buildQuoteOptions([2, 3, 4], inputs, rules, DEFAULT_SETTINGS);
    expect(options.map((o) => o.systemKw)).toEqual([2, 3, 4]);
  });
});

describe("resolveTariff", () => {
  it("prefers the rate printed on the bill", () => {
    expect(resolveTariff({ ratePerUnit: 8.5, billAmount: 3200, units: 340 }, DEFAULT_SETTINGS)).toBe(8.5);
  });

  it("falls back to bill amount over units", () => {
    expect(resolveTariff({ ratePerUnit: null, billAmount: 3200, units: 340 }, DEFAULT_SETTINGS)).toBe(9.41);
  });

  it("falls back to the setting when neither is known", () => {
    expect(resolveTariff({ ratePerUnit: null, billAmount: null, units: null }, DEFAULT_SETTINGS)).toBe(9);
  });
});
