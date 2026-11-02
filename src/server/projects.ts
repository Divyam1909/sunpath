import { createTranslator } from "next-intl";
import { nextStage, missingDocs, type Stage } from "@/domain/project";
import { db } from "@/server/db";
import { queueMessage } from "@/server/outbox";

/** The public base URL for links in messages. */
export function appUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : process.env.APP_URL || "http://localhost:3000";
}

/** Writes the customer's WhatsApp update for the project's current stage, in their language. */
export async function sendStageMessage(projectId: string, client: Parameters<typeof queueMessage>[1] = db) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { lead: true } });
  const { lead } = project;
  const messages = (await import(`../../messages/${lead.locale}.json`)).default;
  const t = createTranslator({ locale: lead.locale, messages }) as unknown as (key: string) => string;
  return queueMessage(
    {
      lead,
      projectId,
      template: "stage",
      values: {
        stage: t(`stages.${project.stage}`),
        next: t(`stageNext.${project.stage}`),
        link: `${appUrl()}/${lead.locale}/s/${project.token}`,
      },
    },
    client,
  );
}

export class StageError extends Error {
  constructor(public missing: string[]) {
    super(`Missing documents: ${missing.join(", ")}`);
  }
}

/** Moves a project on one stage. Refuses while required documents are missing. */
export async function advanceStage(projectId: string, actorId: string, note?: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { documents: true } });
  const current = project.stage as Stage;
  const target = nextStage(current);
  if (!target) throw new StageError([]);
  const missing = missingDocs(current, project.documents.map((d) => d.docType));
  if (missing.length > 0) throw new StageError(missing.map((d) => d.type));

  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { stage: target, stageEnteredAt: new Date() } });
    await tx.projectEvent.create({ data: { projectId, fromStage: current, toStage: target, actorId, note } });
  });
  await sendStageMessage(projectId);
  return target;
}
