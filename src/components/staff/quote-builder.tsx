"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateQuoteAction } from "@/app/staff/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, formatNumber } from "@/domain/format";
import { buildQuoteOptions } from "@/domain/quote";
import type { PriceRule, SubsidyRule } from "@/domain/rules";
import type { Settings } from "@/domain/settings";
import { cn } from "@/lib/utils";

type Segment = "RESIDENTIAL" | "COMMERCIAL";

interface Props {
  leadId: string;
  defaults: { monthlyUnits: number; tariffPerUnit: number; segment: Segment; maxKw: number; sizes: number[]; recommendedKw: number };
  /** Same rules the server will use. The live table runs the same domain engine in the browser. */
  rulesBySegment: Record<Segment, { subsidy: Pick<SubsidyRule, "slabs" | "capAmount" | "schemeName"> | null; price: Pick<PriceRule, "bands" | "name"> | null }>;
  settings: Settings;
  hasPreviousQuote: boolean;
}

export function QuoteBuilder({ leadId, defaults, rulesBySegment, settings, hasPreviousQuote }: Props) {
  const router = useRouter();
  const [units, setUnits] = useState(String(defaults.monthlyUnits));
  const [tariff, setTariff] = useState(String(defaults.tariffPerUnit));
  const [segment, setSegment] = useState<Segment>(defaults.segment);
  const [sizes, setSizes] = useState(defaults.sizes.map(String));
  const [selectedKw, setSelectedKw] = useState(defaults.recommendedKw);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const parsedSizes = useMemo(() => [...new Set(sizes.map(Number).filter((kw) => kw >= 0.5))].sort((a, b) => a - b), [sizes]);
  const rules = rulesBySegment[segment];
  const monthlyUnits = Number(units);
  const tariffPerUnit = Number(tariff);
  const valid = monthlyUnits > 0 && tariffPerUnit > 0 && parsedSizes.length > 0 && rules.price !== null;
  const options = valid
    ? buildQuoteOptions(parsedSizes, { monthlyUnits, tariffPerUnit, maxKw: defaults.maxKw, segment }, { subsidy: rules.subsidy, price: rules.price! }, settings)
    : [];
  const selected = parsedSizes.includes(selectedKw) ? selectedKw : parsedSizes[0];
  const overMax = parsedSizes.some((kw) => kw > defaults.maxKw);

  const rows: [string, (o: (typeof options)[number]) => string][] = [
    ["Cost before subsidy", (o) => formatINR(o.grossCost)],
    ["Subsidy", (o) => formatINR(o.subsidy)],
    ["Net cost", (o) => formatINR(o.netCost)],
    ["Generation a year", (o) => `${formatNumber(o.yearlyGeneration)} units`],
    ["Savings a year", (o) => formatINR(o.yearlySavings)],
    ["Payback", (o) => (o.paybackYears === null ? "-" : `${formatNumber(o.paybackYears)} years`)],
    ["Savings over 25 years", (o) => formatINR(o.savings25Years)],
  ];

  function send() {
    setFailed(false);
    startTransition(async () => {
      const result = await generateQuoteAction(leadId, {
        monthlyUnits,
        tariffPerUnit,
        segment,
        maxKw: defaults.maxKw,
        sizes: parsedSizes,
        selectedKw: selected,
      });
      if (result.ok) router.refresh();
      else setFailed(true);
    });
  }

  return (
    <section aria-labelledby="quote-heading" className="grid gap-5">
      <h2 id="quote-heading" className="text-lg font-medium">Quote builder</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="q-units" label="Average units a month">
          <Input id="q-units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} />
        </Field>
        <Field id="q-tariff" label="Tariff, ₹ per unit">
          <Input id="q-tariff" inputMode="decimal" value={tariff} onChange={(e) => setTariff(e.target.value)} />
        </Field>
        <Field id="q-segment" label="Subsidy segment">
          <select
            id="q-segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value as Segment)}
            className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial (no subsidy)</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {sizes.map((size, i) => (
          <Field key={i} id={`q-kw-${i}`} label={`Option ${i + 1}, kW`}>
            <Input
              id={`q-kw-${i}`}
              inputMode="decimal"
              value={size}
              onChange={(e) => setSizes(sizes.map((s, j) => (j === i ? e.target.value : s)))}
            />
          </Field>
        ))}
      </div>
      <p className={cn("text-sm", overMax ? "text-destructive" : "text-muted-foreground")}>
        {overMax
          ? `An option is above the ${formatNumber(defaults.maxKw)} kW the roof and sanctioned load allow. Check before sending.`
          : `Roof and sanctioned load allow up to ${formatNumber(defaults.maxKw)} kW.`}
      </p>

      {options.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm" data-testid="quote-table">
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 pr-4 text-left font-normal text-muted-foreground">Recommend to customer</th>
                {options.map((o) => (
                  <th key={o.systemKw} scope="col" className="py-2 pl-4 text-right font-medium">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input type="radio" name="selected" className="accent-primary" checked={o.systemKw === selected} onChange={() => setSelectedKw(o.systemKw)} />
                      {formatNumber(o.systemKw)} kW
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-muted-foreground">{label}</th>
                  {options.map((o) => (
                    <td key={o.systemKw} className={cn("tabular py-2 pl-4 text-right", o.systemKw === selected && "font-medium")}>{value(o)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-destructive">Enter units, a tariff and at least one size to see the numbers.</p>
      )}

      <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
        {rules.subsidy ? `Subsidy rule: ${rules.subsidy.schemeName}.` : "No subsidy rule applies to this segment today."} {rules.price ? `Prices: ${rules.price.name}.` : "No price rule is active."}{" "}
        Sending stores a snapshot, so later rule edits never change this quote.
      </p>

      {failed ? <p role="alert" className="text-sm text-destructive">The quote did not save. Check the numbers and try again.</p> : null}

      <Button size="lg" disabled={!valid || pending} onClick={send} className="justify-self-start">
        {pending ? "Sending quote" : hasPreviousQuote ? "Send updated quote on WhatsApp" : "Generate and send on WhatsApp"}
      </Button>
    </section>
  );
}
