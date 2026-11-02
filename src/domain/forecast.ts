import { FINAL_STAGE, STAGES, daysInStage, type Stage } from "./project";

export type StageDurations = Partial<Record<Stage, number[]>>;

const DAY_MS = 86_400_000;

/** Days each finished project spent in each stage, from its stage history. */
export function stageDurations(projects: { events: { toStage: string; createdAt: Date }[] }[]): StageDurations {
  const durations: StageDurations = {};
  for (const { events } of projects) {
    const reached = new Map(events.map((e) => [e.toStage, e.createdAt.getTime()]));
    STAGES.forEach((stage, i) => {
      const next = STAGES[i + 1];
      const from = reached.get(stage);
      const to = next ? reached.get(next) : undefined;
      if (from === undefined || to === undefined) return;
      (durations[stage] ??= []).push(Math.max(Math.round((to - from) / DAY_MS), 0));
    });
  }
  return durations;
}

/** A value at a share of the way through the sorted samples, read between neighbours. */
export function quantile(values: number[], share: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * share;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (position - low));
}

export interface ProjectForecast {
  /** YYYY-MM-DD. Half of similar projects finish by this date. */
  likely: string;
  /** YYYY-MM-DD. Four in five finish by this date. */
  late: string;
  /** YYYY-MM-DD. What the stage limits add up to from the advance. */
  promised: string;
  slipDays: number;
  slips: boolean;
  /** Finished projects behind the estimate. Zero means stage limits alone. */
  samples: number;
  /** The stage still ahead that runs furthest past its limit. */
  slowest: { stage: Stage; typicalDays: number; slaDays: number } | null;
}

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface ForecastInput {
  stage: Stage;
  enteredAt: Date;
  startedAt: Date;
}

interface ForecastConfig {
  durations: StageDurations;
  slaDays: Record<string, number>;
  minSamples: number;
  now: Date;
}

/**
 * A44: a finish date from how long this company's projects really took, stage by stage. A stage with
 * too little history uses its limit. Null once a project is finished.
 */
export function forecastProject(project: ForecastInput, config: ForecastConfig): ProjectForecast | null {
  if (project.stage === FINAL_STAGE) return null;
  const { durations, slaDays, minSamples, now } = config;
  const ahead = STAGES.slice(STAGES.indexOf(project.stage), -1);
  const days = daysInStage(project.enteredAt, now);

  let likelyDays = 0;
  let lateDays = 0;
  let samples = Infinity;
  let slowest: ProjectForecast["slowest"] = null;

  ahead.forEach((stage, i) => {
    const sla = slaDays[stage] ?? 0;
    const history = durations[stage] ?? [];
    const enough = history.length >= minSamples;
    const typical = enough ? quantile(history, 0.5) : sla;
    const high = enough ? quantile(history, 0.8) : sla;
    samples = Math.min(samples, enough ? history.length : 0);
    likelyDays += i === 0 ? Math.max(typical - days, 1) : typical;
    lateDays += i === 0 ? Math.max(high - days, 2) : high;
    if (typical > sla && (!slowest || typical - sla > slowest.typicalDays - slowest.slaDays)) {
      slowest = { stage, typicalDays: typical, slaDays: sla };
    }
  });

  const totalSla = STAGES.slice(0, -1).reduce((sum, stage) => sum + (slaDays[stage] ?? 0), 0);
  const promisedMs = project.startedAt.getTime() + totalSla * DAY_MS;
  const likelyMs = now.getTime() + likelyDays * DAY_MS;
  const slipDays = Math.max(Math.round((likelyMs - promisedMs) / DAY_MS), 0);
  return {
    likely: toDate(likelyMs),
    late: toDate(now.getTime() + Math.max(lateDays, likelyDays) * DAY_MS),
    promised: toDate(promisedMs),
    slipDays,
    slips: slipDays > 0,
    samples: samples === Infinity ? 0 : samples,
    slowest,
  };
}
