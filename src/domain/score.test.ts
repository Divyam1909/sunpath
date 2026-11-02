import { describe, expect, it } from "vitest";
import { isVidarbhaPincode } from "./pincode";
import { assessLead, type LeadFacts } from "./score";
import { DEFAULT_SETTINGS } from "./settings";

const facts = (over: Partial<LeadFacts> = {}): LeadFacts => ({
  ownership: "OWNER",
  monthlyBill: 3200,
  monthlyUnits: 340,
  roofAreaSqm: 55,
  pincode: "440010",
  sanctionedLoadKw: 5,
  billConfidence: 0.95,
  ...over,
});
const assess = (over?: Partial<LeadFacts>) => assessLead(facts(over), DEFAULT_SETTINGS);
const codes = (over?: Partial<LeadFacts>) => assess(over).reasons.map((r) => r.code);

describe("the brief's sample rows", () => {
  it("LD-30881 Prashant Wankhede: owner, ₹3,200, 340 units gives 3 kW High", () => {
    const result = assess();
    expect(result).toMatchObject({ score: "HIGH", recommendedKw: 3, nextAction: "SURVEY_VISIT", points: 100 });
  });

  it("LD-30902 Rohit Meshram: tenant, ₹1,900, 210 units gives no size, Low (tenant)", () => {
    const result = assess({ ownership: "TENANT", monthlyBill: 1900, monthlyUnits: 210 });
    expect(result).toMatchObject({ score: "LOW", recommendedKw: null, nextAction: "QUALIFICATION_CALL" });
    expect(result.reasons.map((r) => r.text)).toContain("Tenant: needs owner consent");
  });

  it("LD-30915 Ayesha Siddiqui: owner, ₹650, 85 units gives 1 kW, Low (small bill)", () => {
    const result = assess({ monthlyBill: 650, monthlyUnits: 85 });
    expect(result).toMatchObject({ score: "LOW", recommendedKw: 1, nextAction: "QUALIFICATION_CALL" });
    expect(result.reasons.map((r) => r.text)).toContain("Bill ₹650: small savings");
  });
});

describe("assessLead edge cases", () => {
  it("never rejects: every Low lead gets a call", () => {
    const result = assess({ ownership: "TENANT", monthlyBill: 300, monthlyUnits: 40, roofAreaSqm: 2, pincode: "400001", billConfidence: null });
    expect(result).toMatchObject({ score: "LOW", nextAction: "QUALIFICATION_CALL" });
  });

  it("holds a tenant at Low however good the rest looks", () => {
    expect(assess({ ownership: "TENANT", monthlyBill: 20000, monthlyUnits: 2000, roofAreaSqm: 500 }).score).toBe("LOW");
  });

  it("treats the small-bill threshold as exclusive", () => {
    expect(assess({ monthlyBill: 999, monthlyUnits: 120 }).score).toBe("LOW");
    expect(assess({ monthlyBill: 1000, monthlyUnits: 120 }).score).toBe("MEDIUM");
  });

  it("makes a moderate bill Medium", () => {
    expect(assess({ monthlyBill: 1500, monthlyUnits: 170 })).toMatchObject({ score: "MEDIUM", nextAction: "SURVEY_VISIT", points: 80 });
  });

  it("drops an out-of-area lead to Medium and says why", () => {
    expect(assess({ pincode: "411001" }).score).toBe("MEDIUM");
    expect(codes({ pincode: "411001" })).toContain("outOfArea");
  });

  it("keeps High on a hard-to-read bill alone, with a note to check it", () => {
    expect(assess({ billConfidence: 0.5 }).score).toBe("HIGH");
    expect(codes({ billConfidence: 0.5 })).toContain("lowConfidence");
  });

  it("gives no read-confidence points for hand-typed values", () => {
    expect(assess({ billConfidence: null }).points).toBe(90);
    expect(codes({ billConfidence: null })).toContain("manualBill");
  });

  it("reflects a roof that fits only part of the need", () => {
    const result = assess({ roofAreaSqm: 20 });
    expect(result.recommendedKw).toBe(2);
    expect(codes({ roofAreaSqm: 20 })).toContain("roofPartial");
    expect(result.points).toBe(90);
  });

  it("gets to Medium, not High, when roof and bill read are both weak", () => {
    expect(assess({ roofAreaSqm: 20, billConfidence: 0.5 }).score).toBe("MEDIUM");
  });

  it("reports a roof with no room for a system", () => {
    const result = assess({ roofAreaSqm: 5 });
    expect(result.recommendedKw).toBeNull();
    expect(codes({ roofAreaSqm: 5 })).toContain("roofTooSmall");
  });

  it("follows editable thresholds", () => {
    const settings = { ...DEFAULT_SETTINGS, score: { ...DEFAULT_SETTINGS.score, smallBillBelow: 700 } };
    expect(assessLead(facts({ monthlyBill: 800, monthlyUnits: 100 }), settings).score).toBe("MEDIUM");
  });

  it("is deterministic", () => {
    expect(assess()).toEqual(assess());
  });
});

describe("isVidarbhaPincode", () => {
  it.each(["440001", "441904", "442401", "443001", "444001", "445001"])("accepts %s", (pin) => {
    expect(isVidarbhaPincode(pin)).toBe(true);
  });

  it.each(["400001", "411001", "446001", "439999", "44001", "abcdef"])("rejects %s", (pin) => {
    expect(isVidarbhaPincode(pin)).toBe(false);
  });
});
