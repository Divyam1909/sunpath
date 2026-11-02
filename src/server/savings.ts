import { z } from "zod";
import { checkPromise, sumPromises, type PromiseCheck } from "@/domain/promise";
import type { Settings } from "@/domain/settings";
import { STAGES, type Stage } from "@/domain/project";
import { parseBillMonth } from "@/domain/usage";
import { db } from "@/server/db";
import { queueMessage } from "@/server/outbox";
import { readQuote } from "@/server/quotes";
import { getSettings } from "@/server/settings";

/** A bill after solar can only be read against the promise once the net meter is in. */
export const canCheckSavings = (stage: string) => STAGES.indexOf(stage as Stage) >= STAGES.indexOf("NET_METER_INSTALLED");

export const savingsBillSchema = z.object({
  month: z.string().trim().min(3).max(20),
  billAmount: z.number().min(0).max(10000000),
  importUnits: z.number().min(0).max(1000000).nullable(),
  exportUnits: z.number().min(0).max(1000000).nullable(),
  bankedUnits: z.number().min(0).max(1000000).nullable(),
  billedUnits: z.number().min(0).max(1000000).nullable(),
});

export type SavingsBill = z.infer<typeof savingsBillSchema>;

type QuoteLike = { inputs: unknown; options: unknown; snapshot: unknown };

/** The promise for this system: the frozen projection, or for older quotes a flat share of the yearly saving. */
export function promiseFor(quote: QuoteLike, systemKw: number, month: string, billAmount: number, settings: Settings): PromiseCheck | null {
  const stored = readQuote(quote);
  const projection = stored.snapshot.billView?.byKw[String(systemKw)];
  if (projection) return checkPromise({ month, currentBillAmount: billAmount, projection }, settings);
  const option = stored.options.find((o) => o.systemKw === systemKw);
  if (!option) return null;
  const index = Number(month.slice(5, 7)) - 1;
  const saving = option.yearlySavings * settings.generationShare[index];
  const before = stored.inputs.monthlyUnits * stored.inputs.tariffPerUnit;
  const months = [{ index, use: 0, generation: 0, billedUnits: 0, bankedUnits: 0, before, after: before - saving }];
  return checkPromise({ month, currentBillAmount: billAmount, projection: { months } }, settings);
}

export class SavingsError extends Error {}

/** Records a confirmed bill against the promise. If it is far behind, the customer hears from us first. */
export async function recordSavingsCheck(projectId: string, bill: SavingsBill) {
  const settings = await getSettings();
  const month = parseBillMonth(bill.month);
  if (!month) throw new SavingsError("badMonth");
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { quote: true, lead: true } });
  const check = promiseFor(project.quote, project.systemKw, month, bill.billAmount, settings);
  if (!check) throw new SavingsError("noPromise");

  const data = {
    billAmount: Math.round(bill.billAmount),
    importUnits: bill.importUnits,
    exportUnits: bill.exportUnits,
    bankedUnits: bill.bankedUnits,
    billedUnits: bill.billedUnits,
    ...check,
  };
  const saved = await db.savingsCheck.upsert({
    where: { projectId_month: { projectId, month } },
    update: data,
    create: { projectId, month, ...data },
  });
  if (check.verdict === "BEHIND") {
    await queueMessage({ lead: project.lead, projectId, template: "savingsBehind", values: { month: bill.month } });
  }
  return saved;
}

/** Across every bill so far. Feeds the staff impact panel. */
export async function savingsTotals() {
  const rows = await db.savingsCheck.findMany({ select: { promisedSaving: true, actualSaving: true } });
  return sumPromises(rows);
}

export const savingsChecksBehind = () =>
  db.savingsCheck.findMany({
    where: { verdict: "BEHIND" },
    orderBy: { ratio: "asc" },
    include: { project: { select: { id: true, code: true, lead: { select: { name: true } } } } },
  });

