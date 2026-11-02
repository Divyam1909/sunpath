"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { savePriceRule, saveSettingsAction, saveSubsidyRule } from "@/app/staff/admin/actions";
import { Field } from "@/components/field";
import { STAGE_LABELS } from "@/components/staff/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/domain/format";
import type { PriceRule, SubsidyRule } from "@/domain/rules";
import type { Settings } from "@/domain/settings";

function useSave() {
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (action: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) onDone?.();
    });
  };
  return { result, pending, save };
}

const Failure = ({ message }: { message?: string }) =>
  message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null;

const range = (rule: { effectiveFrom: string; effectiveTo: string | null }) => `${rule.effectiveFrom} to ${rule.effectiveTo ?? "open-ended"}`;

const SEGMENTS = (
  <>
    <option value="RESIDENTIAL">Residential</option>
    <option value="COMMERCIAL">Commercial</option>
  </>
);
const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3";

function SubsidyForm({ rule, onDone }: { rule: SubsidyRule | null; onDone: () => void }) {
  const [scheme, setScheme] = useState(rule?.schemeName ?? "");
  const [segment, setSegment] = useState(rule?.segment ?? "RESIDENTIAL");
  const [slabs, setSlabs] = useState((rule?.slabs ?? [{ fromKw: 0, toKw: 2, ratePerKw: 0 }]).map((s) => ({ toKw: String(s.toKw), rate: String(s.ratePerKw) })));
  const [cap, setCap] = useState(String(rule?.capAmount ?? ""));
  const [from, setFrom] = useState(rule?.effectiveFrom ?? "");
  const [to, setTo] = useState(rule?.effectiveTo ?? "");
  const [note, setNote] = useState(rule?.sourceNote ?? "");
  const [verify, setVerify] = useState(rule?.verifyBeforeLaunch ?? true);
  const { result, pending, save } = useSave();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    let fromKw = 0;
    const payload = slabs.map((slab) => {
      const row = { fromKw, toKw: Number(slab.toKw), ratePerKw: Number(slab.rate) };
      fromKw = row.toKw;
      return row;
    });
    save(
      () =>
        saveSubsidyRule({
          id: rule?.id ?? "",
          schemeName: scheme,
          segment,
          slabs: payload,
          capAmount: Number(cap),
          effectiveFrom: from,
          effectiveTo: to || null,
          sourceNote: note,
          verifyBeforeLaunch: verify,
        }),
      onDone,
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="s-scheme" label="Scheme name">
          <Input id="s-scheme" value={scheme} onChange={(e) => setScheme(e.target.value)} />
        </Field>
        <Field id="s-segment" label="Segment">
          <select id="s-segment" value={segment} onChange={(e) => setSegment(e.target.value)} className={selectClass}>{SEGMENTS}</select>
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Slabs</legend>
        {slabs.map((slab, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="tabular w-24 shrink-0 text-sm text-muted-foreground">From {i === 0 ? 0 : slabs[i - 1].toKw || "?"} kW to</span>
            <Input aria-label={`Slab ${i + 1} up to kW`} inputMode="decimal" value={slab.toKw} onChange={(e) => setSlabs(slabs.map((s, j) => (j === i ? { ...s, toKw: e.target.value } : s)))} />
            <span className="shrink-0 text-sm text-muted-foreground">kW at ₹</span>
            <Input aria-label={`Slab ${i + 1} rate per kW`} inputMode="numeric" value={slab.rate} onChange={(e) => setSlabs(slabs.map((s, j) => (j === i ? { ...s, rate: e.target.value } : s)))} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove slab ${i + 1}`} disabled={slabs.length === 1} onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}>
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setSlabs([...slabs, { toKw: "", rate: "" }])}>
          <Plus aria-hidden />
          Add slab
        </Button>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="s-cap" label="Cap, ₹">
          <Input id="s-cap" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
        <Field id="s-from" label="Effective from">
          <Input id="s-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="s-to" label="Effective to (blank if open)">
          <Input id="s-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Field id="s-note" label="Source note">
        <Textarea id="s-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-primary" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
        Needs checking against the official scheme before launch
      </label>
      <Failure message={result?.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>Save subsidy rule</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function SubsidyRules({ rules, today }: { rules: SubsidyRule[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {rules.map((rule) =>
        editing === rule.id ? (
          <SubsidyForm key={rule.id} rule={rule} onDone={() => setEditing(null)} />
        ) : (
          <div key={rule.id} data-testid="subsidy-rule" className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div className="text-sm">
              <p className="font-medium">
                {rule.schemeName}
                {rule.effectiveFrom <= today && (!rule.effectiveTo || today <= rule.effectiveTo) ? <span className="ml-2 font-normal text-primary">Active today</span> : null}
              </p>
              <p className="tabular mt-0.5 text-muted-foreground">{rule.segment.toLowerCase()}, {range(rule)}</p>
              <p className="tabular mt-0.5">
                {rule.slabs.map((s) => `${s.fromKw} to ${s.toKw} kW at ${formatINR(s.ratePerKw)}`).join(", ")}; cap {formatINR(rule.capAmount)}
              </p>
              {rule.sourceNote ? <p className="mt-0.5 max-w-prose text-muted-foreground">{rule.sourceNote}</p> : null}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(rule.id)}>Edit</Button>
          </div>
        ),
      )}
      {editing === "new" ? (
        <SubsidyForm rule={null} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="outline" className="justify-self-start" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          Add subsidy rule
        </Button>
      )}
    </div>
  );
}

function PriceForm({ rule, onDone }: { rule: PriceRule | null; onDone: () => void }) {
  const [name, setName] = useState(rule?.name ?? "");
  const [segment, setSegment] = useState(rule?.segment ?? "RESIDENTIAL");
  const [bands, setBands] = useState((rule?.bands ?? [{ upToKw: null, pricePerKw: 0 }]).map((b) => ({ upTo: b.upToKw === null ? "" : String(b.upToKw), price: String(b.pricePerKw) })));
  const [from, setFrom] = useState(rule?.effectiveFrom ?? "");
  const [to, setTo] = useState(rule?.effectiveTo ?? "");
  const [note, setNote] = useState(rule?.note ?? "");
  const { result, pending, save } = useSave();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    save(
      () =>
        savePriceRule({
          id: rule?.id ?? "",
          name,
          segment,
          bands: bands.map((b) => ({ upToKw: b.upTo === "" ? null : Number(b.upTo), pricePerKw: Number(b.price) })),
          effectiveFrom: from,
          effectiveTo: to || null,
          note,
        }),
      onDone,
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-name" label="Rate card name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="p-segment" label="Segment">
          <select id="p-segment" value={segment} onChange={(e) => setSegment(e.target.value)} className={selectClass}>{SEGMENTS}</select>
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Price bands (leave the size blank on the last band)</legend>
        {bands.map((band, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">Up to</span>
            <Input aria-label={`Band ${i + 1} up to kW`} inputMode="decimal" value={band.upTo} onChange={(e) => setBands(bands.map((b, j) => (j === i ? { ...b, upTo: e.target.value } : b)))} />
            <span className="shrink-0 text-sm text-muted-foreground">kW at ₹</span>
            <Input aria-label={`Band ${i + 1} price per kW`} inputMode="numeric" value={band.price} onChange={(e) => setBands(bands.map((b, j) => (j === i ? { ...b, price: e.target.value } : b)))} />
            <span className="shrink-0 text-sm text-muted-foreground">per kW</span>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove band ${i + 1}`} disabled={bands.length === 1} onClick={() => setBands(bands.filter((_, j) => j !== i))}>
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setBands([...bands, { upTo: "", price: "" }])}>
          <Plus aria-hidden />
          Add band
        </Button>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-from" label="Effective from">
          <Input id="p-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="p-to" label="Effective to (blank if open)">
          <Input id="p-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Field id="p-note" label="Note">
        <Textarea id="p-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Failure message={result?.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>Save price rule</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function PriceRules({ rules, today }: { rules: PriceRule[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {rules.map((rule) =>
        editing === rule.id ? (
          <PriceForm key={rule.id} rule={rule} onDone={() => setEditing(null)} />
        ) : (
          <div key={rule.id} className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div className="text-sm">
              <p className="font-medium">
                {rule.name}
                {rule.effectiveFrom <= today && (!rule.effectiveTo || today <= rule.effectiveTo) ? <span className="ml-2 font-normal text-primary">Active today</span> : null}
              </p>
              <p className="tabular mt-0.5 text-muted-foreground">{rule.segment.toLowerCase()}, {range(rule)}</p>
              <p className="tabular mt-0.5">{rule.bands.map((b) => `${b.upToKw === null ? "above" : `up to ${b.upToKw} kW`}: ${formatINR(b.pricePerKw)}`).join(", ")}</p>
              {rule.note ? <p className="mt-0.5 max-w-prose text-muted-foreground">{rule.note}</p> : null}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(rule.id)}>Edit</Button>
          </div>
        ),
      )}
      {editing === "new" ? (
        <PriceForm rule={null} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="outline" className="justify-self-start" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          Add price rule
        </Button>
      )}
    </div>
  );
}

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
        {Object.entries(draft.stageSlaDays).map(([stage, days]) =>
          number(`sla-${stage}`, STAGE_LABELS[stage], days, (n) => setDraft({ ...draft, stageSlaDays: { ...draft.stageSlaDays, [stage]: n } })),
        )}
      </fieldset>

      {result?.ok ? <p role="status" className="text-sm text-primary">Settings saved.</p> : <Failure message={result?.error} />}
      <Button type="submit" disabled={pending} className="justify-self-start">Save settings</Button>
    </form>
  );
}
