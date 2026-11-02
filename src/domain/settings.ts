import { z } from "zod";

// Every value here is editable in admin. IDs refer to docs/ASSUMPTIONS.md.
export const settingsSchema = z.object({
  generationKwhPerKwYear: z.number().positive(), // Brief: 1,400 units per kW per year
  generationShare: z.array(z.number().min(0)).length(12), // A35: January first, adds up to 1
  seasonalUseFactor: z.array(z.number().positive()).length(12), // A36: January first, averages 1
  seasonalMisleadingAt: z.number().positive(), // A36
  poorPaybackYears: z.number().positive(), // A39
  arrearsBlockAbove: z.number().min(0), // A41
  promise: z.object({ onTrackRatio: z.number().min(0), watchRatio: z.number().min(0) }), // A43
  forecastMinSamples: z.number().int().positive(), // A44
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
  // PVGIS 5.3 monthly output for a south-facing roof in Nagpur (ERA5, 2005 to 2023), as shares of the year.
  generationShare: [0.0979, 0.0935, 0.1027, 0.0969, 0.0925, 0.0696, 0.0501, 0.0544, 0.0676, 0.0895, 0.0903, 0.095],
  seasonalUseFactor: [0.82, 0.9, 1.06, 1.25, 1.33, 1.12, 1, 0.96, 1, 0.92, 0.84, 0.8],
  seasonalMisleadingAt: 0.2,
  poorPaybackYears: 12,
  arrearsBlockAbove: 500,
  promise: { onTrackRatio: 0.9, watchRatio: 0.75 },
  forecastMinSamples: 3,
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
