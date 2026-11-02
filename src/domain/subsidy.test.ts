import { describe, expect, it } from "vitest";
import { findOverlap, pickActiveRule, subsidyRuleSchema, type Dated } from "./rules";
import { calculateSubsidy } from "./subsidy";

const central = {
  slabs: [
    { fromKw: 0, toKw: 2, ratePerKw: 30000 },
    { fromKw: 2, toKw: 3, ratePerKw: 18000 },
  ],
  capAmount: 78000,
};

describe("calculateSubsidy with the central residential slabs", () => {
  it.each([
    [1, 30000],
    [1.5, 45000],
    [2, 60000],
    [2.5, 69000],
    [3, 78000],
    [3.5, 78000],
    [5, 78000],
    [10, 78000],
  ])("%s kW pays ₹%s", (kw, amount) => {
    expect(calculateSubsidy(kw, central).amount).toBe(amount);
  });

  it("itemises each slab for the 'how we calculated this' disclosure", () => {
    expect(calculateSubsidy(2.5, central).lines).toEqual([
      { kw: 2, ratePerKw: 30000, amount: 60000 },
      { kw: 0.5, ratePerKw: 18000, amount: 9000 },
    ]);
  });

  it("applies the cap when slabs would pay more", () => {
    const result = calculateSubsidy(3, { ...central, capAmount: 70000 });
    expect(result).toMatchObject({ amount: 70000, uncapped: 78000, capped: true });
  });

  it("does not report a cap for a system past the last slab, because the slabs stop paying", () => {
    expect(calculateSubsidy(10, central).capped).toBe(false);
  });

  it("pays nothing when no rule is active", () => {
    expect(calculateSubsidy(3, null)).toEqual({ amount: 0, lines: [], uncapped: 0, capped: false });
  });
});

describe("effective dates", () => {
  const rule = (id: string, effectiveFrom: string, effectiveTo: string | null, segment = "RESIDENTIAL"): Dated => ({
    id,
    segment,
    effectiveFrom,
    effectiveTo,
  });
  const rules = [rule("old", "2024-02-15", "2026-03-31"), rule("new", "2026-04-01", null)];

  it("picks the rule active on the quote date", () => {
    expect(pickActiveRule(rules, "2025-06-01", "RESIDENTIAL")?.id).toBe("old");
    expect(pickActiveRule(rules, "2026-11-02", "RESIDENTIAL")?.id).toBe("new");
  });

  it("treats both ends of a rule as inclusive", () => {
    expect(pickActiveRule(rules, "2026-03-31", "RESIDENTIAL")?.id).toBe("old");
    expect(pickActiveRule(rules, "2026-04-01", "RESIDENTIAL")?.id).toBe("new");
  });

  it("returns nothing before the first rule or for another segment", () => {
    expect(pickActiveRule(rules, "2023-01-01", "RESIDENTIAL")).toBeNull();
    expect(pickActiveRule(rules, "2025-06-01", "COMMERCIAL")).toBeNull();
  });

  it("changes the subsidy across a dated rule change", () => {
    const halved = { ...central, slabs: central.slabs.map((s) => ({ ...s, ratePerKw: s.ratePerKw / 2 })), capAmount: 39000 };
    const table = [
      { ...rule("a", "2024-02-15", "2026-03-31"), ...central },
      { ...rule("b", "2026-04-01", null), ...halved },
    ];
    const on = (date: string) => calculateSubsidy(3, pickActiveRule(table, date, "RESIDENTIAL")).amount;
    expect(on("2026-03-31")).toBe(78000);
    expect(on("2026-04-01")).toBe(39000);
  });

  it("rejects overlapping rules in the same segment", () => {
    expect(findOverlap(rule("x", "2026-03-31", null), rules)?.id).toBe("old");
    expect(findOverlap(rule("x", "2025-01-01", "2025-02-01"), rules)?.id).toBe("old");
    expect(findOverlap(rule("x", "2023-01-01", null), rules)?.id).toBe("old");
    expect(findOverlap(rule("x", "2027-01-01", "2027-12-31"), rules)?.id).toBe("new");
  });

  it("allows touching-free neighbours, other segments, and re-saving a rule", () => {
    expect(findOverlap(rule("x", "2020-01-01", "2024-02-14"), rules)).toBeNull();
    expect(findOverlap(rule("x", "2024-02-15", null, "COMMERCIAL"), rules)).toBeNull();
    expect(findOverlap(rule("new", "2026-05-01", null), rules)).toBeNull();
  });
});

describe("subsidyRuleSchema", () => {
  const valid = {
    id: "",
    schemeName: "Central residential",
    segment: "RESIDENTIAL",
    ...central,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    sourceNote: "",
    verifyBeforeLaunch: true,
  };

  it("accepts the brief's rule", () => {
    expect(subsidyRuleSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects gaps in slabs and reversed dates", () => {
    const gap = { ...valid, slabs: [{ fromKw: 0, toKw: 2, ratePerKw: 1 }, { fromKw: 3, toKw: 4, ratePerKw: 1 }] };
    expect(subsidyRuleSchema.safeParse(gap).success).toBe(false);
    expect(subsidyRuleSchema.safeParse({ ...valid, effectiveTo: "2025-01-01" }).success).toBe(false);
  });
});
