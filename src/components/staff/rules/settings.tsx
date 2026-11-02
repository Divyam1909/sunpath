"use client";

import { useState } from "react";
import { saveSettingsAction } from "@/app/staff/admin/actions";
import { Field } from "@/components/field";
import { STAGE_LABELS } from "@/components/staff/labels";
import { Failure, useSave } from "@/components/staff/rules/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FINAL_STAGE, STAGES } from "@/domain/project";
import type { Settings } from "@/domain/settings";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [draft, setDraft] = useState(settings);
  const { result, pending, save } = useSave();

  const number = (id: string, label: string, value: number, onChange: (n: number) => void, hint?: string) => (
    <Field id={id} label={label} hint={hint}>
      <Input id={id} inputMode="decimal" value={Number.isNaN(value) ? "" : value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
  const section = <K extends "sizing" | "netMetering" | "score">(key: K, patch: Partial<Settings[K]>) =>
    setDraft({ ...draft, [key]: { ...draft[key], ...patch } });

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save(() => saveSettingsAction(draft));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {number("generation", "Generation, units per kW a year", draft.generationKwhPerKwYear, (n) => setDraft({ ...draft, generationKwhPerKwYear: n }), "Brief: 1,400")}
        {number("sqm", "Roof needed, m² per kW", draft.sizing.sqmPerKw, (n) => section("sizing", { sqmPerKw: n }))}
        {number("advance", "Advance, % of net cost", draft.advancePercent, (n) => setDraft({ ...draft, advancePercent: n }))}
        {number("step", "Size step, kW", draft.sizing.stepKw, (n) => section("sizing", { stepKw: n }))}
        {number("min", "Smallest system, kW", draft.sizing.minKw, (n) => section("sizing", { minKw: n }))}
        {number("optstep", "Gap between options, kW", draft.sizing.optionStepKw, (n) => section("sizing", { optionStepKw: n }))}
        {number("surplus", "Surplus unit credit, ₹", draft.netMetering.surplusRatePerUnit, (n) => section("netMetering", { surplusRatePerUnit: n }))}
        {number("fallback", "Fallback tariff, ₹ per unit", draft.netMetering.fallbackTariffPerUnit, (n) => section("netMetering", { fallbackTariffPerUnit: n }))}
        {number("conf", "Check bill values below (0 to 1)", draft.score.lowConfidenceBelow, (n) => section("score", { lowConfidenceBelow: n }))}
        {number("season", "Flag a month this far from average (0 to 1)", draft.seasonalMisleadingAt, (n) => setDraft({ ...draft, seasonalMisleadingAt: n }))}
        {number("poor", "Say solar may not pay above, years", draft.poorPaybackYears, (n) => setDraft({ ...draft, poorPaybackYears: n }))}
        {number("arrears", "Flag arrears above, ₹", draft.arrearsBlockAbove, (n) => setDraft({ ...draft, arrearsBlockAbove: n }))}
        {number("ontrack", "Savings on track from (0 to 1)", draft.promise.onTrackRatio, (n) => setDraft({ ...draft, promise: { ...draft.promise, onTrackRatio: n } }))}
        {number("watch", "Savings watch from (0 to 1)", draft.promise.watchRatio, (n) => setDraft({ ...draft, promise: { ...draft.promise, watchRatio: n } }))}
        {number("forecast", "Finished projects a stage needs for a forecast", draft.forecastMinSamples, (n) => setDraft({ ...draft, forecastMinSamples: n }))}
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-medium">Score thresholds</legend>
        {number("high", "High from, points", draft.score.highMinPoints, (n) => section("score", { highMinPoints: n }))}
        {number("medium", "Medium from, points", draft.score.mediumMinPoints, (n) => section("score", { mediumMinPoints: n }))}
        {number("small", "Small bill under, ₹", draft.score.smallBillBelow, (n) => section("score", { smallBillBelow: n }))}
        {number("strong", "Strong bill from, ₹", draft.score.strongBillFrom, (n) => section("score", { strongBillFrom: n }))}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-medium">Days allowed in each stage before a project counts as stuck</legend>
        {STAGES.filter((stage) => stage !== FINAL_STAGE).map((stage) =>
          number(`sla-${stage}`, STAGE_LABELS[stage], draft.stageSlaDays[stage], (n) => setDraft({ ...draft, stageSlaDays: { ...draft.stageSlaDays, [stage]: n } })),
        )}
      </fieldset>

      {result?.ok ? <p role="status" className="text-sm text-primary">Settings saved.</p> : <Failure message={result?.error} />}
      <Button type="submit" disabled={pending} className="justify-self-start">Save settings</Button>
    </form>
  );
}
