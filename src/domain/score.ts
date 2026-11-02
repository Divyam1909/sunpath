import { isVidarbhaPincode } from "./pincode";
import type { Settings } from "./settings";
import { sizeSystem, type SizingResult } from "./sizing";

export type ScoreBand = "HIGH" | "MEDIUM" | "LOW";
export type NextAction = "SURVEY_VISIT" | "QUALIFICATION_CALL";

export interface LeadFacts {
  ownership: "OWNER" | "TENANT";
  monthlyBill: number;
  monthlyUnits: number;
  roofAreaSqm: number;
  pincode: string;
  sanctionedLoadKw: number | null;
  /** How the bill values were established. Null: typed by hand, no bill was read. */
  billConfidence: number | null;
}

export interface ScoreReason {
  code: string;
  tone: "good" | "note" | "problem";
  points: number;
  text: string;
  params?: Record<string, number | string>;
}

export interface LeadAssessment {
  score: ScoreBand;
  points: number;
  reasons: ScoreReason[];
  nextAction: NextAction;
  recommendedKw: number | null;
  sizing: SizingResult;
}

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

// A09: points out of 100. Tenant and small-bill leads are held at Low whatever the total.
const POINTS = { owner: 25, strongBill: 30, midBill: 10, roofFits: 20, roofPartial: 10, inArea: 15, confidentRead: 10 };

/**
 * Deterministic and explainable. The AI only supplies inputs (confirmed by a person);
 * it never picks the band. A Low score changes the next step to a short call, never a rejection.
 */
export function assessLead(facts: LeadFacts, settings: Settings): LeadAssessment {
  const reasons: ScoreReason[] = [];
  const add = (reason: ScoreReason) => reasons.push(reason);
  const { smallBillBelow, strongBillFrom, lowConfidenceBelow, highMinPoints, mediumMinPoints } = settings.score;

  const sizing = sizeSystem(facts, settings);
  const isTenant = facts.ownership === "TENANT";
  const isSmallBill = facts.monthlyBill < smallBillBelow;

  if (isTenant) add({ code: "tenant", tone: "problem", points: 0, text: "Tenant: needs owner consent" });
  else add({ code: "owner", tone: "good", points: POINTS.owner, text: "Owns the property" });

  const billParams = { bill: rupees(facts.monthlyBill) };
  if (isSmallBill) {
    add({ code: "smallBill", tone: "problem", points: 0, text: `Bill ${billParams.bill}: small savings`, params: billParams });
  } else if (facts.monthlyBill >= strongBillFrom) {
    add({ code: "strongBill", tone: "good", points: POINTS.strongBill, text: `Bill ${billParams.bill}: strong savings`, params: billParams });
  } else {
    add({ code: "midBill", tone: "note", points: POINTS.midBill, text: `Bill ${billParams.bill}: moderate savings`, params: billParams });
  }

  const { recommendedKw, demandKw, roofMaxKw } = sizing;
  if (roofMaxKw >= demandKw) {
    add({ code: "roofFits", tone: "good", points: POINTS.roofFits, text: `Roof fits ${demandKw} kW`, params: { kw: demandKw } });
  } else if (recommendedKw !== null) {
    add({
      code: "roofPartial",
      tone: "note",
      points: POINTS.roofPartial,
      text: `Roof fits ${roofMaxKw} kW of the ${demandKw} kW needed`,
      params: { kw: roofMaxKw, neededKw: demandKw },
    });
  } else {
    add({ code: "roofTooSmall", tone: "problem", points: 0, text: "Roof looks too small for a system" });
  }

  if (isVidarbhaPincode(facts.pincode)) {
    add({ code: "inArea", tone: "good", points: POINTS.inArea, text: "Inside the Vidarbha service area" });
  } else {
    add({ code: "outOfArea", tone: "problem", points: 0, text: `Pincode ${facts.pincode} is outside Vidarbha`, params: { pincode: facts.pincode } });
  }

  if (facts.billConfidence === null) {
    add({ code: "manualBill", tone: "note", points: 0, text: "Bill details typed by hand, not read from a bill" });
  } else if (facts.billConfidence < lowConfidenceBelow) {
    add({ code: "lowConfidence", tone: "note", points: 0, text: "Bill was hard to read: check the values on the call" });
  } else {
    add({ code: "confidentRead", tone: "good", points: POINTS.confidentRead, text: "Bill read clearly" });
  }

  const points = reasons.reduce((sum, r) => sum + r.points, 0);
  const heldLow = isTenant || isSmallBill;
  const score: ScoreBand = heldLow
    ? "LOW"
    : points >= highMinPoints
      ? "HIGH"
      : points >= mediumMinPoints
        ? "MEDIUM"
        : "LOW";

  return {
    score,
    points,
    reasons,
    nextAction: score === "LOW" ? "QUALIFICATION_CALL" : "SURVEY_VISIT",
    // A11: a tenant cannot commit the roof, so no size is offered until the owner is involved.
    recommendedKw: isTenant ? null : recommendedKw,
    sizing,
  };
}
