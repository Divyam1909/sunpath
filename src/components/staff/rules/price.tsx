"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { savePriceRule } from "@/app/staff/admin/actions";
import { Field } from "@/components/field";
import { Failure, range, SEGMENTS, selectClass, useSave } from "@/components/staff/rules/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/domain/format";
import type { PriceRule } from "@/domain/rules";

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
