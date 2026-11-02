"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { allowRequest, clientIp } from "@/server/rate-limit";
import { canCheckSavings, recordSavingsCheck, savingsBillSchema, SavingsError } from "@/server/savings";

/** The customer's link is their permission, as on the status page. The bill must belong to this project. */
export async function confirmSavingsBill(token: string, readingId: string, raw: unknown) {
  if (!(await allowRequest(`savings:${await clientIp()}`, 20, 600))) return { ok: false as const };
  const project = await db.project.findUnique({ where: { token }, select: { id: true, stage: true, leadId: true } });
  if (!project || !canCheckSavings(project.stage)) return { ok: false as const };
  const parsed = savingsBillSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const };
  const reading = await db.billReading.findFirst({ where: { id: readingId, leadId: project.leadId, purpose: "AFTER_SOLAR" } });
  if (!reading) return { ok: false as const };
  try {
    await recordSavingsCheck(project.id, parsed.data);
  } catch (error) {
    if (error instanceof SavingsError) return { ok: false as const };
    throw error;
  }
  await db.billReading.update({
    where: { id: reading.id },
    data: { status: "CONFIRMED", confirmed: parsed.data, confirmedBy: "HOMEOWNER", confirmedAt: new Date() },
  });
  revalidatePath("/[locale]/s/[token]", "page");
  return { ok: true as const };
}
