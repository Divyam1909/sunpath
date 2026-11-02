import { describe, expect, it } from "vitest";
import { compareField, compareHistory, percentOf, scoreFields } from "./accuracy";

describe("compareField", () => {
  it("matches numbers exactly", () => {
    expect(compareField("unitsLatestMonth", 146, 146)).toBe("CORRECT");
    expect(compareField("unitsLatestMonth", 164, 146)).toBe("WRONG");
  });

  it("calls a blank a miss", () => {
    expect(compareField("billAmount", null, 1470)).toBe("MISSED");
  });

  it("calls a value read from behind a mask invented", () => {
    expect(compareField("consumerNumber", "999900012345", null)).toBe("INVENTED");
    expect(compareField("consumerNumber", null, null)).toBe("CORRECT");
  });

  it("reads a month whichever way it is written", () => {
    expect(compareField("billingMonth", "SEP-2022", "Sep 2022")).toBe("CORRECT");
  });

  it("looks for the tariff code in the wording", () => {
    expect(compareField("tariffCategory", "90/LT I Res 1-Phase", "LT I")).toBe("CORRECT");
    expect(compareField("tariffCategory", "35 LT-III A", "LT I")).toBe("CORRECT");
    expect(compareField("tariffCategory", "35 LT-III A", "LT III A")).toBe("CORRECT");
    expect(compareField("tariffCategory", "LT II", "LT III")).toBe("WRONG");
  });

  it("ignores spaces in a consumer number", () => {
    expect(compareField("consumerNumber", "4100 1990 0881", "410019900881")).toBe("CORRECT");
  });
});

describe("compareHistory", () => {
  it("counts each month read right", () => {
    const truth = [{ month: "Sep 2026", units: 89 }, { month: "Aug 2026", units: 80 }];
    expect(compareHistory([{ month: "2026-09", units: 89 }, { month: "2026-08", units: 88 }], truth)).toEqual({ correct: 1, total: 2 });
  });
});

describe("scoreFields", () => {
  it("groups outcomes by field", () => {
    const rows = [
      { field: "billAmount", outcome: "CORRECT" as const },
      { field: "billAmount", outcome: "WRONG" as const },
      { field: "consumerNumber", outcome: "INVENTED" as const },
    ];
    expect(scoreFields(rows)).toEqual([
      { field: "billAmount", correct: 1, total: 2, invented: 0 },
      { field: "consumerNumber", correct: 0, total: 1, invented: 1 },
    ]);
    expect(percentOf(1, 2)).toBe(50);
  });
});
