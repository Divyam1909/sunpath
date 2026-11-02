"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { saveTariffRule } from "@/app/staff/admin/actions";
import { Field } from "@/components/field";
import { Failure, range, useSave } from "@/components/staff/rules/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TariffRule } from "@/domain/tariff";

function TariffForm({ rule, onDone }: { rule: TariffRule | null; onDone: () => void }) {
  const [name, setName] = useState(rule?.name ?? "");
  const [slabs, setSlabs] = useState((rule?.slabs ?? [{ upToUnits: null, energyPerUnit: 0, facPerUnit: 0 }]).map((s) => ({ upTo: s.upToUnits === null ? "" : String(s.upToUnits), energy: String(s.energyPerUnit), fac: String(s.facPerUnit) })));
  const [single, setSingle] = useState(String(rule?.fixedSinglePhase ?? ""));
  const [three, setThree] = useState(String(rule?.fixedThreePhase ?? ""));
  const [wheeling, setWheeling] = useState(String(rule?.wheelingPerUnit ?? ""));
  const [duty, setDuty] = useState(String(rule?.dutyPercent ?? "16"));
  const [from, setFrom] = useState(rule?.effectiveFrom ?? "");
  const [to, setTo] = useState(rule?.effectiveTo ?? "");
  const [note, setNote] = useState(rule?.sourceNote ?? "");
  const { result, pending, save } = useSave();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    save(
      () =>
        saveTariffRule({
          id: rule?.id ?? "",
          name,
          segment: rule?.segment ?? "RESIDENTIAL",
          slabs: slabs.map((s) => ({ upToUnits: s.upTo === "" ? null : Number(s.upTo), energyPerUnit: Number(s.energy), facPerUnit: Number(s.fac) })),
          fixedSinglePhase: Number(single),
          fixedThreePhase: Number(three),
          wheelingPerUnit: Number(wheeling),
          dutyPercent: Number(duty),
          effectiveFrom: from,
          effectiveTo: to || null,
          sourceNote: note,
          verifyBeforeLaunch: rule?.verifyBeforeLaunch ?? false,
        }),
      onDone,
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border p-5">
      <Field id="t-name" label="Tariff name">
        <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Slabs (leave the units blank on the last slab)</legend>
        {slabs.map((slab, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">Up to</span>
            <Input aria-label={`Slab ${i + 1} up to units`} inputMode="numeric" value={slab.upTo} onChange={(e) => setSlabs(slabs.map((s, j) => (j === i ? { ...s, upTo: e.target.value } : s)))} />
            <span className="shrink-0 text-sm text-muted-foreground">units, ₹</span>
            <Input aria-label={`Slab ${i + 1} energy rate`} inputMode="decimal" value={slab.energy} onChange={(e) => setSlabs(slabs.map((s, j) => (j === i ? { ...s, energy: e.target.value } : s)))} />
            <span className="shrink-0 text-sm text-muted-foreground">+ FAC ₹</span>
            <Input aria-label={`Slab ${i + 1} FAC`} inputMode="decimal" value={slab.fac} onChange={(e) => setSlabs(slabs.map((s, j) => (j === i ? { ...s, fac: e.target.value } : s)))} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove slab ${i + 1}`} disabled={slabs.length === 1} onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}>
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setSlabs([...slabs, { upTo: "", energy: "", fac: "" }])}>
          <Plus aria-hidden />
          Add slab
        </Button>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field id="t-single" label="Fixed, 1-phase, ₹">
          <Input id="t-single" inputMode="decimal" value={single} onChange={(e) => setSingle(e.target.value)} />
        </Field>
        <Field id="t-three" label="Fixed, 3-phase, ₹">
          <Input id="t-three" inputMode="decimal" value={three} onChange={(e) => setThree(e.target.value)} />
        </Field>
        <Field id="t-wheeling" label="Wheeling, ₹ per unit">
          <Input id="t-wheeling" inputMode="decimal" value={wheeling} onChange={(e) => setWheeling(e.target.value)} />
        </Field>
        <Field id="t-duty" label="Duty, %">
          <Input id="t-duty" inputMode="decimal" value={duty} onChange={(e) => setDuty(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="t-from" label="Effective from">
          <Input id="t-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="t-to" label="Effective to (blank if open)">
          <Input id="t-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Field id="t-note" label="Source note">
        <Textarea id="t-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Failure message={result?.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>Save tariff</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function TariffRules({ rules, today }: { rules: TariffRule[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {rules.map((rule) =>
        editing === rule.id ? (
          <TariffForm key={rule.id} rule={rule} onDone={() => setEditing(null)} />
        ) : (
          <div key={rule.id} data-testid="tariff-rule" className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div className="text-sm">
              <p className="font-medium">
                {rule.name}
                {rule.effectiveFrom <= today && (!rule.effectiveTo || today <= rule.effectiveTo) ? <span className="ml-2 font-normal text-primary">Active today</span> : null}
              </p>
              <p className="tabular mt-0.5 text-muted-foreground">{range(rule)}</p>
              <p className="tabular mt-0.5">
                {rule.slabs.map((s) => `${s.upToUnits === null ? "above" : `to ${s.upToUnits}`}: ₹${s.energyPerUnit}`).join(", ")}; wheeling ₹{rule.wheelingPerUnit}; fixed ₹{rule.fixedSinglePhase} or ₹{rule.fixedThreePhase}; duty {rule.dutyPercent}%
              </p>
              {rule.sourceNote ? <p className="mt-0.5 max-w-prose text-muted-foreground">{rule.sourceNote}</p> : null}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(rule.id)}>Edit</Button>
          </div>
        ),
      )}
      {editing === "new" ? (
        <TariffForm rule={null} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="outline" className="justify-self-start" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          Add tariff
        </Button>
      )}
    </div>
  );
}
