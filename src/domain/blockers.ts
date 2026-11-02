import type { Settings } from "./settings";
import type { SizingReason } from "./sizing";

export type BlockerCode = "nameMismatch" | "arrears" | "loadLow" | "nonResidential" | "tenant" | "alreadySolar" | "meterFault";

export interface Blocker {
  code: BlockerCode;
  /** STOPS means the subsidy or net meter cannot go ahead until it is fixed. */
  severity: "STOPS" | "CHECK";
  params: Record<string, string | number>;
}

const TITLES = new Set(["SHRI", "SHREE", "SMT", "SOU", "SAU", "KUM", "MR", "MRS", "MS", "MISS", "DR", "LATE", "M", "S", "W", "D", "O"]);

const nameTokens = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && !TITLES.has(token));

/** Edit distance, so Wankhade and Wankhede count as one name. */
function distance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

const sameToken = (a: string, b: string) => {
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  return distance(a, b) <= (Math.min(a.length, b.length) >= 5 ? 1 : 0);
};

/**
 * A41: compares the name on the bill with the applicant, allowing for titles, word order, initials
 * and small spelling changes. Returns null when the bill's name is not in Latin script: no guessing.
 */
export function namesMatch(applicant: string, onBill: string): boolean | null {
  const bill = nameTokens(onBill);
  const person = nameTokens(applicant);
  if (bill.length === 0 || person.length === 0) return null;
  const matched = person.filter((token) => bill.some((other) => sameToken(token, other)));
  const fullWords = matched.filter((token) => token.length > 1);
  return fullWords.length >= 1 && matched.length >= Math.min(person.length, bill.length, 2);
}

export interface BlockerFacts {
  leadName: string;
  ownership: "OWNER" | "TENANT";
  segment: string;
  consumerName: string | null;
  arrearsAmount: number | null;
  solarExportUnits: number | null;
  meterStatus: string | null;
  sizing: { demandKw: number; recommendedKw: number | null; reasons: SizingReason[] };
}

/** A41: the things that stop a subsidy or net meter later, found while the lead is still cheap to fix. */
export function findBlockers(facts: BlockerFacts, settings: Pick<Settings, "arrearsBlockAbove">): Blocker[] {
  const blockers: Blocker[] = [];
  if (facts.segment !== "RESIDENTIAL") blockers.push({ code: "nonResidential", severity: "STOPS", params: {} });
  if (facts.ownership === "TENANT") blockers.push({ code: "tenant", severity: "STOPS", params: {} });
  if (facts.consumerName && namesMatch(facts.leadName, facts.consumerName) === false) {
    blockers.push({ code: "nameMismatch", severity: "STOPS", params: { onBill: facts.consumerName } });
  }
  if ((facts.arrearsAmount ?? 0) > settings.arrearsBlockAbove) {
    blockers.push({ code: "arrears", severity: "STOPS", params: { amount: Math.round(facts.arrearsAmount!) } });
  }
  const capped = facts.sizing.reasons.find((r) => r.code === "loadCap" || r.code === "loadTooSmall");
  if (capped && "sanctionedLoadKw" in capped) {
    blockers.push({
      code: "loadLow",
      severity: "CHECK",
      params: { loadKw: capped.sanctionedLoadKw, wantedKw: facts.sizing.demandKw },
    });
  }
  if ((facts.solarExportUnits ?? 0) > 0) blockers.push({ code: "alreadySolar", severity: "CHECK", params: {} });
  if (facts.meterStatus && !/normal|^ok$|सामान्य/i.test(facts.meterStatus)) {
    blockers.push({ code: "meterFault", severity: "CHECK", params: { status: facts.meterStatus } });
  }
  return blockers;
}
