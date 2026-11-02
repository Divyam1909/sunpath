import { DEFAULT_SETTINGS } from "../src/domain/settings";
import type { BillTariff } from "../src/domain/tariff";
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

// Energy, wheeling and fixed charges: MERC Case 75 of 2025, Summary of LT Tariff. FAC: as printed on MSEDCL's October 2026 bill.
const FAC = [0.25, 0.5, 0.65, 0.7, 0.7];
const slabs = (energy: number[]) =>
  [100, 300, 500, 1000, null].map((upToUnits, i) => ({ upToUnits, energyPerUnit: energy[i], facPerUnit: FAC[i] }));

export const TARIFF_FY2627: BillTariff = {
  name: "MSEDCL LT-I(B) Residential, FY 2026-27",
  effectiveFrom: "2026-04-01",
  slabs: slabs([3.96, 10.8, 15.03, 17.53, 17.53]),
  fixedSinglePhase: 130,
  fixedThreePhase: 435,
  wheelingPerUnit: 1.6,
  dutyPercent: 16,
};

const TARIFF_FY2728: BillTariff = {
  ...TARIFF_FY2627,
  name: "MSEDCL LT-I(B) Residential, FY 2027-28",
  effectiveFrom: "2027-04-01",
  slabs: slabs([3.8, 10.65, 14.81, 17.38, 17.38]),
  fixedSinglePhase: 135,
  fixedThreePhase: 440,
  wheelingPerUnit: 1.63,
};

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
  const tariffs = [
    { id: "tariff-lt1b-fy2627", rule: TARIFF_FY2627, effectiveTo: new Date("2027-03-31"), note: "MERC Case 75 of 2025 (revised 25 Mar 2026). Reproduces MSEDCL's published Oct 2026 bill to the paisa. FAC changes monthly." },
    { id: "tariff-lt1b-fy2728", rule: TARIFF_FY2728, effectiveTo: null, note: "MERC Case 75 of 2025, approved for FY 2027-28. FAC carried over from Oct 2026 until new figures are printed." },
  ];
  for (const { id, rule, effectiveTo, note } of tariffs) {
    const { name, slabs: tariffSlabs, fixedSinglePhase, fixedThreePhase, wheelingPerUnit, dutyPercent } = rule;
    await db.tariffRule.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        segment: "RESIDENTIAL",
        slabs: tariffSlabs,
        fixedSinglePhase,
        fixedThreePhase,
        wheelingPerUnit,
        dutyPercent,
        effectiveFrom: new Date(rule.effectiveFrom),
        effectiveTo,
        sourceNote: note,
      },
    });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}
