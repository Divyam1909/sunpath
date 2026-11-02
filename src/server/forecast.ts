import { forecastProject, stageDurations } from "@/domain/forecast";
import type { Stage } from "@/domain/project";
import type { Settings } from "@/domain/settings";
import { db } from "@/server/db";

/** How long each stage has really taken here, from finished projects only. */
export async function loadDurations() {
  const finished = await db.project.findMany({
    where: { stage: "SUBSIDY_CREDITED" },
    select: { events: { select: { toStage: true, createdAt: true } } },
  });
  return stageDurations(finished);
}

export type Durations = Awaited<ReturnType<typeof loadDurations>>;

export function forecastFor(
  project: { stage: string; stageEnteredAt: Date; createdAt: Date },
  durations: Durations,
  settings: Settings,
  now: Date,
) {
  return forecastProject(
    { stage: project.stage as Stage, enteredAt: project.stageEnteredAt, startedAt: project.createdAt },
    { durations, slaDays: settings.stageSlaDays, minSamples: settings.forecastMinSamples, now },
  );
}
