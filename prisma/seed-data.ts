import type { Stage } from "../src/domain/project";

export interface SeedProject {
  code: string;
  stage: Stage;
  daysInStage: number;
  /** Fixed token so the README can link straight to a status page. */
  token: string;
  statusViews: number;
  /** Real-looking days per stage for finished projects. These feed the forecast. */
  stageDays?: number[];
  /** Monthly bills after solar: month, and the bill as a multiple of what was promised. */
  bills?: [string, number][];
}

export interface SeedLead {
  code: string;
  name: string;
  phone: string;
  ownership: "OWNER" | "TENANT";
  roofType: "RCC_FLAT" | "METAL_SHEET" | "TILED" | "OTHER";
  roofSqFt: number;
  bill: number;
  units: number;
  loadKw: number;
  pincode: string;
  town: string;
  tariff: string;
  locale: "en" | "mr" | "hi";
  stage: "NEW" | "SCORED" | "SURVEY_BOOKED" | "SURVEYED" | "QUOTED" | "WON" | "CLOSED";
  receivedDaysAgo: number;
  /** Which public sample bill this lead uploaded. Default: a generated bill in prisma/seed-bills. */
  sampleBill?: string;
  surveyDaysAgo?: number;
  surveyQualified?: boolean;
  shading?: "NONE" | "PARTIAL" | "HEAVY";
  /** Days between survey and quote. 0 is a same-day quote. */
  quoteLagDays?: number;
  quoteToken?: string;
  project?: SeedProject;
  /** Lookalike bills only: the name printed on the bill and the arrears on it. */
  billName?: string;
  arrears?: number;
}

const RES = "LT I - Residential";
const COM = "LT II - Commercial";

// The first three rows are the brief's sample data, unchanged. Everyone here is fictional.
export const SEED_LEADS: SeedLead[] = [
  { code: "LD-30881", name: "Prashant Wankhede", phone: "9000030881", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 600, bill: 3200, units: 340, loadKw: 5, pincode: "440022", town: "Nagpur", tariff: RES, locale: "en", stage: "SURVEYED", receivedDaysAgo: 3, sampleBill: "clear-home-bill.jpg", surveyDaysAgo: 0, surveyQualified: true, shading: "NONE" },
  { code: "LD-30902", name: "Rohit Meshram", phone: "9000030902", ownership: "TENANT", roofType: "RCC_FLAT", roofSqFt: 450, bill: 1900, units: 210, loadKw: 3, pincode: "440015", town: "Nagpur", tariff: RES, locale: "hi", stage: "SCORED", receivedDaysAgo: 2 },
  { code: "LD-30915", name: "Ayesha Siddiqui", phone: "9000030915", ownership: "OWNER", roofType: "METAL_SHEET", roofSqFt: 300, bill: 650, units: 85, loadKw: 2, pincode: "444601", town: "Amravati", tariff: RES, locale: "en", stage: "SCORED", receivedDaysAgo: 1, sampleBill: "small-home-bill.jpg" },

  { code: "LD-31002", name: "Sachin Dhawale", phone: "9000031002", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 900, bill: 4800, units: 500, loadKw: 7, pincode: "440010", town: "Nagpur", tariff: RES, locale: "mr", stage: "SCORED", receivedDaysAgo: 0 },
  { code: "LD-31004", name: "Rekha Ingle", phone: "9000031004", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 500, bill: 2600, units: 280, loadKw: 4, pincode: "444001", town: "Akola", tariff: RES, locale: "mr", stage: "SURVEY_BOOKED", receivedDaysAgo: 4 },
  { code: "LD-31005", name: "Imran Pathan", phone: "9000031005", ownership: "OWNER", roofType: "TILED", roofSqFt: 280, bill: 1500, units: 170, loadKw: 3, pincode: "445001", town: "Yavatmal", tariff: RES, locale: "hi", stage: "SCORED", receivedDaysAgo: 1 },
  { code: "LD-31006", name: "Kavita Lanjewar", phone: "9000031006", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 700, bill: 3900, units: 410, loadKw: 5, pincode: "441601", town: "Gondia", tariff: RES, locale: "mr", stage: "NEW", receivedDaysAgo: 0 },
  { code: "LD-31007", name: "Yogesh Fulzele", phone: "9000031007", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 650, bill: 3400, units: 360, loadKw: 5, pincode: "441904", town: "Bhandara", tariff: RES, locale: "en", stage: "QUOTED", receivedDaysAgo: 7, surveyDaysAgo: 2, surveyQualified: true, shading: "NONE", quoteLagDays: 0, quoteToken: "demo-quote-ld-31007" },
  { code: "LD-31009", name: "Sample Traders", phone: "9000031009", ownership: "OWNER", roofType: "METAL_SHEET", roofSqFt: 1000, bill: 8400, units: 620, loadKw: 8, pincode: "442001", town: "Wardha", tariff: COM, locale: "en", stage: "SURVEY_BOOKED", receivedDaysAgo: 5, sampleBill: "shop-bill.jpg" },
  { code: "LD-31011", name: "Ganesh Pawar", phone: "9000031011", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 800, bill: 3000, units: 320, loadKw: 5, pincode: "411001", town: "Pune", tariff: RES, locale: "mr", stage: "SCORED", receivedDaysAgo: 2 },
  { code: "LD-31012", name: "Sunita Kale", phone: "9000031012", ownership: "OWNER", roofType: "OTHER", roofSqFt: 150, bill: 900, units: 110, loadKw: 2, pincode: "443001", town: "Buldhana", tariff: RES, locale: "mr", stage: "CLOSED", receivedDaysAgo: 18, surveyDaysAgo: 12, surveyQualified: false, shading: "HEAVY" },

  { code: "LD-31014", name: "Sanjay Thakre", phone: "9000031014", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 750, bill: 4500, units: 470, loadKw: 6, pincode: "440016", town: "Nagpur", tariff: RES, locale: "mr", stage: "WON", receivedDaysAgo: 14, surveyDaysAgo: 8, surveyQualified: true, shading: "NONE", quoteLagDays: 0, project: { code: "PR-1001", stage: "ADVANCE_RECEIVED", daysInStage: 1, token: "demo-status-pr-1001", statusViews: 2 } },
  { code: "LD-31015", name: "Meena Bhoyar", phone: "9000031015", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 550, bill: 3100, units: 330, loadKw: 5, pincode: "442401", town: "Chandrapur", tariff: RES, locale: "mr", stage: "WON", receivedDaysAgo: 30, surveyDaysAgo: 24, surveyQualified: true, shading: "NONE", quoteLagDays: 0, project: { code: "PR-1002", stage: "DOCUMENTS", daysInStage: 12, token: "demo-status-pr-1002", statusViews: 6 } },
  { code: "LD-31016", name: "Anil Gawande", phone: "9000031016", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 700, bill: 3800, units: 400, loadKw: 5, pincode: "444444", town: "Washim", tariff: RES, locale: "en", stage: "WON", receivedDaysAgo: 12, surveyDaysAgo: 7, surveyQualified: true, shading: "PARTIAL", quoteLagDays: 0, project: { code: "PR-1003", stage: "DOCUMENTS", daysInStage: 2, token: "demo-status-pr-1003", statusViews: 3 } },
  { code: "LD-31017", name: "Farhan Sheikh", phone: "9000031017", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 500, bill: 3300, units: 350, loadKw: 4, pincode: "440024", town: "Nagpur", tariff: RES, locale: "hi", stage: "WON", receivedDaysAgo: 28, surveyDaysAgo: 22, surveyQualified: true, shading: "NONE", quoteLagDays: 0, project: { code: "PR-1004", stage: "INSTALLATION_SCHEDULED", daysInStage: 6, token: "demo-status-pr-1004", statusViews: 7 } },
  { code: "LD-31018", name: "Vaishali Raut", phone: "9000031018", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 800, bill: 4700, units: 490, loadKw: 6, pincode: "444602", town: "Amravati", tariff: RES, locale: "mr", stage: "WON", receivedDaysAgo: 46, surveyDaysAgo: 40, surveyQualified: true, shading: "NONE", quoteLagDays: 1, project: { code: "PR-1005", stage: "INSTALLED", daysInStage: 9, token: "demo-status-pr-1005", statusViews: 11 } },
  { code: "LD-31019", name: "Nitin Chaudhari", phone: "9000031019", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 600, bill: 3250, units: 345, loadKw: 5, pincode: "441001", town: "Kamptee", tariff: RES, locale: "hi", stage: "WON", receivedDaysAgo: 75, surveyDaysAgo: 68, surveyQualified: true, shading: "NONE", quoteLagDays: 0, project: { code: "PR-1006", stage: "NET_METERING_APPLIED", daysInStage: 30, token: "demo-status-pr-1006", statusViews: 14 } },
  { code: "LD-31020", name: "Swati Dhoke", phone: "9000031020", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 400, bill: 2200, units: 235, loadKw: 3, pincode: "442101", town: "Hinganghat", tariff: RES, locale: "en", stage: "WON", receivedDaysAgo: 90, surveyDaysAgo: 84, surveyQualified: true, shading: "NONE", quoteLagDays: 0, project: { code: "PR-1007", stage: "SUBSIDY_APPLIED", daysInStage: 12, token: "demo-status-pr-1007", statusViews: 9 } },
  { code: "LD-31021", name: "Deepak Nagpure", phone: "9000031021", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 900, bill: 5200, units: 540, loadKw: 7, pincode: "440025", town: "Nagpur", tariff: RES, locale: "en", stage: "WON", receivedDaysAgo: 150, surveyDaysAgo: 142, surveyQualified: true, shading: "NONE", quoteLagDays: 0, project: { code: "PR-1008", stage: "SUBSIDY_CREDITED", daysInStage: 20, token: "demo-status-pr-1008", statusViews: 16, stageDays: [3, 6, 12, 4, 33, 6, 28], bills: [["2026-09", 1.02], ["2026-10", 1.05]] } },

  // Peak-month and paperwork examples for the new bill checks. Both use lookalike bills.
  { code: "LD-31022", name: "Vinod Bobde", phone: "9000031022", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 700, bill: 8230, units: 610, loadKw: 6, pincode: "440015", town: "Nagpur", tariff: RES, locale: "mr", stage: "SCORED", receivedDaysAgo: 1, sampleBill: "peak-may-bill.jpg" },
  { code: "LD-31023", name: "Pooja Tiwari", phone: "9000031023", ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 650, bill: 8670, units: 420, loadKw: 2, pincode: "440010", town: "Nagpur", tariff: RES, locale: "hi", stage: "SCORED", receivedDaysAgo: 0, sampleBill: "name-and-arrears-bill.jpg", billName: "RAMESH K TIWARI", arrears: 2986.44 },

  // Finished jobs. Their stage history is what the completion forecast learns from.
  ...[
    { code: "LD-31101", name: "Harish Bhagat", town: "Nagpur", pin: "440027", units: 360, bill: 3500, ago: 40, days: [2, 7, 13, 4, 41, 7, 26], bills: [["2026-08", 0.97], ["2026-09", 1.01], ["2026-10", 0.99]] },
    { code: "LD-31102", name: "Leena Sonkusare", town: "Bhandara", pin: "441904", units: 310, bill: 2950, ago: 61, days: [3, 9, 11, 5, 38, 6, 31], bills: [["2026-08", 1.03], ["2026-09", 1.2], ["2026-10", 1.12]] },
    { code: "LD-31103", name: "Rajesh Katre", town: "Wardha", pin: "442001", units: 420, bill: 4200, ago: 84, days: [2, 5, 15, 3, 52, 8, 24], bills: [["2026-08", 2.4], ["2026-09", 2.6]] },
    { code: "LD-31104", name: "Nanda Borkar", town: "Nagpur", pin: "440034", units: 290, bill: 2750, ago: 102, days: [3, 6, 10, 4, 44, 5, 29], bills: [] },
    { code: "LD-31105", name: "Arvind Tembhurne", town: "Chandrapur", pin: "442401", units: 380, bill: 3700, ago: 127, days: [4, 8, 14, 6, 36, 7, 33], bills: [] },
  ].map((row, i): SeedLead => {
    const worked = row.days.reduce((a, b) => a + b, 0);
    return {
      code: row.code, name: row.name, phone: `90000311${String(i + 1).padStart(2, "0")}`, ownership: "OWNER", roofType: "RCC_FLAT", roofSqFt: 700, bill: row.bill, units: row.units, loadKw: 5,
      pincode: row.pin, town: row.town, tariff: RES, locale: "en", stage: "WON", receivedDaysAgo: row.ago + worked + 9, surveyDaysAgo: row.ago + worked + 1, surveyQualified: true, shading: "NONE", quoteLagDays: 0,
      project: { code: `PR-09${String(i + 1).padStart(2, "0")}`, stage: "SUBSIDY_CREDITED", daysInStage: row.ago, token: `demo-status-pr-09${String(i + 1).padStart(2, "0")}`, statusViews: 8 + i, stageDays: row.days, bills: row.bills as [string, number][] },
    };
  }),
];

/** A year of consumption with seasons, adjusted so the average is exactly `units`. */
export function seedHistory(units: number) {
  const shape = [0.92, 0.84, 0.8, 0.82, 0.9, 1.08, 1.27, 1.34, 1.12, 1.0, 0.96, 1];
  const history = shape.map((factor) => Math.round(units * factor));
  history[11] = units;
  const gap = units * 12 - history.reduce((a, b) => a + b, 0);
  history[10] += gap;
  return history;
}

/** Fake consumer numbers from the lead code. */
export const seedConsumerNumber = (code: string) => `4100${code.slice(3).padStart(8, "0")}`;
