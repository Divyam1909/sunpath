import { describe, expect, it } from "vitest";
import { findBlockers, namesMatch, type BlockerFacts } from "./blockers";
import { DEFAULT_SETTINGS as settings } from "./settings";

const clean: BlockerFacts = {
  leadName: "Prashant Wankhede",
  ownership: "OWNER",
  segment: "RESIDENTIAL",
  consumerName: "SHRI PRASHANT R WANKHEDE",
  arrearsAmount: 0,
  solarExportUnits: null,
  meterStatus: "Normal",
  sizing: { demandKw: 3, recommendedKw: 3, reasons: [{ code: "demand", monthlyUnits: 340, neededKw: 2.91, roundedKw: 3 }] },
};

const codes = (facts: Partial<BlockerFacts>) => findBlockers({ ...clean, ...facts }, settings).map((b) => b.code);

describe("namesMatch", () => {
  it.each([
    ["Prashant Wankhede", "SHRI PRASHANT R WANKHEDE"],
    ["Prashant Wankhede", "WANKHEDE PRASHANT"],
    ["Prashant Wankhede", "P R WANKHEDE"],
    ["Prashant Wankhede", "SMT. PRASHANT WANKHADE"],
    ["Rekha", "REKHA INGLE"],
  ])("accepts %s as %s", (a, b) => {
    expect(namesMatch(a, b)).toBe(true);
  });

  it.each([
    ["Prashant Wankhede", "RAMESH WANKHEDE"],
    ["Prashant Wankhede", "SUNITA KALE"],
  ])("does not accept %s as %s", (a, b) => {
    expect(namesMatch(a, b)).toBe(false);
  });

  it("does not guess at a name in Devanagari", () => {
    expect(namesMatch("Prashant Wankhede", "प्रशांत वानखेडे")).toBeNull();
  });
});

describe("findBlockers", () => {
  it("finds nothing on a clean bill", () => {
    expect(codes({})).toEqual([]);
  });

  it("flags a connection in someone else's name", () => {
    expect(findBlockers({ ...clean, consumerName: "RAMESH WANKHEDE" }, settings)[0]).toEqual({
      code: "nameMismatch",
      severity: "STOPS",
      params: { onBill: "RAMESH WANKHEDE" },
    });
  });

  it("ignores small arrears and a credit, and flags large arrears", () => {
    expect(codes({ arrearsAmount: 500 })).toEqual([]);
    expect(codes({ arrearsAmount: -1.9 })).toEqual([]);
    expect(codes({ arrearsAmount: 2998.17 })).toEqual(["arrears"]);
  });

  it("says when the sanctioned load holds the system back", () => {
    const sizing = { demandKw: 4, recommendedKw: 2, reasons: [{ code: "loadCap" as const, sanctionedLoadKw: 2 }] };
    expect(findBlockers({ ...clean, sizing }, settings)).toEqual([{ code: "loadLow", severity: "CHECK", params: { loadKw: 2, wantedKw: 4 } }]);
  });

  it("flags a commercial tariff and a tenant", () => {
    expect(codes({ segment: "COMMERCIAL", ownership: "TENANT" })).toEqual(["nonResidential", "tenant"]);
  });

  it("flags a bill that already shows solar export", () => {
    expect(codes({ solarExportUnits: 62 })).toEqual(["alreadySolar"]);
  });

  it("flags a faulty meter but accepts Normal and सामान्य", () => {
    expect(codes({ meterStatus: "Faulty" })).toEqual(["meterFault"]);
    expect(codes({ meterStatus: "NORMAL" })).toEqual([]);
    expect(codes({ meterStatus: "सामान्य" })).toEqual([]);
  });
});
