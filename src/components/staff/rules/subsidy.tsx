"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { saveSubsidyRule } from "@/app/staff/admin/actions";
import { Field } from "@/components/field";
import { Failure, range, SEGMENTS, selectClass, useSave } from "@/components/staff/rules/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/domain/format";
import type { SubsidyRule } from "@/domain/rules";

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
