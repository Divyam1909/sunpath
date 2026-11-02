import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BillBeforeAfter } from "@/components/public/bill-before-after";
import { BlockerList } from "@/components/public/blocker-list";
import { SaveAccess } from "@/components/public/save-access";
import { SiteShell } from "@/components/public/site-shell";
import { buttonVariants } from "@/components/ui/button";
import type { ConfirmedBill } from "@/domain/bill";
import type { Blocker } from "@/domain/blockers";
import { formatINR, formatNumber } from "@/domain/format";
import { checkWorth } from "@/domain/projection";
import type { ScoreReason } from "@/domain/score";
import { checkSeason } from "@/domain/usage";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { billViewFor, estimateFor } from "@/server/estimate";
import { latestBill } from "@/server/leads";
import { getSettings } from "@/server/settings";

export default async function ResultPage({ params }: PageProps<"/[locale]/l/[token]/result">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const lead = await db.lead.findUnique({ where: { accessToken: token } });
  if (!lead) notFound();
  const t = await getTranslations();

  if (lead.stage === "NEW") {
    return (
      <SiteShell>
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("result.pending")}</h1>
        <Link href={`/l/${token}/upload`} className={`${buttonVariants({ size: "lg" })} mt-6 w-full`}>
          {t("result.addBill")}
        </Link>
      </SiteShell>
    );
  }

  // No size fits, for example a 0.5 kW sanctioned load, so a person takes it from here whatever the score.
  const isLow = lead.score === "LOW" || !lead.recommendedKw;
  const reading = await latestBill(lead.id);
  const bill = (reading?.confirmed ?? null) as ConfirmedBill | null;
  const settings = await getSettings();
  const kw = lead.recommendedKw;
  const estimate = !isLow && kw ? await estimateFor(kw, bill, bill?.averageMonthlyUnits ?? 0, settings) : null;
  const view = kw && bill ? await billViewFor(kw, bill, bill.averageMonthlyUnits, settings) : null;
  const cost = kw && view ? await estimateFor(kw, bill, bill?.averageMonthlyUnits ?? 0, settings) : null;
  const worth = view && cost ? checkWorth(cost.netCost, view.projection.yearlySaving, settings.poorPaybackYears) : null;
  const season = bill ? checkSeason(bill.unitsLatestMonth, bill.averageMonthlyUnits, settings.seasonalMisleadingAt) : null;
  const blockers = (lead.blockers ?? []) as unknown as Blocker[];
  const reasons = ((lead.scoreReasons ?? []) as unknown as ScoreReason[]).filter((r) => r.tone !== "note" || !isLow);
  const lowLead = lead.ownership === "TENANT" ? "lowTenantLead" : lead.monthlyBill < settings.score.smallBillBelow ? "lowSmallLead" : "lowOtherLead";

  const title = isLow
    ? t("result.lowTitle")
    : lead.score === "HIGH"
      ? t("result.highTitle", { kw: formatNumber(kw ?? 0) })
      : t("result.mediumTitle", { kw: formatNumber(kw ?? 0) });

  return (
    <SiteShell>
      <h1 data-testid="result-title" className="text-[2rem] leading-[1.15] font-medium tracking-tight">
        {title}
      </h1>

      {estimate ? (
        <div className="mt-6 grid gap-1 text-[1.0625rem]">
          <p>{t("result.estimateCost", { amount: formatINR(estimate.netCost) })}</p>
          {estimate.paybackYears ? <p>{t("result.estimatePayback", { years: formatNumber(estimate.paybackYears) })}</p> : null}
          <p className="mt-1 text-sm text-muted-foreground">{t("result.estimateNote")}</p>
        </div>
      ) : isLow ? (
        <p className="mt-3 leading-relaxed text-muted-foreground">{t(`result.${lowLead}`)}</p>
      ) : null}

      {worth?.poor ? (
        <section data-testid="poor-worth" className="mt-6 rounded-xl border p-5">
          <h2 className="font-medium">{t("year.poorTitle")}</h2>
          <p className="mt-1 leading-relaxed">{t("year.poorLead", { years: formatNumber(worth.paybackYears ?? 25) })}</p>
        </section>
      ) : null}

      {season?.misleading ? (
        <p data-testid="season-note" className="mt-6 rounded-xl bg-muted p-4 leading-relaxed">
          {t(season.direction === "ABOVE" ? "year.seasonAbove" : "year.seasonBelow", { percent: Math.abs(Math.round((season.ratio - 1) * 100)) })}
        </p>
      ) : null}

      <BlockerList blockers={blockers} />

      {!isLow ? (
        <ul className="mt-7 grid gap-2 border-t pt-6 text-[0.9375rem]">
          {reasons
            .filter((r) => r.tone === "good")
            .map((reason) => (
              <li key={reason.code} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {t(`reasons.${reason.code}` as "reasons.owner", reason.params as never)}
              </li>
            ))}
        </ul>
      ) : null}

      <section className="mt-8 rounded-xl bg-teal-tint p-5">
        <h2 className="font-medium">{t("result.nextTitle")}</h2>
        <p className="mt-1.5 leading-relaxed">{isLow ? t("result.nextCall") : t("result.nextSurvey")}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("result.sentTo", { phone: lead.phone })}</p>
      </section>

      {view ? (
        <BillBeforeAfter
          projection={view.projection}
          estimated={view.year.months.filter((m) => m.estimated).map((m) => m.index)}
          basis={view.year.basis}
          tariffName={view.tariff.name}
          tariffFrom={view.tariff.effectiveFrom}
          locale={locale}
        />
      ) : null}

      {lead.userId ? null : (
        <section className="mt-10 border-t pt-6">
          <h2 className="font-medium">{t("result.saveTitle")}</h2>
          <p className="mt-1 mb-4 text-sm leading-relaxed text-muted-foreground">{t("result.saveLead")}</p>
          <SaveAccess token={token} phone={lead.phone} />
        </section>
      )}
    </SiteShell>
  );
}
