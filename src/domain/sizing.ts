import type { Settings } from "./settings";

export interface SizingInput {
  monthlyUnits: number;
  roofAreaSqm: number;
  sanctionedLoadKw: number | null;
}

export type SizingReason =
  | { code: "demand"; monthlyUnits: number; neededKw: number; roundedKw: number }
  | { code: "minimum"; minKw: number }
  | { code: "roofCap"; roofAreaSqm: number; roofMaxKw: number }
  | { code: "loadCap"; sanctionedLoadKw: number }
  | { code: "roofTooSmall"; roofAreaSqm: number; roofMaxKw: number }
  | { code: "loadTooSmall"; sanctionedLoadKw: number };

export interface SizingResult {
  /** Null when no system at or above the minimum size fits. */
  recommendedKw: number | null;
  demandKw: number;
  roofMaxKw: number;
  /** Largest size allowed by roof and sanctioned load: the ceiling for quote options. */
  maxKw: number;
  reasons: SizingReason[];
}

const roundToStep = (kw: number, step: number) => Math.round(kw / step) * step;
const floorToStep = (kw: number, step: number) => Math.floor(kw / step + 1e-9) * step;

export function sizeSystem(input: SizingInput, settings: Settings): SizingResult {
  const { stepKw, minKw, sqmPerKw } = settings.sizing;
  const neededKw = (input.monthlyUnits * 12) / settings.generationKwhPerKwYear;
  const roundedKw = roundToStep(neededKw, stepKw);
  const demandKw = Math.max(roundedKw, minKw);
  const reasons: SizingReason[] = [
    { code: "demand", monthlyUnits: input.monthlyUnits, neededKw: Number(neededKw.toFixed(2)), roundedKw },
  ];
  if (roundedKw < minKw) reasons.push({ code: "minimum", minKw });

  const roofMaxKw = floorToStep(input.roofAreaSqm / sqmPerKw, stepKw);
  const loadMaxKw = input.sanctionedLoadKw ?? Infinity; // A04: no load known, no load cap
  const maxKw = Math.min(roofMaxKw, loadMaxKw);

  if (roofMaxKw < minKw) {
    reasons.push({ code: "roofTooSmall", roofAreaSqm: input.roofAreaSqm, roofMaxKw });
    return { recommendedKw: null, demandKw, roofMaxKw, maxKw, reasons };
  }
  if (loadMaxKw < minKw) {
    reasons.push({ code: "loadTooSmall", sanctionedLoadKw: loadMaxKw });
    return { recommendedKw: null, demandKw, roofMaxKw, maxKw, reasons };
  }

  let recommendedKw = demandKw;
  if (recommendedKw > roofMaxKw) {
    recommendedKw = roofMaxKw;
    reasons.push({ code: "roofCap", roofAreaSqm: input.roofAreaSqm, roofMaxKw });
  }
  if (recommendedKw > loadMaxKw) {
    recommendedKw = floorToStep(loadMaxKw, stepKw);
    reasons.push({ code: "loadCap", sanctionedLoadKw: loadMaxKw });
  }
  return { recommendedKw, demandKw, roofMaxKw, maxKw, reasons };
}
