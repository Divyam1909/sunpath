import { describe, expect, it } from "vitest";
import { checkPromise, sumPromises } from "./promise";
import { DEFAULT_SETTINGS as settings } from "./settings";

const projection = {
  months: [
    { index: 2, use: 300, generation: 360, billedUnits: 0, bankedUnits: 60, before: 3000, after: 150.8 },
    { index: 6, use: 300, generation: 210, billedUnits: 90, bankedUnits: 0, before: 3000, after: 700 },
  ],
};

const check = (month: string, currentBillAmount: number) => checkPromise({ month, currentBillAmount, projection }, settings);

describe("checkPromise", () => {
  it("is on track when the bill matches the promise", () => {
    expect(check("2027-03", 150.8)).toEqual({
      beforeBill: 3000,
      promisedBill: 151,
      promisedSaving: 2849,
      actualSaving: 2849,
      ratio: 1,
      verdict: "ON_TRACK",
    });
  });

  it("compares a monsoon bill with the monsoon promise, not the year's average", () => {
    expect(check("2027-07", 700)?.verdict).toBe("ON_TRACK");
  });

  it("asks staff to watch a bill that falls short", () => {
    expect(check("2027-03", 700)).toMatchObject({ verdict: "WATCH", ratio: 0.81 });
  });

  it("calls a big shortfall behind", () => {
    expect(check("2027-03", 1800)).toMatchObject({ verdict: "BEHIND", ratio: 0.42 });
  });

  it("does not guess for a month it has no promise for", () => {
    expect(check("2027-11", 700)).toBeNull();
  });
});

describe("sumPromises", () => {
  it("adds up what was delivered across bills", () => {
    const rows = [{ promisedSaving: 3000, actualSaving: 2700 }, { promisedSaving: 2000, actualSaving: 2100 }];
    expect(sumPromises(rows)).toEqual({ bills: 2, promisedSaving: 5000, actualSaving: 4800, percent: 96 });
  });

  it("has no percentage before the first bill", () => {
    expect(sumPromises([]).percent).toBeNull();
  });
});
