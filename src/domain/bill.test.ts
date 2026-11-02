import { describe, expect, it } from "vitest";
import { averageUnits, maskConsumerNumber, parseBillResponse, segmentFromTariff } from "./bill";

const good = {
  isElectricityBill: true,
  imageQuality: "good",
  consumerNumber: { value: "410010012345", confidence: 0.98 },
  tariffCategory: { value: "LT I - Residential", confidence: 0.95 },
  ratePerUnit: { value: null, confidence: 0 },
  sanctionedLoadKw: { value: 5, confidence: 0.9 },
  unitsLatestMonth: { value: 340, confidence: 0.97 },
  billAmount: { value: 3200, confidence: 0.98 },
  billingMonth: { value: "Sep 2026", confidence: 0.9 },
  monthlyUnitsHistory: [320, 340, 360],
};
const parse = (value: unknown) => parseBillResponse(typeof value === "string" ? value : JSON.stringify(value), 0.75);

describe("parseBillResponse", () => {
  it("accepts a clean read", () => {
    const result = parse(good);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.extraction.unitsLatestMonth.value).toBe(340);
  });

  it("flags values it could not find as low confidence instead of guessing", () => {
    const result = parse({ ...good, sanctionedLoadKw: { value: null, confidence: 0 } });
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.lowConfidence).toEqual(["sanctionedLoadKw"]);
    expect(result.extraction.sanctionedLoadKw.value).toBeNull();
  });

  it("does not hold a missing printed rate against the read, because most bills use slabs", () => {
    const result = parse(good);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.lowConfidence).toEqual([]);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("flags fields under the confidence threshold", () => {
    const result = parse({ ...good, sanctionedLoadKw: { value: 3, confidence: 0.4 } });
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.lowConfidence).toContain("sanctionedLoadKw");
  });

  it("treats bad JSON as a failed read", () => {
    expect(parse("```json\n{oops").kind).toBe("invalid");
    expect(parse("").kind).toBe("invalid");
  });

  it("treats missing fields as a failed read", () => {
    const partial = { ...good, unitsLatestMonth: undefined };
    expect(parse(partial).kind).toBe("invalid");
  });

  it("treats out-of-range confidence as a failed read", () => {
    expect(parse({ ...good, billAmount: { value: 1, confidence: 7 } }).kind).toBe("invalid");
  });

  it("asks for a new photo when the image is not a bill", () => {
    expect(parse({ ...good, isElectricityBill: false })).toEqual({ kind: "poor", reason: "notBill" });
  });

  it("asks for a new photo when blur hides the key values", () => {
    const blurry = { ...good, imageQuality: "blurry", unitsLatestMonth: { value: null, confidence: 0 } };
    expect(parse(blurry)).toEqual({ kind: "poor", reason: "blurry" });
  });

  it("asks for a new photo when marked unreadable, whatever the fields say", () => {
    expect(parse({ ...good, imageQuality: "unreadable" })).toEqual({ kind: "poor", reason: "unreadable" });
  });

  it("lets a soft photo through when key values are legible", () => {
    expect(parse({ ...good, imageQuality: "blurry" }).kind).toBe("ok");
  });

  it("asks for a new photo when neither units nor amount were found", () => {
    const empty = {
      ...good,
      unitsLatestMonth: { value: null, confidence: 0 },
      billAmount: { value: null, confidence: 0 },
    };
    expect(parse(empty)).toEqual({ kind: "poor", reason: "unreadable" });
  });
});

describe("bill helpers", () => {
  it("averages the history and ignores empty months", () => {
    expect(averageUnits(340, [300, 0, 340, 380])).toBe(340);
    expect(averageUnits(340, [])).toBe(340);
  });

  it("masks consumer numbers to the last 4 digits", () => {
    expect(maskConsumerNumber("4100 1001 2345")).toBe("•••• 2345");
    expect(maskConsumerNumber(null)).toBe("Not read");
  });

  it("derives the subsidy segment from the tariff", () => {
    expect(segmentFromTariff("LT I - Residential")).toBe("RESIDENTIAL");
    expect(segmentFromTariff("LT-I(B) Res")).toBe("RESIDENTIAL");
    expect(segmentFromTariff("LT II - Commercial")).toBe("COMMERCIAL");
    expect(segmentFromTariff("LT-III Industrial")).toBe("COMMERCIAL");
    expect(segmentFromTariff(null)).toBe("RESIDENTIAL");
  });
});
