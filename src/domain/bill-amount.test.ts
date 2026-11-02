import { describe, expect, it } from "vitest";
import { billForThisMonth } from "./bill";
import { resolveTariff } from "./quote";
import { DEFAULT_SETTINGS as settings } from "./settings";

describe("billForThisMonth", () => {
  it("takes old dues out of the total", () => {
    expect(billForThisMonth({ billAmount: 4520, arrearsAmount: 2998.17 })).toBe(1522);
  });

  it("adds a credit back", () => {
    expect(billForThisMonth({ billAmount: 1470, arrearsAmount: -1.9 })).toBe(1472);
  });

  it("leaves a bill with no arrears alone, so the brief's sample rows do not move", () => {
    expect(billForThisMonth({ billAmount: 3200, arrearsAmount: null })).toBe(3200);
    expect(billForThisMonth({ billAmount: 3200 })).toBe(3200);
  });

  it("keeps the total if arrears are larger than it", () => {
    expect(billForThisMonth({ billAmount: 100, arrearsAmount: 500 })).toBe(100);
  });

  it("stops arrears inflating the rate and so the payback", () => {
    const bill = { billAmount: 8670, arrearsAmount: 2986.44 };
    const inflated = resolveTariff({ ratePerUnit: null, billAmount: bill.billAmount, units: 420 }, settings);
    const fair = resolveTariff({ ratePerUnit: null, billAmount: billForThisMonth(bill), units: 420 }, settings);
    expect(inflated).toBe(20.64);
    expect(fair).toBe(13.53);
  });
});
