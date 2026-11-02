import Link from "next/link";
import { createTranslator } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BillImage } from "@/components/public/bill-image";
import { blockerValues } from "@/components/public/blocker-list";
import { LEAD_STAGE_LABELS, ScoreBadge } from "@/components/staff/labels";
import { BookSurveyForm, EraseLead, LogCallForm, RecordSurveyForm } from "@/components/staff/lead-actions";
import { QuoteBuilder } from "@/components/staff/quote-builder";
import { RoofOutline } from "@/components/staff/roof-outline";
import { StaffBillCheck } from "@/components/staff/staff-bill-check";
import { buttonVariants } from "@/components/ui/button";
import { billForThisMonth, maskConsumerNumber, segmentFromTariff, type ConfirmedBill } from "@/domain/bill";
import type { Blocker } from "@/domain/blockers";
import type { LatLng } from "@/domain/geo";
import { formatINR, formatNumber, istDate } from "@/domain/format";
import { isVidarbhaPincode } from "@/domain/pincode";
import { optionSizes, resolveTariff } from "@/domain/quote";
import type { ScoreReason } from "@/domain/score";
import { sizeSystem, usableRoofSqm } from "@/domain/sizing";
import { calculateBill } from "@/domain/tariff";
import { checkSeason } from "@/domain/usage";
import { SQM_PER_SQFT } from "@/lib/validation";
import { db } from "@/server/db";
import { loadRules, phaseOf, rulesFor, tariffFor } from "@/server/estimate";
import { requireStaff } from "@/server/guards";
import { estimateUnits, latestBill, prefillBill, type StoredAiRead } from "@/server/leads";
import { readQuote } from "@/server/quotes";
import { getSettings } from "@/server/settings";
import { fileStore } from "@/server/storage";

const ROOF_LABELS: Record<string, string> = { RCC_FLAT: "Concrete (flat)", METAL_SHEET: "Metal sheet", TILED: "Tiles", OTHER: "Other" };

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function LeadDetailPage({ params }: PageProps<"/staff/leads/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { quotes: { orderBy: { createdAt: "desc" }, take: 1 }, project: true },
  });
  if (!lead) notFound();

  const [reading, settings, rules] = await Promise.all([latestBill(lead.id), getSettings(), loadRules()]);
  const ai = (reading?.ai ?? null) as StoredAiRead | null;
  const confirmed = (reading?.confirmed ?? null) as ConfirmedBill | null;
  const billValues = confirmed ?? prefillBill(ai, lead, settings);
  const imageUrl = reading?.storageKey ? await fileStore.signedUrl(reading.storageKey, reading.mimeType) : null;
  const messages = (await import("../../../../../messages/en.json")).default;
  const reasons = (lead.scoreReasons ?? []) as unknown as ScoreReason[];
  const quote = lead.quotes[0] ?? null;
  const storedQuote = quote ? readQuote(quote) : null;

  const roofSqm = lead.surveyRoofSqm ?? lead.roofAreaSqm;
  const usableSqm = usableRoofSqm(roofSqm, lead.surveyShading ?? "NONE");
  const monthlyUnits = confirmed?.averageMonthlyUnits ?? estimateUnits(lead.monthlyBill, settings);
  const sizing = sizeSystem({ monthlyUnits, roofAreaSqm: usableSqm, sanctionedLoadKw: billValues.sanctionedLoadKw }, settings);
  const recommendedKw = sizing.recommendedKw ?? settings.sizing.minKw;
  const today = istDate();
  const segmentRules = (segment: string) => {
    const { subsidy, price } = rulesFor(rules, today, segment);
    return { subsidy, price };
  };

  const blockers = (lead.blockers ?? []) as unknown as Blocker[];
  const tBlocker = createTranslator({ locale: "en", messages, namespace: "blockers" }) as unknown as (key: string, values: object) => string;
  const season = confirmed ? checkSeason(confirmed.unitsLatestMonth, confirmed.averageMonthlyUnits, settings.seasonalMisleadingAt) : null;
  const sizedOnBillAlone = confirmed ? sizeSystem({ monthlyUnits: confirmed.unitsLatestMonth, roofAreaSqm: usableSqm, sanctionedLoadKw: billValues.sanctionedLoadKw }, settings).recommendedKw : null;
  const tariff = confirmed ? tariffFor(rules, today, segmentFromTariff(confirmed.tariffCategory)) : null;
  const tariffBill = confirmed && tariff ? Math.round(calculateBill(confirmed.unitsLatestMonth, tariff, { phase: phaseOf(confirmed) }).total) : null;
  const outline = (lead.roofOutline ?? null) as unknown as LatLng[] | null;

  const canCall = lead.stage === "SCORED" && lead.nextAction === "QUALIFICATION_CALL";
  const canBook = lead.stage === "SCORED" && lead.nextAction === "SURVEY_VISIT";
  const canSurvey = lead.stage === "SURVEY_BOOKED";
  const canQuote = (lead.stage === "SURVEYED" || lead.stage === "QUOTED") && !lead.project;

  return (
    <div className="grid gap-8">
      <div>
        <Link href="/staff/leads" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Leads</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight">{lead.name}</h1>
          <ScoreBadge score={lead.score} />
          <span className="text-sm text-muted-foreground">{lead.code}, {LEAD_STAGE_LABELS[lead.stage]}</span>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-8">
          <section className="grid gap-3">
            <h2 className="text-lg font-medium">Why this score</h2>
            <ul className="grid gap-1.5 text-sm">
              {reasons.map((reason) => (
                <li key={reason.code} className="flex justify-between gap-4">
                  <span>{reason.text}</span>
                  <span className="tabular text-muted-foreground">+{reason.points}</span>
                </li>
              ))}
            </ul>
            <p className="tabular border-t pt-2 text-sm text-muted-foreground">
              {lead.scorePoints} points. {lead.nextAction === "SURVEY_VISIT" ? "Next: survey visit." : "Next: short qualification call. A low score never rejects a lead."}
            </p>
          </section>

          {blockers.length > 0 ? (
            <section data-testid="staff-blockers" className="grid gap-3 rounded-xl border border-destructive/40 p-5">
              <h2 className="text-lg font-medium">Fix before the survey</h2>
              <ul className="grid gap-3 text-sm">
                {blockers.map((blocker) => (
                  <li key={blocker.code}>
                    <p className="font-medium">{tBlocker(`${blocker.code}.title`, blockerValues(blocker))}</p>
                    <p className="text-muted-foreground">{tBlocker(`${blocker.code}.fix`, blockerValues(blocker))}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {season?.misleading ? (
            <section data-testid="staff-season" className="grid gap-1 rounded-xl bg-muted p-5 text-sm">
              <h2 className="text-base font-medium">Unusual month</h2>
              <p className="tabular leading-relaxed">
                {formatNumber(confirmed!.unitsLatestMonth)} units is {Math.abs(Math.round((season.ratio - 1) * 100))}% {season.direction === "ABOVE" ? "above" : "below"} this home&apos;s {formatNumber(confirmed!.averageMonthlyUnits)}-unit average. Sized on the year: {formatNumber(lead.recommendedKw ?? 0)} kW. On this bill alone it would be {sizedOnBillAlone === null ? "none" : `${formatNumber(sizedOnBillAlone)} kW`}.
              </p>
            </section>
          ) : null}

          <section className="grid gap-3">
            <h2 className="text-lg font-medium">Customer</h2>
            <Facts
              items={[
                ["Phone", lead.phone],
                ["Property", lead.ownership === "OWNER" ? "Owner" : "Tenant"],
                ["Roof", `${ROOF_LABELS[lead.roofType]}, ${formatNumber(Math.round(lead.roofAreaSqm / SQM_PER_SQFT))} sq ft`],
                ["Pincode", `${lead.pincode}${isVidarbhaPincode(lead.pincode) ? "" : " (outside Vidarbha)"}`],
                ["Bill", formatINR(lead.monthlyBill)],
                ["Consumer no.", maskConsumerNumber(billValues.consumerNumber)],
                ["Recommended", lead.recommendedKw ? `${formatNumber(lead.recommendedKw)} kW` : "None yet"],
                ...(confirmed?.consumerName ? ([["Name on bill", confirmed.consumerName]] as [string, ReactNode][]) : []),
                ...(tariffBill ? ([["At today's tariff", `${formatINR(tariffBill)} for ${formatNumber(confirmed!.unitsLatestMonth)} units`]] as [string, ReactNode][]) : []),
                ["Consent", `${lead.consentVersion}, ${istDate(lead.consentAt)}`],
              ]}
            />
          </section>

          {outline ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-medium">Roof marked by the customer</h2>
              <RoofOutline outline={outline} />
              <p className="tabular text-sm text-muted-foreground">{formatNumber(Math.round(lead.roofAreaSqm / SQM_PER_SQFT))} sq ft measured on the map.</p>
            </section>
          ) : null}

          {imageUrl && reading?.mimeType !== "application/pdf" ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-medium">Bill</h2>
              <BillImage src={imageUrl} alt={`Electricity bill for ${lead.code}`} zoomInLabel="Zoom in" zoomOutLabel="Zoom out" />
            </section>
          ) : imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-4">Open bill PDF</a>
          ) : null}
        </div>

        <div className="grid content-start gap-10">
          {canCall ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-medium">Short qualification call</h2>
              {lead.callLoggedAt ? <p className="text-sm text-muted-foreground">Last call {istDate(lead.callLoggedAt)}: {lead.callNotes}</p> : null}
              <LogCallForm leadId={lead.id} />
            </section>
          ) : null}

          {canBook ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-medium">Book the survey</h2>
              <BookSurveyForm leadId={lead.id} />
            </section>
          ) : null}

          {canSurvey ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-medium">Record the survey</h2>
              <p className="text-sm text-muted-foreground">Booked for {lead.surveyBookedFor ? istDate(lead.surveyBookedFor) : "a date to confirm"}.</p>
              <RecordSurveyForm leadId={lead.id} roofSqFt={Math.round(lead.roofAreaSqm / SQM_PER_SQFT)} />
            </section>
          ) : null}

          {lead.surveyedAt ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-medium">Survey</h2>
              <Facts
                items={[
                  ["Done on", istDate(lead.surveyedAt)],
                  ["Measured roof", `${formatNumber(Math.round(roofSqm / SQM_PER_SQFT))} sq ft`],
                  ["Shading", (lead.surveyShading ?? "NONE").toLowerCase()],
                  ["Usable roof", `${formatNumber(usableSqm)} m², up to ${formatNumber(sizing.roofMaxKw)} kW`],
                  ["Notes", lead.surveyNotes ?? "None"],
                ]}
              />
            </section>
          ) : null}

          {quote && storedQuote ? (
            <section className="grid gap-3 rounded-xl bg-teal-tint p-5">
              <h2 className="text-lg font-medium">Latest quote</h2>
              <p className="tabular text-sm">
                {formatNumber(quote.selectedKw)} kW, {formatINR(storedQuote.options.find((o) => o.systemKw === quote.selectedKw)?.netCost ?? 0)} after subsidy.
                Sent {quote.sentAt ? istDate(quote.sentAt) : "not yet"}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/${lead.locale}/q/${quote.token}`} className={buttonVariants({ variant: "outline" })} target="_blank">View customer page</Link>
                <a href={`/api/quotes/${quote.token}/pdf`} download data-testid="quote-pdf" className={buttonVariants({ variant: "outline" })}>Download PDF</a>
                {lead.project ? <Link href={`/staff/projects/${lead.project.id}`} className={buttonVariants({ variant: "outline" })}>Open project</Link> : null}
              </div>
            </section>
          ) : null}

          {canQuote ? (
            <QuoteBuilder
              key={quote?.id ?? "new"}
              leadId={lead.id}
              hasPreviousQuote={Boolean(quote)}
              settings={settings}
              defaults={{
                monthlyUnits,
                tariffPerUnit: resolveTariff(
                  { ratePerUnit: billValues.ratePerUnit, billAmount: billForThisMonth(billValues), units: billValues.unitsLatestMonth },
                  settings,
                ),
                segment: segmentFromTariff(billValues.tariffCategory) as "RESIDENTIAL" | "COMMERCIAL",
                maxKw: sizing.maxKw,
                sizes: optionSizes(recommendedKw, sizing.maxKw, settings),
                recommendedKw,
              }}
              rulesBySegment={{ RESIDENTIAL: segmentRules("RESIDENTIAL"), COMMERCIAL: segmentRules("COMMERCIAL") }}
            />
          ) : !lead.project && lead.stage !== "CLOSED" ? (
            <p className="rounded-xl bg-muted px-5 py-4 text-sm text-muted-foreground">The quote builder opens once the survey is recorded.</p>
          ) : null}

          <details className="group" open={!confirmed}>
            <summary className="cursor-pointer text-lg font-medium">Bill values</summary>
            <p className="mt-3 mb-3 text-sm text-muted-foreground">
              {reading?.reader ? `Read by ${reading.reader}${reading.model ? ` (${reading.model})` : ""}.` : "Not read yet."}
              {reading?.editedFields.length ? ` Corrected by a person: ${reading.editedFields.join(", ")}.` : ""}
              {reading?.confirmedAt ? ` Confirmed ${istDate(reading.confirmedAt)}.` : " Not confirmed yet."}
            </p>
            <StaffBillCheck leadId={lead.id} initial={billValues} lowConfidence={ai && !confirmed ? ai.lowConfidence : []} messages={messages} />
          </details>

          {user.role === "ADMIN" ? <EraseLead leadId={lead.id} /> : null}
        </div>
      </div>
    </div>
  );
}
