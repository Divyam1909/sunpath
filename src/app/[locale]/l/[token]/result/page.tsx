import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SaveAccess } from "@/components/public/save-access";
import { SiteShell } from "@/components/public/site-shell";
import { buttonVariants } from "@/components/ui/button";
import type { ConfirmedBill } from "@/domain/bill";
import { formatINR, formatNumber } from "@/domain/format";
import type { ScoreReason } from "@/domain/score";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { estimateFor } from "@/server/estimate";
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

  const isLow = lead.score === "LOW";
  const reading = await latestBill(lead.id);
  const bill = (reading?.confirmed ?? null) as ConfirmedBill | null;
  const settings = await getSettings();
  const kw = lead.recommendedKw;
  const estimate = !isLow && kw ? await estimateFor(kw, bill, bill?.averageMonthlyUnits ?? 0, settings) : null;
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
