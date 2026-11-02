"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { confirmedBillSchema } from "@/domain/bill";
import { SQM_PER_SQFT } from "@/lib/validation";
import { db } from "@/server/db";
import { requireStaff } from "@/server/guards";
import { confirmBill, latestBill } from "@/server/leads";
import { advanceStage, appUrl, StageError } from "@/server/projects";
import { generateQuote, quoteBuilderSchema } from "@/server/quotes";

const leadId = z.string().min(5).max(40);

const refresh = (id: string) => {
  revalidatePath(`/staff/leads/${id}`);
  revalidatePath("/staff/leads");
};

export async function confirmBillAsStaff(id: string, raw: unknown) {
  const user = await requireStaff();
  const lead = leadId.parse(id);
  const parsed = confirmedBillSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const reading = await latestBill(lead);
  await confirmBill(lead, reading?.id ?? null, parsed.data, user.id);
  refresh(lead);
  return { ok: true };
}

const callSchema = z.object({
  notes: z.string().trim().min(2).max(1000),
  outcome: z.enum(["BOOK_SURVEY", "KEEP_OPEN", "CLOSE"]),
});

export async function logCall(id: string, raw: unknown) {
  await requireStaff();
  const lead = leadId.parse(id);
  const parsed = callSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { notes, outcome } = parsed.data;
  await db.lead.update({
    where: { id: lead },
    data: {
      callLoggedAt: new Date(),
      callNotes: notes,
      // The call is what a Low score buys. Only a person closes a lead, and only after talking to them.
      ...(outcome === "BOOK_SURVEY" ? { nextAction: "SURVEY_VISIT" as const } : {}),
      ...(outcome === "CLOSE" ? { stage: "CLOSED" as const, closedReason: notes } : {}),
    },
  });
  refresh(lead);
  return { ok: true };
}

export async function bookSurvey(id: string, date: unknown) {
  await requireStaff();
  const lead = leadId.parse(id);
  const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(date);
  if (!parsed.success) return { ok: false };
  await db.lead.update({ where: { id: lead }, data: { stage: "SURVEY_BOOKED", surveyBookedFor: new Date(parsed.data) } });
  refresh(lead);
  return { ok: true };
}

const surveySchema = z.object({
  roofAreaSqFt: z.number().int().min(50).max(100000),
  shading: z.enum(["NONE", "PARTIAL", "HEAVY"]),
  qualified: z.boolean(),
  notes: z.string().trim().max(1000),
});

export async function recordSurvey(id: string, raw: unknown) {
  await requireStaff();
  const lead = leadId.parse(id);
  const parsed = surveySchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { roofAreaSqFt, shading, qualified, notes } = parsed.data;
  await db.lead.update({
    where: { id: lead },
    data: {
      stage: "SURVEYED",
      surveyedAt: new Date(),
      surveyQualified: qualified,
      surveyRoofSqm: Number((roofAreaSqFt * SQM_PER_SQFT).toFixed(1)),
      surveyShading: shading,
      surveyNotes: notes || null,
    },
  });
  refresh(lead);
  return { ok: true };
}

export async function generateQuoteAction(id: string, raw: unknown) {
  const user = await requireStaff();
  const lead = leadId.parse(id);
  const parsed = quoteBuilderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const };
  const quote = await generateQuote(lead, parsed.data, user.id, appUrl());
  refresh(lead);
  return { ok: true as const, token: quote.token };
}

export async function advanceProjectStage(id: string) {
  const user = await requireStaff();
  const projectId = z.string().min(5).max(40).parse(id);
  try {
    await advanceStage(projectId, user.id);
  } catch (error) {
    if (error instanceof StageError) return { ok: false as const, missing: error.missing };
    throw error;
  }
  revalidatePath(`/staff/projects/${projectId}`);
  revalidatePath("/staff/projects");
  return { ok: true as const };
}
