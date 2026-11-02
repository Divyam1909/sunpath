import "./seed-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { createTranslator } from "next-intl";
import { averageUnits, parseBillResponse, type ConfirmedBill, type BillExtraction } from "../src/domain/bill";
import { istDate } from "../src/domain/format";
import { REQUIRED_DOCS, STAGES, type Stage } from "../src/domain/project";
import { buildQuoteOptions, optionSizes, resolveTariff, type QuoteInputs } from "../src/domain/quote";
import { assessLead } from "../src/domain/score";
import { DEFAULT_SETTINGS as settings } from "../src/domain/settings";
import { sizeSystem, usableRoofSqm } from "../src/domain/sizing";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { CONSENT_PURPOSE, CONSENT_VERSION, SQM_PER_SQFT } from "../src/lib/validation";
import { fileStore } from "../src/server/storage";
import { newToken } from "../src/server/tokens";
import fixtures from "../src/server/bill-reader/sample-fixtures.json";
import { seedConsumerNumber, seedHistory, SEED_LEADS, type SeedLead } from "./seed-data";
import { PRICE_BANDS, SUBSIDY_SLABS, seedRules } from "./seed-rules";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const json = (value: unknown) => value as Prisma.InputJsonValue;

const messagesFor = (locale: string) => JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));

function outbox(lead: SeedLead, key: string, values: Record<string, string | number>) {
  const messages = messagesFor(lead.locale);
  const t = createTranslator({ locale: lead.locale, messages }) as unknown as (k: string, v?: object) => string;
  return t(`outbox.${key}`, { name: lead.name.split(" ")[0], ...values });
}

function stageText(lead: SeedLead, stage: Stage, token: string) {
  const t = createTranslator({ locale: lead.locale, messages: messagesFor(lead.locale) }) as unknown as (k: string) => string;
  const appUrl = process.env.SEED_APP_URL ?? "http://localhost:3000";
  return outbox(lead, "stage", { stage: t(`stages.${stage}`), next: t(`stageNext.${stage}`), link: `${appUrl}/${lead.locale}/s/${token}` });
}

/** What the reader would have stored for this bill. Sample files use their real fixture. */
function aiRead(lead: SeedLead) {
  const sample = Object.values(fixtures).find((f) => f.file === lead.sampleBill);
  const history = seedHistory(lead.units);
  const conf = <T,>(value: T, confidence = 0.95) => ({ value, confidence });
  const extraction: BillExtraction = {
    isElectricityBill: true,
    imageQuality: "good",
    consumerNumber: conf(seedConsumerNumber(lead.code)),
    tariffCategory: conf(lead.tariff),
    ratePerUnit: conf<number | null>(null, 0),
    sanctionedLoadKw: conf(lead.loadKw),
    unitsLatestMonth: conf(lead.units),
    billAmount: conf(lead.bill),
    billingMonth: conf("Sep 2026"),
    monthlyUnitsHistory: history,
  };
  const parsed = parseBillResponse(JSON.stringify(sample?.response ?? extraction), settings.score.lowConfidenceBelow);
  if (parsed.kind !== "ok") throw new Error(`Bad seed bill for ${lead.code}`);
  return parsed;
}

const DOC_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n" +
    "4 0 obj<</Length 52>>stream\nBT /F1 14 Tf 30 60 Td (SAMPLE DOCUMENT, not real) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n",
);

async function seedLead(row: SeedLead, staffId: string, subsidyId: string, priceId: string) {
  const roofAreaSqm = Number((row.roofSqFt * SQM_PER_SQFT).toFixed(1));
  const parsed = aiRead(row);
  const history = parsed.extraction.monthlyUnitsHistory;
  const bill: ConfirmedBill = {
    consumerNumber: parsed.extraction.consumerNumber.value,
    tariffCategory: parsed.extraction.tariffCategory.value,
    ratePerUnit: null,
    sanctionedLoadKw: parsed.extraction.sanctionedLoadKw.value,
    unitsLatestMonth: row.units,
    billAmount: row.bill,
    billingMonth: parsed.extraction.billingMonth.value,
    averageMonthlyUnits: averageUnits(row.units, history),
  };
  const hasBill = row.stage !== "NEW";
  const assessment = assessLead(
    {
      ownership: row.ownership,
      monthlyBill: row.bill,
      monthlyUnits: bill.averageMonthlyUnits,
      roofAreaSqm,
      pincode: row.pincode,
      sanctionedLoadKw: hasBill ? bill.sanctionedLoadKw : null,
      billConfidence: hasBill ? parsed.confidence : null,
    },
    settings,
  );
  const surveyedAt = row.surveyDaysAgo === undefined ? null : daysAgo(row.surveyDaysAgo);
  const surveyRoofSqm = surveyedAt ? roofAreaSqm : null;

  const lead = await db.lead.create({
    data: {
      code: row.code,
      accessToken: `demo-lead-${row.code.toLowerCase()}`,
      name: row.name,
      phone: row.phone,
      ownership: row.ownership,
      roofType: row.roofType,
      roofAreaSqm,
      monthlyBill: row.bill,
      pincode: row.pincode,
      locale: row.locale,
      consentAt: daysAgo(row.receivedDaysAgo),
      consentPurpose: CONSENT_PURPOSE,
      consentVersion: CONSENT_VERSION,
      stage: row.stage,
      score: assessment.score,
      scorePoints: assessment.points,
      scoreReasons: json(assessment.reasons),
      nextAction: assessment.nextAction,
      recommendedKw: assessment.recommendedKw,
      sizingReasons: json(assessment.sizing.reasons),
      scoredAt: daysAgo(row.receivedDaysAgo),
      surveyBookedFor: row.stage === "SURVEY_BOOKED" ? daysAgo(-1) : surveyedAt,
      surveyedAt,
      surveyQualified: row.surveyQualified,
      surveyRoofSqm,
      surveyShading: row.shading,
      surveyNotes: surveyedAt ? "Clear access to the terrace. Inverter wall identified." : null,
      closedReason: row.stage === "CLOSED" ? "Roof too shaded after survey" : null,
      createdAt: daysAgo(row.receivedDaysAgo),
    },
  });

  if (hasBill) {
    const file = row.sampleBill ? path.join("public/samples", row.sampleBill) : path.join("prisma/seed-bills", `${row.code}.jpg`);
    const bytes = readFileSync(file);
    const storageKey = `bills/${lead.id}/${newToken()}.jpg`;
    await fileStore.put(storageKey, bytes, "image/jpeg");
    await db.billReading.create({
      data: {
        leadId: lead.id,
        storageKey,
        mimeType: "image/jpeg",
        sizeBytes: bytes.length,
        sha256: "seed",
        status: "CONFIRMED",
        reader: "mock",
        ai: json({ extraction: parsed.extraction, confidence: parsed.confidence, lowConfidence: parsed.lowConfidence }),
        confirmed: json(bill),
        confirmedBy: "HOMEOWNER",
        confirmedAt: daysAgo(row.receivedDaysAgo),
        createdAt: daysAgo(row.receivedDaysAgo),
      },
    });
    await db.messageOutbox.create({
      data: { leadId: lead.id, toPhone: row.phone, locale: row.locale, templateKey: "leadReceived", body: outbox(row, "leadReceived", {}), createdAt: daysAgo(row.receivedDaysAgo) },
    });
  }

  if (row.quoteLagDays === undefined || !surveyedAt) return lead;

  const usable = usableRoofSqm(roofAreaSqm, row.shading ?? "NONE");
  const sizing = sizeSystem({ monthlyUnits: bill.averageMonthlyUnits, roofAreaSqm: usable, sanctionedLoadKw: bill.sanctionedLoadKw }, settings);
  const kw = sizing.recommendedKw!;
  const inputs: QuoteInputs = {
    monthlyUnits: bill.averageMonthlyUnits,
    tariffPerUnit: resolveTariff({ ratePerUnit: null, billAmount: bill.billAmount, units: bill.unitsLatestMonth }, settings),
    maxKw: sizing.maxKw,
    segment: "RESIDENTIAL",
  };
  const subsidy = { slabs: SUBSIDY_SLABS, capAmount: 78000 };
  const price = { bands: PRICE_BANDS };
  const options = buildQuoteOptions(optionSizes(kw, sizing.maxKw, settings), inputs, { subsidy, price }, settings);
  const sentAt = new Date(surveyedAt.getTime() - row.quoteLagDays * -DAY);
  const quote = await db.quote.create({
    data: {
      token: row.quoteToken ?? `demo-quote-${row.code.toLowerCase()}`,
      leadId: lead.id,
      quoteDate: new Date(istDate(sentAt)),
      status: row.project ? "ACCEPTED" : "SENT",
      inputs: json(inputs),
      options: json(options),
      selectedKw: kw,
      sentAt,
      createdById: staffId,
      snapshot: json({
        subsidyRule: { id: subsidyId, schemeName: "Central residential rooftop scheme", ...subsidy, effectiveFrom: "2026-01-01", effectiveTo: null },
        priceRule: { id: priceId, name: "Standard rate card (assumed)", ...price, effectiveFrom: "2026-01-01", effectiveTo: null },
        generationKwhPerKwYear: settings.generationKwhPerKwYear,
        surplusRatePerUnit: settings.netMetering.surplusRatePerUnit,
        advancePercent: settings.advancePercent,
      }),
    },
  });
  const appUrl = process.env.SEED_APP_URL ?? "http://localhost:3000";
  await db.messageOutbox.create({
    data: {
      leadId: lead.id,
      toPhone: row.phone,
      locale: row.locale,
      templateKey: "quoteSent",
      body: outbox(row, "quoteSent", { kw, link: `${appUrl}/${row.locale}/q/${quote.token}` }),
      createdAt: sentAt,
    },
  });

  if (!row.project) return lead;

  const { code, stage, daysInStage, token, statusViews } = row.project;
  const option = options.find((o) => o.systemKw === kw)!;
  const stageIndex = STAGES.indexOf(stage);
  const paidAt = sentAt.getTime();
  const enteredAt = daysAgo(daysInStage);
  // Spread earlier stages evenly between the advance and the current stage.
  const stepMs = stageIndex === 0 ? 0 : (enteredAt.getTime() - paidAt) / stageIndex;
  const reachedAt = (i: number) => new Date(paidAt + stepMs * i);

  const project = await db.project.create({
    data: {
      code,
      token,
      leadId: lead.id,
      quoteId: quote.id,
      systemKw: kw,
      netCost: option.netCost,
      advanceAmount: Math.round((option.netCost * settings.advancePercent) / 100),
      advanceReference: `MOCK-${code}`,
      stage,
      stageEnteredAt: enteredAt,
      statusViews,
      createdAt: reachedAt(0),
    },
  });

  for (let i = 0; i <= stageIndex; i++) {
    const at = i === stageIndex ? enteredAt : reachedAt(i);
    await db.projectEvent.create({
      data: { projectId: project.id, fromStage: i === 0 ? null : STAGES[i - 1], toStage: STAGES[i], actorId: i === 0 ? null : staffId, createdAt: at },
    });
    await db.messageOutbox.create({
      data: { leadId: lead.id, projectId: project.id, toPhone: row.phone, locale: row.locale, templateKey: "stage", body: stageText(row, STAGES[i], token), createdAt: at },
    });
    // Stages already passed have their documents. The stuck DOCUMENTS project is missing some on purpose.
    const docs = i < stageIndex ? REQUIRED_DOCS[STAGES[i]] : stage === "DOCUMENTS" && daysInStage > 7 ? REQUIRED_DOCS.DOCUMENTS.slice(0, 1) : [];
    for (const doc of docs) {
      const storageKey = `projects/${project.id}/${newToken()}.pdf`;
      await fileStore.put(storageKey, DOC_PDF, "application/pdf");
      await db.projectDocument.create({
        data: { projectId: project.id, docType: doc.type, fileName: `${doc.type.toLowerCase()}.pdf`, mimeType: "application/pdf", storageKey, uploadedBy: doc.byCustomer ? "CUSTOMER" : staffId, createdAt: at },
      });
    }
  }
  return lead;
}

async function main() {
  await seedRules(db);

  const users = [
    { name: "Sneha Kulkarni", login: "sales@sunpath.demo", password: "sales-demo-1", role: "SALES" as const },
    { name: "Vivek Deshmukh", login: "admin@sunpath.demo", password: "admin-demo-1", role: "ADMIN" as const },
    { name: "Prashant Wankhede", login: "9000030881", password: "home-demo-1", role: "HOMEOWNER" as const },
  ];
  const ids: Record<string, string> = {};
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const row = await db.user.upsert({
      where: { login: u.login },
      update: { passwordHash },
      create: { name: u.name, login: u.login, passwordHash, role: u.role },
    });
    ids[u.role] = row.id;
  }

  // Replaces only the demo records, so re-seeding never touches leads people have submitted.
  await db.lead.deleteMany({ where: { code: { in: SEED_LEADS.map((l) => l.code) } } });

  for (const row of SEED_LEADS) {
    await seedLead(row, ids.SALES, "subsidy-central-residential", "price-2026");
  }
  await db.lead.updateMany({ where: { code: "LD-30881" }, data: { userId: ids.HOMEOWNER } });

  console.log(`Seeded ${SEED_LEADS.length} leads and ${SEED_LEADS.filter((l) => l.project).length} projects.`);
}

main().finally(() => db.$disconnect());
