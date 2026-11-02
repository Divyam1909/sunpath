import { z } from "zod";

// Every value here is editable in admin. IDs refer to docs/ASSUMPTIONS.md.
export const settingsSchema = z.object({
  generationKwhPerKwYear: z.number().positive(), // Brief: 1,400 units per kW per year
  sizing: z.object({
    stepKw: z.number().positive(), // A01
    minKw: z.number().positive(), // A01
    optionStepKw: z.number().positive(), // A02
    sqmPerKw: z.number().positive(), // A03
  }),
  netMetering: z.object({
    surplusRatePerUnit: z.number().min(0), // A06
    fallbackTariffPerUnit: z.number().positive(), // A07
  }),
  score: z.object({
    highMinPoints: z.number().int(), // A09
    mediumMinPoints: z.number().int(), // A09
    smallBillBelow: z.number().int(), // A10
    strongBillFrom: z.number().int(), // A09
    lowConfidenceBelow: z.number().min(0).max(1), // A13
  }),
  advancePercent: z.number().min(0).max(100), // A17
  stageSlaDays: z.record(z.string(), z.number().int().positive()), // A15
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  generationKwhPerKwYear: 1400,
  sizing: { stepKw: 0.5, minKw: 1, optionStepKw: 1, sqmPerKw: 10 },
  netMetering: { surplusRatePerUnit: 3, fallbackTariffPerUnit: 9 },
  score: {
    highMinPoints: 90,
    mediumMinPoints: 50,
    smallBillBelow: 1000,
    strongBillFrom: 2000,
    lowConfidenceBelow: 0.75,
  },
  advancePercent: 20,
  stageSlaDays: {
    ADVANCE_RECEIVED: 3,
    DOCUMENTS: 7,
    INSTALLATION_SCHEDULED: 14,
    INSTALLED: 5,
    NET_METERING_APPLIED: 21,
    NET_METER_INSTALLED: 7,
    SUBSIDY_APPLIED: 30,
  },
};
