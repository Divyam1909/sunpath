import { createHash } from "node:crypto";
import { averageUnits, type ConfirmedBill, BILL_FIELDS, type BillExtraction } from "@/domain/bill";
import { assessLead, type LeadAssessment, type LeadFacts } from "@/domain/score";
import type { Settings } from "@/domain/settings";
import { Prisma } from "@/generated/prisma/client";
import { CONSENT_PURPOSE, CONSENT_VERSION, SQM_PER_SQFT, type LeadInput } from "@/lib/validation";
import { readBill } from "@/server/bill-reader";
import { db } from "@/server/db";
import { queueMessage } from "@/server/outbox";
import { getSettings } from "@/server/settings";
import { fileStore } from "@/server/storage";
import { newLeadCode, newToken } from "@/server/tokens";

const json = (value: unknown) => value as Prisma.InputJsonValue;

function assessmentFields(assessment: LeadAssessment) {
  return {
    score: assessment.score,
    scorePoints: assessment.points,
    scoreReasons: json(assessment.reasons),
    nextAction: assessment.nextAction,
    recommendedKw: assessment.recommendedKw,
    sizingReasons: json(assessment.sizing.reasons),
    scoredAt: new Date(),
  };
}

/** A25: before a bill is read, units are estimated from the amount the homeowner typed. */
export const estimateUnits = (monthlyBill: number, settings: Settings) =>
  Math.round(monthlyBill / settings.netMetering.fallbackTariffPerUnit);

export async function createLead(input: LeadInput) {
  const settings = await getSettings();
  const roofAreaSqm = Number((input.roofAreaSqFt * SQM_PER_SQFT).toFixed(1));
  // Scored straight away, so a lead who stops at the bill step still reaches sales.
  const assessment = assessLead(
    {
      ownership: input.ownership,
      monthlyBill: input.monthlyBill,
      monthlyUnits: estimateUnits(input.monthlyBill, settings),
      roofAreaSqm,
      pincode: input.pincode,
      sanctionedLoadKw: null,
      billConfidence: null,
    },
    settings,
  );

  const data = {
    accessToken: newToken(),
    name: input.name,
    phone: input.phone,
    ownership: input.ownership,
    roofType: input.roofType,
    roofAreaSqm,
    monthlyBill: input.monthlyBill,
    pincode: input.pincode,
    locale: input.locale,
    consentAt: new Date(),
    consentPurpose: CONSENT_PURPOSE,
    consentVersion: CONSENT_VERSION,
    ...assessmentFields(assessment),
  };

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.lead.create({ data: { ...data, code: newLeadCode() } });
    } catch (error) {
      const isCodeClash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isCodeClash || attempt === 2) throw error;
    }
  }
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Trusts the file's bytes, not the name or the browser's claimed type. */
export function sniffMimeType(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

/** Stores the bill, then reads it. Whatever the reader does, the lead and the file are kept. */
export async function uploadBill(leadId: string, bytes: Buffer, mimeType: string) {
  const settings = await getSettings();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = `bills/${leadId}/${newToken()}.${EXTENSIONS[mimeType]}`;
  await fileStore.put(storageKey, bytes, mimeType);

  const outcome = await readBill({ bytes, mimeType, sha256 }, settings.score.lowConfidenceBelow);
  const base = { leadId, storageKey, mimeType, sizeBytes: bytes.length, sha256 };

  if (outcome.status === "read") {
    const { extraction, confidence, lowConfidence } = outcome.result;
    return db.billReading.create({
      data: {
        ...base,
        status: "READ",
        reader: outcome.reader,
        model: outcome.model,
        ai: json({ extraction, confidence, lowConfidence }),
      },
    });
  }
  if (outcome.status === "poor") {
    return db.billReading.create({
      data: { ...base, status: "POOR_PHOTO", reader: outcome.reader, model: outcome.model, poorReason: outcome.reason },
    });
  }
  console.error(`Bill read unavailable for lead ${leadId}: ${outcome.detail}`);
  return db.billReading.create({ data: { ...base, status: "UNAVAILABLE" } });
}

export interface StoredAiRead {
  extraction: BillExtraction;
  confidence: number;
  lowConfidence: string[];
}

export function factsFromConfirmed(
  lead: { ownership: LeadFacts["ownership"]; roofAreaSqm: number; pincode: string },
  bill: ConfirmedBill,
  billConfidence: number | null,
): LeadFacts {
  return {
    ownership: lead.ownership,
    monthlyBill: bill.billAmount,
    monthlyUnits: bill.averageMonthlyUnits,
    roofAreaSqm: lead.roofAreaSqm,
    pincode: lead.pincode,
    sanctionedLoadKw: bill.sanctionedLoadKw,
    billConfidence,
  };
}

/** Compares what a person agreed to against what the AI read. This is the accuracy audit trail. */
export function editedFields(ai: StoredAiRead | null, confirmed: ConfirmedBill) {
  if (!ai) return [];
  return BILL_FIELDS.filter((field) => (ai.extraction[field].value ?? null) !== (confirmed[field] ?? null));
}

/** Records the confirmed values and scores the lead on them. `actor` is "HOMEOWNER" or a staff user id. */
export async function confirmBill(leadId: string, readingId: string | null, bill: ConfirmedBill, actor: string) {
  const settings = await getSettings();
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const reading = readingId ? await db.billReading.findFirst({ where: { id: readingId, leadId } }) : null;
  const ai = (reading?.ai ?? null) as StoredAiRead | null;

  const assessment = assessLead(factsFromConfirmed(lead, bill, ai?.confidence ?? null), settings);
  const data = {
    status: "CONFIRMED" as const,
    confirmed: json(bill),
    editedFields: editedFields(ai, bill),
    confirmedBy: actor,
    confirmedAt: new Date(),
  };

  return db.$transaction(async (tx) => {
    if (reading) await tx.billReading.update({ where: { id: reading.id }, data });
    else {
      // Manual entry with no photo at all: still one row, so the lead has one source of bill data.
      await tx.billReading.create({
        data: { ...data, leadId, storageKey: "", mimeType: "", sizeBytes: 0, sha256: "", reader: "manual" },
      });
    }
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        ...assessmentFields(assessment),
        monthlyBill: bill.billAmount,
        stage: lead.stage === "NEW" ? "SCORED" : lead.stage,
      },
    });
    if (lead.stage === "NEW") {
      await queueMessage({ lead: updated, template: "leadReceived" }, tx);
    }
    return updated;
  });
}

export const latestBill = (leadId: string) =>
  db.billReading.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" } });

export function prefillBill(ai: StoredAiRead | null, lead: { monthlyBill: number }, settings: Settings): ConfirmedBill {
  const units = ai?.extraction.unitsLatestMonth.value ?? estimateUnits(lead.monthlyBill, settings);
  return {
    consumerNumber: ai?.extraction.consumerNumber.value ?? null,
    tariffCategory: ai?.extraction.tariffCategory.value ?? null,
    ratePerUnit: ai?.extraction.ratePerUnit.value ?? null,
    sanctionedLoadKw: ai?.extraction.sanctionedLoadKw.value ?? null,
    unitsLatestMonth: units,
    billAmount: Math.round(ai?.extraction.billAmount.value ?? lead.monthlyBill),
    billingMonth: ai?.extraction.billingMonth.value ?? null,
    averageMonthlyUnits: averageUnits(units, ai?.extraction.monthlyUnitsHistory ?? []),
  };
}

/** DPDP erasure on request: removes the lead, its files and everything hanging off it. */
export async function eraseLead(leadId: string) {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { bills: true, project: { include: { documents: true } } },
  });
  const keys = [...lead.bills.map((b) => b.storageKey), ...(lead.project?.documents.map((d) => d.storageKey) ?? [])].filter(Boolean);
  await Promise.all(keys.map((key) => fileStore.remove(key)));
  await db.$transaction(async (tx) => {
    if (lead.project) await tx.project.delete({ where: { id: lead.project.id } });
    await tx.lead.delete({ where: { id: leadId } });
    if (lead.userId) {
      const otherLeads = await tx.lead.count({ where: { userId: lead.userId } });
      if (otherLeads === 0) await tx.user.deleteMany({ where: { id: lead.userId, role: "HOMEOWNER" } });
    }
  });
}
