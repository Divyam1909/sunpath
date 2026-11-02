import { z } from "zod";
import { istDate } from "@/domain/format";
import { buildQuoteOptions, type QuoteInputs, type QuoteOption } from "@/domain/quote";
import type { PriceRule, SubsidyRule } from "@/domain/rules";
import type { Settings } from "@/domain/settings";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { loadRules, rulesFor } from "@/server/estimate";
import { queueMessage } from "@/server/outbox";
import { getSettings } from "@/server/settings";
import { newProjectCode, newToken } from "@/server/tokens";

export const quoteBuilderSchema = z.object({
  monthlyUnits: z.number().positive().max(100000),
  tariffPerUnit: z.number().positive().max(100),
  segment: z.enum(["RESIDENTIAL", "COMMERCIAL"]),
  maxKw: z.number().min(0).max(1000),
  sizes: z.array(z.number().min(0.5).max(1000)).min(1).max(3),
  selectedKw: z.number().positive(),
});

export type QuoteBuilderInput = z.infer<typeof quoteBuilderSchema>;

/** Frozen copy of everything the numbers came from. Old quotes read this, never the live tables. */
export interface QuoteSnapshot {
  subsidyRule: Pick<SubsidyRule, "id" | "schemeName" | "slabs" | "capAmount" | "effectiveFrom" | "effectiveTo"> | null;
  priceRule: Pick<PriceRule, "id" | "name" | "bands" | "effectiveFrom" | "effectiveTo">;
  generationKwhPerKwYear: number;
  surplusRatePerUnit: number;
  advancePercent: number;
}

export type StoredQuote = {
  inputs: QuoteInputs;
  options: QuoteOption[];
  snapshot: QuoteSnapshot;
};

export const readQuote = (quote: { inputs: unknown; options: unknown; snapshot: unknown }) => quote as StoredQuote;

const json = (value: unknown) => value as Prisma.InputJsonValue;

function buildSnapshot(subsidy: SubsidyRule | null, price: PriceRule, settings: Settings): QuoteSnapshot {
  return {
    subsidyRule: subsidy && {
      id: subsidy.id,
      schemeName: subsidy.schemeName,
      slabs: subsidy.slabs,
      capAmount: subsidy.capAmount,
      effectiveFrom: subsidy.effectiveFrom,
      effectiveTo: subsidy.effectiveTo,
    },
    priceRule: {
      id: price.id,
      name: price.name,
      bands: price.bands,
      effectiveFrom: price.effectiveFrom,
      effectiveTo: price.effectiveTo,
    },
    generationKwhPerKwYear: settings.generationKwhPerKwYear,
    surplusRatePerUnit: settings.netMetering.surplusRatePerUnit,
    advancePercent: settings.advancePercent,
  };
}

/** The server recomputes every number. The builder's live figures are never trusted. */
export async function generateQuote(leadId: string, input: QuoteBuilderInput, actorId: string, appUrl: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { project: true } });
  if (lead.project) throw new Error("This lead already has a project");

  const quoteDate = istDate();
  const [settings, rules] = await Promise.all([getSettings(), loadRules()]);
  const { subsidy, price } = rulesFor(rules, quoteDate, input.segment);
  if (!price) throw new Error("No price rule is active today");

  const sizes = [...new Set(input.sizes)].sort((a, b) => a - b);
  const inputs: QuoteInputs = {
    monthlyUnits: input.monthlyUnits,
    tariffPerUnit: input.tariffPerUnit,
    maxKw: input.maxKw,
    segment: input.segment,
  };
  const options = buildQuoteOptions(sizes, inputs, { subsidy, price }, settings);
  const selectedKw = sizes.includes(input.selectedKw) ? input.selectedKw : sizes[0];

  return db.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        token: newToken(),
        leadId,
        quoteDate: new Date(quoteDate),
        status: "SENT",
        sentAt: new Date(),
        inputs: json(inputs),
        options: json(options),
        selectedKw,
        snapshot: json(buildSnapshot(subsidy, price, settings)),
        createdById: actorId,
      },
    });
    await tx.lead.update({ where: { id: leadId }, data: { stage: "QUOTED", recommendedKw: selectedKw } });
    await queueMessage(
      {
        lead,
        template: "quoteSent",
        values: { kw: selectedKw, link: `${appUrl}/${lead.locale}/q/${quote.token}` },
      },
      tx,
    );
    return quote;
  });
}

export function advanceFor(netCost: number, percent: number) {
  return Math.round((netCost * percent) / 100);
}

/** Mock payment. It records an advance and creates the project in one transaction. */
export async function recordAdvance(token: string, systemKw: number) {
  const quote = await db.quote.findUnique({ where: { token }, include: { lead: true, project: true } });
  if (!quote) return null;
  if (quote.project) return { project: quote.project, created: false };
  const { options, snapshot } = readQuote(quote);
  const option = options.find((o) => o.systemKw === systemKw);
  if (!option) return null;

  const project = await db.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        code: newProjectCode(),
        token: newToken(),
        leadId: quote.leadId,
        quoteId: quote.id,
        systemKw,
        netCost: option.netCost,
        advanceAmount: advanceFor(option.netCost, snapshot.advancePercent),
        advanceReference: `MOCK-${Date.now().toString(36).toUpperCase()}`,
        events: { create: { toStage: "ADVANCE_RECEIVED", note: "Advance recorded (mock payment)" } },
      },
    });
    await tx.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED", selectedKw: systemKw } });
    await tx.lead.update({ where: { id: quote.leadId }, data: { stage: "WON" } });
    return created;
  });
  return { project, created: true };
}

