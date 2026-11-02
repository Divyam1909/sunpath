import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS as settings } from "./settings";
import { averageFromUsage, buildUsageYear, checkSeason, monthsBefore, parseBillMonth, seasonalAverage, usageFromBill } from "./usage";

// The history printed on MSEDCL's published September 2022 bill, a real home.
const REAL_2022 = [
  ["Aug 2022", 180], ["Jul 2022", 215], ["Jun 2022", 229], ["May 2022", 236], ["Apr 2022", 142], ["Mar 2022", 83],
  ["Feb 2022", 112], ["Jan 2022", 114], ["Dec 2021", 124], ["Nov 2021", 165], ["Oct 2021", 176], ["Sep 2021", 194],
].map(([month, units]) => ({ month: month as string, units: units as number }));

describe("parseBillMonth", () => {
  it.each([
    ["Sep 2026", "2026-09"],
    ["SEP-2022", "2022-09"],
    ["Oct-26", "2026-10"],
    ["October 2026", "2026-10"],
    ["2026-09", "2026-09"],
    ["09/2026", "2026-09"],
  ])("reads %s", (text, month) => {
    expect(parseBillMonth(text)).toBe(month);
  });

  it.each(["", "soon", "13/2026", "Foo 2026"])("does not guess at %s", (text) => {
    expect(parseBillMonth(text)).toBeNull();
  });
});

describe("monthsBefore", () => {
  it("crosses a year", () => {
    expect(monthsBefore("2026-02", 3)).toBe("2025-11");
  });
});

describe("usageFromBill", () => {
  it("sorts a real bill's newest-first history and adds the billed month", () => {
    const usage = usageFromBill({ billingMonth: "Sep 2022", unitsLatestMonth: 202, monthlyUsage: REAL_2022 });
    expect(usage).toHaveLength(12);
    expect(usage[0]).toEqual({ month: "2021-10", units: 176 });
    expect(usage[11]).toEqual({ month: "2022-09", units: 202 });
  });

  it("dates an unlabelled history back from the billing month", () => {
    const usage = usageFromBill({ billingMonth: "Sep 2026", unitsLatestMonth: 300, monthlyUnitsHistory: [100, 200, 300] });
    expect(usage).toEqual([
      { month: "2026-07", units: 100 },
      { month: "2026-08", units: 200 },
      { month: "2026-09", units: 300 },
    ]);
  });
});

describe("averageFromUsage", () => {
  it("averages the months and leaves out empty ones", () => {
    const usage = [{ month: "2026-01", units: 100 }, { month: "2026-02", units: 0 }, { month: "2026-03", units: 200 }];
    expect(averageFromUsage(usage, 200, settings)).toBe(150);
  });

  it("scales one May bill down, so a peak month does not oversize the system", () => {
    expect(averageFromUsage([{ month: "2026-05", units: 400 }], 400, settings)).toBe(301);
  });

  it("scales one December bill up", () => {
    expect(seasonalAverage(240, "2026-12", settings)).toBe(300);
  });

  it("falls back to the bill's units when the month is unknown", () => {
    expect(averageFromUsage([], 340, settings)).toBe(340);
  });
});

describe("buildUsageYear", () => {
  it("uses every printed month of a real bill and finds its summer peak", () => {
    const usage = usageFromBill({ billingMonth: "Sep 2022", unitsLatestMonth: 202, monthlyUsage: REAL_2022 });
    const year = buildUsageYear(usage, 168, settings);
    expect(year.basis).toBe("BILL_HISTORY");
    expect(year.months.every((m) => !m.estimated)).toBe(true);
    expect(year.annualUnits).toBe(1978);
    expect(year.peak).toMatchObject({ index: 4, units: 236 });
    expect(year.low).toMatchObject({ index: 2, units: 83 });
  });

  it("shapes a whole year from one bill and marks those months as estimates", () => {
    const year = buildUsageYear([{ month: "2026-09", units: 300 }], 300, settings);
    expect(year.basis).toBe("ONE_MONTH");
    expect(year.months.filter((m) => m.estimated)).toHaveLength(11);
    expect(year.months[4].units).toBeGreaterThan(year.months[11].units);
    expect(year.averageUnits).toBe(300);
  });
});

describe("checkSeason", () => {
  it("flags a bill far above the year's average", () => {
    expect(checkSeason(400, 300, 0.2)).toEqual({ ratio: 1.33, misleading: true, direction: "ABOVE" });
  });

  it("flags a bill far below it", () => {
    expect(checkSeason(150, 300, 0.2)).toMatchObject({ misleading: true, direction: "BELOW" });
  });

  it("stays quiet for a typical month", () => {
    expect(checkSeason(310, 300, 0.2)).toMatchObject({ misleading: false, direction: "TYPICAL" });
  });
});
