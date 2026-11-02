import { describe, expect, it } from "vitest";
import { forecastProject, quantile, stageDurations } from "./forecast";
import { STAGES } from "./project";
import { DEFAULT_SETTINGS as settings } from "./settings";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

/** A finished project that took the given days in each of the seven working stages. */
function finished(days: number[]) {
  let at = 0;
  return {
    events: STAGES.map((toStage, i) => {
      const event = { toStage, createdAt: day(at) };
      at += days[i] ?? 0;
      return event;
    }),
  };
}

const slaDays = settings.stageSlaDays;
const config = { slaDays, minSamples: 3, now: day(100) };

describe("stageDurations", () => {
  it("reads days per stage from the history", () => {
    const durations = stageDurations([finished([2, 5, 10, 3, 40, 6, 25])]);
    expect(durations.ADVANCE_RECEIVED).toEqual([2]);
    expect(durations.NET_METERING_APPLIED).toEqual([40]);
    expect(durations.SUBSIDY_CREDITED).toBeUndefined();
  });

  it("leaves out a stage a project has not finished", () => {
    const partial = { events: [{ toStage: "ADVANCE_RECEIVED", createdAt: day(0) }] };
    expect(stageDurations([partial])).toEqual({});
  });
});

describe("quantile", () => {
  it("reads the middle and the high end", () => {
    expect(quantile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(quantile([10, 20, 30, 40, 50], 0.8)).toBe(42);
  });
});

describe("forecastProject", () => {
  const project = { stage: "NET_METERING_APPLIED" as const, enteredAt: day(100), startedAt: day(60) };

  it("is empty for a finished project", () => {
    expect(forecastProject({ ...project, stage: "SUBSIDY_CREDITED" }, { ...config, durations: {} })).toBeNull();
  });

  it("uses the limits while there is too little history", () => {
    const forecast = forecastProject(project, { ...config, durations: stageDurations([finished([2, 5, 10, 3, 60, 6, 25])]) })!;
    expect(forecast.samples).toBe(0);
    expect(forecast.likely).toBe(day(100 + 21 + 7 + 30).toISOString().slice(0, 10));
  });

  it("shows a slip when net metering really takes longer than its limit", () => {
    const history = [[3, 7, 12, 4, 44, 6, 25], [2, 6, 11, 5, 40, 7, 28], [3, 7, 13, 4, 52, 5, 26]];
    const forecast = forecastProject(project, { ...config, durations: stageDurations(history.map(finished)) })!;
    expect(forecast.samples).toBe(3);
    expect(forecast.likely).toBe(day(100 + 44 + 6 + 26).toISOString().slice(0, 10));
    expect(forecast.promised).toBe(day(60 + 87).toISOString().slice(0, 10));
    expect(forecast.slips).toBe(true);
    expect(forecast.slipDays).toBe(29);
    expect(forecast.slowest).toEqual({ stage: "NET_METERING_APPLIED", typicalDays: 44, slaDays: 21 });
  });

  it("counts days already spent in the stage, and never predicts today", () => {
    const history = [[3, 7, 12, 4, 44, 6, 25], [2, 6, 11, 5, 40, 7, 28], [3, 7, 13, 4, 52, 5, 26]];
    const durations = stageDurations(history.map(finished));
    const waited = forecastProject({ ...project, enteredAt: day(70) }, { ...config, durations })!;
    expect(waited.likely).toBe(day(100 + 14 + 6 + 26).toISOString().slice(0, 10));
    const overdue = forecastProject({ ...project, enteredAt: day(10) }, { ...config, durations })!;
    expect(overdue.likely).toBe(day(100 + 1 + 6 + 26).toISOString().slice(0, 10));
  });

  it("gives a later date for the slower one in five", () => {
    const history = [[3, 7, 12, 4, 30, 6, 25], [2, 6, 11, 5, 40, 7, 28], [3, 7, 13, 4, 80, 5, 26]];
    const forecast = forecastProject(project, { ...config, durations: stageDurations(history.map(finished)) })!;
    expect(forecast.late > forecast.likely).toBe(true);
  });
});
