export const STAGES = [
  "ADVANCE_RECEIVED",
  "DOCUMENTS",
  "INSTALLATION_SCHEDULED",
  "INSTALLED",
  "NET_METERING_APPLIED",
  "NET_METER_INSTALLED",
  "SUBSIDY_APPLIED",
  "SUBSIDY_CREDITED",
] as const;

export type Stage = (typeof STAGES)[number];

export const FINAL_STAGE: Stage = "SUBSIDY_CREDITED";

export interface RequiredDoc {
  type: string;
  /** Customers can upload these from the status page; the rest come from staff. */
  byCustomer: boolean;
}

// A16: documents needed before a project can leave each stage.
export const REQUIRED_DOCS: Record<Stage, RequiredDoc[]> = {
  ADVANCE_RECEIVED: [],
  DOCUMENTS: [
    { type: "ID_PROOF", byCustomer: true },
    { type: "PROPERTY_PROOF", byCustomer: true },
    { type: "BANK_DETAILS", byCustomer: true },
  ],
  INSTALLATION_SCHEDULED: [{ type: "SITE_LAYOUT", byCustomer: false }],
  INSTALLED: [
    { type: "INSTALLATION_PHOTOS", byCustomer: false },
    { type: "COMMISSIONING_REPORT", byCustomer: false },
  ],
  NET_METERING_APPLIED: [{ type: "NET_METER_APPLICATION", byCustomer: false }],
  NET_METER_INSTALLED: [{ type: "NET_METER_CERTIFICATE", byCustomer: false }],
  SUBSIDY_APPLIED: [{ type: "SUBSIDY_APPLICATION", byCustomer: false }],
  SUBSIDY_CREDITED: [],
};

export const nextStage = (stage: Stage): Stage | null => STAGES[STAGES.indexOf(stage) + 1] ?? null;

export function missingDocs(stage: Stage, uploadedTypes: Iterable<string>) {
  const uploaded = new Set(uploadedTypes);
  return REQUIRED_DOCS[stage].filter((doc) => !uploaded.has(doc.type));
}

const DAY_MS = 86_400_000;

export const daysInStage = (enteredAt: Date, now: Date) =>
  Math.floor((now.getTime() - enteredAt.getTime()) / DAY_MS);

export interface StuckCheck {
  stuck: boolean;
  days: number;
  slaDays: number | null;
  overdueBy: number;
}

/** Stuck means strictly past the stage's SLA. A finished project is never stuck. */
export function checkStuck(stage: Stage, enteredAt: Date, slaDays: Record<string, number>, now: Date): StuckCheck {
  const days = daysInStage(enteredAt, now);
  const sla = stage === FINAL_STAGE ? null : (slaDays[stage] ?? null);
  const stuck = sla !== null && days > sla;
  return { stuck, days, slaDays: sla, overdueBy: stuck ? days - sla : 0 };
}
