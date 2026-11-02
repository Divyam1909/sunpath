import { describe, expect, it } from "vitest";
import { checkStuck, missingDocs, nextStage, STAGES } from "./project";
import { DEFAULT_SETTINGS } from "./settings";

const now = new Date("2026-11-02T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const sla = DEFAULT_SETTINGS.stageSlaDays;

describe("checkStuck", () => {
  it("is not stuck on the SLA day itself", () => {
    expect(checkStuck("DOCUMENTS", daysAgo(7), sla, now)).toMatchObject({ stuck: false, days: 7, overdueBy: 0 });
  });

  it("is stuck the day after the SLA", () => {
    expect(checkStuck("DOCUMENTS", daysAgo(8), sla, now)).toMatchObject({ stuck: true, overdueBy: 1 });
  });

  it("uses the SLA of the current stage", () => {
    expect(checkStuck("SUBSIDY_APPLIED", daysAgo(8), sla, now).stuck).toBe(false);
  });

  it("never marks a finished project stuck", () => {
    expect(checkStuck("SUBSIDY_CREDITED", daysAgo(400), sla, now)).toMatchObject({ stuck: false, slaDays: null });
  });

  it("does not mark a stage stuck when it has no SLA set", () => {
    expect(checkStuck("DOCUMENTS", daysAgo(400), {}, now).stuck).toBe(false);
  });

  it("follows edited SLAs", () => {
    expect(checkStuck("DOCUMENTS", daysAgo(3), { DOCUMENTS: 2 }, now).stuck).toBe(true);
  });
});

describe("stage rules", () => {
  it("has the eight stages from the brief, in order", () => {
    expect(STAGES).toHaveLength(8);
    expect(STAGES[0]).toBe("ADVANCE_RECEIVED");
    expect(STAGES[7]).toBe("SUBSIDY_CREDITED");
  });

  it("moves one stage at a time and stops at the end", () => {
    expect(nextStage("ADVANCE_RECEIVED")).toBe("DOCUMENTS");
    expect(nextStage("SUBSIDY_CREDITED")).toBeNull();
  });

  it("lists documents still needed to leave a stage", () => {
    expect(missingDocs("DOCUMENTS", ["ID_PROOF"]).map((d) => d.type)).toEqual(["PROPERTY_PROOF", "BANK_DETAILS"]);
    expect(missingDocs("DOCUMENTS", ["ID_PROOF", "PROPERTY_PROOF", "BANK_DETAILS"])).toEqual([]);
    expect(missingDocs("ADVANCE_RECEIVED", [])).toEqual([]);
  });
});
