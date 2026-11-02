import { DEFAULT_SETTINGS } from "../src/domain/settings";
import type { PrismaClient } from "../src/generated/prisma/client";

export const SUBSIDY_SLABS = [
  { fromKw: 0, toKw: 2, ratePerKw: 30000 },
  { fromKw: 2, toKw: 3, ratePerKw: 18000 },
];

// A05: placeholder prices, to be replaced by Company A's rate card.
export const PRICE_BANDS = [
  { upToKw: 2, pricePerKw: 70000 },
  { upToKw: 3, pricePerKw: 65000 },
  { upToKw: 5, pricePerKw: 60000 },
  { upToKw: 10, pricePerKw: 55000 },
  { upToKw: null, pricePerKw: 52000 },
];

export async function seedRules(db: PrismaClient) {
  await db.subsidyRule.upsert({
    where: { id: "subsidy-central-residential" },
    update: {},
    create: {
      id: "subsidy-central-residential",
      schemeName: "Central residential rooftop scheme",
      segment: "RESIDENTIAL",
      slabs: SUBSIDY_SLABS,
      capAmount: 78000,
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: null,
      sourceNote: "As stated by the client: ₹30,000 per kW up to 2 kW plus ₹18,000 for the third kW, capped at ₹78,000. Verify before launch.",
      verifyBeforeLaunch: true,
    },
  });
  await db.priceRule.upsert({
    where: { id: "price-2026" },
    update: {},
    create: {
      id: "price-2026",
      name: "Standard rate card (assumed)",
      segment: "RESIDENTIAL",
      bands: PRICE_BANDS,
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: null,
      note: "ASSUMPTION A05: placeholder prices until Company A supplies its rate card.",
    },
  });
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}
