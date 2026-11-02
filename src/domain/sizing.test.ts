import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import { sizeSystem, usableRoofSqm } from "./sizing";

const size = (monthlyUnits: number, roofAreaSqm = 100, sanctionedLoadKw: number | null = 10) =>
  sizeSystem({ monthlyUnits, roofAreaSqm, sanctionedLoadKw }, DEFAULT_SETTINGS);

describe("sizeSystem", () => {
  it("reproduces the sample rows: 340 units gives 3 kW, 85 units gives 1 kW", () => {
    expect(size(340).recommendedKw).toBe(3);
    expect(size(85).recommendedKw).toBe(1);
  });

  it("rounds to the nearest 0.5 kW", () => {
    expect(size(210).recommendedKw).toBe(2); // 1.8 kW
    expect(size(260).recommendedKw).toBe(2); // 2.23 kW
    expect(size(280).recommendedKw).toBe(2.5); // 2.4 kW
  });

  it("never recommends below the 1 kW minimum and says so", () => {
    const result = size(40);
    expect(result.recommendedKw).toBe(1);
    expect(result.reasons.map((r) => r.code)).toContain("minimum");
  });

  it("caps by usable roof at 10 m² per kW", () => {
    const result = size(600, 25); // needs 5 kW, roof holds 2.5
    expect(result.recommendedKw).toBe(2.5);
    expect(result.reasons.map((r) => r.code)).toContain("roofCap");
    expect(result.maxKw).toBe(2.5);
  });

  it("caps by sanctioned load", () => {
    const result = size(600, 100, 3);
    expect(result.recommendedKw).toBe(3);
    expect(result.reasons.map((r) => r.code)).toContain("loadCap");
  });

  it("uses the tighter of roof and load", () => {
    expect(size(600, 25, 2).recommendedKw).toBe(2);
  });

  it("ignores sanctioned load when it is unknown", () => {
    expect(size(340, 100, null).recommendedKw).toBe(3);
  });

  it("recommends nothing when the roof holds less than the minimum", () => {
    const result = size(340, 8);
    expect(result.recommendedKw).toBeNull();
    expect(result.reasons.map((r) => r.code)).toContain("roofTooSmall");
  });

  it("recommends nothing when sanctioned load is below the minimum", () => {
    const result = size(340, 100, 0.5);
    expect(result.recommendedKw).toBeNull();
    expect(result.reasons.map((r) => r.code)).toContain("loadTooSmall");
  });

  it("follows the editable generation factor", () => {
    const settings = { ...DEFAULT_SETTINGS, generationKwhPerKwYear: 1200 };
    expect(sizeSystem({ monthlyUnits: 340, roofAreaSqm: 100, sanctionedLoadKw: 10 }, settings).recommendedKw).toBe(3.5);
  });
});

describe("usableRoofSqm", () => {
  it("takes shaded roof out of the usable area", () => {
    expect(usableRoofSqm(50, "NONE")).toBe(50);
    expect(usableRoofSqm(50, "PARTIAL")).toBe(40);
    expect(usableRoofSqm(50, "HEAVY")).toBe(25);
  });
});
