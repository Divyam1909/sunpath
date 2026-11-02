import { createHash } from "node:crypto";
import { findBlockers } from "@/domain/blockers";
import { BILL_FIELDS, billForThisMonth, EXTRA_BILL_FIELDS, segmentFromTariff, type BillExtraction, type ConfirmedBill } from "@/domain/bill";
import { polygonAreaSqm } from "@/domain/geo";
import { assessLead, type LeadAssessment, type LeadFacts } from "@/domain/score";
import type { Settings } from "@/domain/settings";
import { averageFromUsage, usageFromBill } from "@/domain/usage";
import { Prisma } from "@/generated/prisma/client";
import { CONSENT_PURPOSE, CONSENT_VERSION, SQM_PER_SQFT, type LeadInput } from "@/lib/validation";
import { readBill } from "@/server/bill-reader";
import { isSampleBill } from "@/server/bill-reader/mock";
import { db } from "@/server/db";
import { queueMessage } from "@/server/outbox";
import { allowRequest, clientIp } from "@/server/rate-limit";
import { getSettings } from "@/server/settings";
import { fileStore } from "@/server/storage";
import { FILE_EXTENSIONS } from "@/server/uploads";
import { newLeadCode, newToken } from "@/server/tokens";

const json = (value: unknown) => value as Prisma.InputJsonValue;

// The free tier allows few reads a day, so one address cannot use them all up.
const REAL_READS_PER_DAY = 5;

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
  // A map outline is measured here again: the area the browser sent is not trusted.
  const outline = input.roofOutline ?? null;
  const roofAreaSqm = Number((outline ? polygonAreaSqm(outline) : input.roofAreaSqFt * SQM_PER_SQFT).toFixed(1));
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
    roofOutline: outline ? json(outline) : Prisma.JsonNull,
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

/** Stores the bill, then reads it. Whatever the reader does, the lead and the file are kept. */
export async function uploadBill(leadId: string, bytes: Buffer, mimeType: string, purpose: "INTAKE" | "AFTER_SOLAR" = "INTAKE") {
  const settings = await getSettings();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = `bills/${leadId}/${newToken()}.${FILE_EXTENSIONS[mimeType]}`;
  await fileStore.put(storageKey, bytes, mimeType);

  const withinLimit = isSampleBill(sha256) || (await allowRequest(`read:ip:${await clientIp()}`, REAL_READS_PER_DAY, 86_400));
  const outcome = withinLimit
    ? await readBill({ bytes, mimeType, sha256 }, settings.score.lowConfidenceBelow)
    : ({ status: "unavailable", detail: "Daily read limit reached" } as const);
  const base = { leadId, purpose, storageKey, mimeType, sizeBytes: bytes.length, sha256 };

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
    monthlyBill: billForThisMonth(bill),
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
  return [...BILL_FIELDS, ...EXTRA_BILL_FIELDS].filter((field) => (ai.extraction[field]?.value ?? null) !== (confirmed[field] ?? null));
}

/** A41: everything that would stop this lead later, worked out from the confirmed bill. */
function blockersFor(lead: { name: string; ownership: "OWNER" | "TENANT" }, bill: ConfirmedBill, assessment: LeadAssessment, settings: Settings) {
  return findBlockers(
    {
      leadName: lead.name,
      ownership: lead.ownership,
      segment: segmentFromTariff(bill.tariffCategory),
      consumerName: bill.consumerName ?? null,
      arrearsAmount: bill.arrearsAmount ?? null,
      solarExportUnits: bill.solarExportUnits ?? null,
      meterStatus: bill.meterStatus ?? null,
      sizing: { demandKw: assessment.sizing.demandKw, recommendedKw: assessment.recommendedKw, reasons: assessment.sizing.reasons },
    },
    settings,
  );
}

/** Records the confirmed values and scores the lead on them. `actor` is "HOMEOWNER" or a staff user id. */
export async function confirmBill(leadId: string, readingId: string | null, bill: ConfirmedBill, actor: string) {
  const settings = await getSettings();
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const reading = readingId ? await db.billReading.findFirst({ where: { id: readingId, leadId } }) : null;
  const ai = (reading?.ai ?? null) as StoredAiRead | null;

  const assessment = assessLead(factsFromConfirmed(lead, bill, ai?.confidence ?? null), settings);
  const blockers = blockersFor(lead, bill, assessment, settings);
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
        blockers: json(blockers),
        monthlyBill: billForThisMonth(bill),
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
  db.billReading.findFirst({ where: { leadId, purpose: "INTAKE" }, orderBy: { createdAt: "desc" } });

export function prefillBill(ai: StoredAiRead | null, lead: { monthlyBill: number }, settings: Settings): ConfirmedBill {
  const extraction = ai?.extraction;
  const units = extraction?.unitsLatestMonth.value ?? estimateUnits(lead.monthlyBill, settings);
  const billingMonth = extraction?.billingMonth.value ?? null;
  const usage = extraction
    ? usageFromBill({
        billingMonth,
        unitsLatestMonth: units,
        monthlyUsage: extraction.monthlyUsage,
        monthlyUnitsHistory: extraction.monthlyUnitsHistory,
      })
    : [];
  return {
    consumerNumber: extraction?.consumerNumber.value ?? null,
    consumerName: extraction?.consumerName?.value ?? null,
    tariffCategory: extraction?.tariffCategory.value ?? null,
    ratePerUnit: extraction?.ratePerUnit.value ?? null,
    sanctionedLoadKw: extraction?.sanctionedLoadKw.value ?? null,
    unitsLatestMonth: units,
    billAmount: Math.round(extraction?.billAmount.value ?? lead.monthlyBill),
    arrearsAmount: extraction?.arrearsAmount?.value ?? null,
    billingMonth,
    averageMonthlyUnits: extraction ? averageFromUsage(usage, units, settings) : units,
    connectionPhase: extraction?.connectionPhase?.value ?? null,
    meterStatus: extraction?.meterStatus?.value ?? null,
    solarExportUnits: extraction?.solarExportUnits?.value ?? null,
    monthlyUsage: usage,
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
