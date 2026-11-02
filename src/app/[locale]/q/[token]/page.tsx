import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/public/site-shell";
import { QuoteStory } from "@/components/quote/quote-story";
import { formatDate } from "@/domain/format";
import { db } from "@/server/db";
import { appUrl } from "@/server/projects";
import { readQuote } from "@/server/quotes";

export const metadata: Metadata = { robots: { index: false } };

export default async function QuotePage({ params }: PageProps<"/[locale]/q/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const quote = await db.quote.findUnique({
    where: { token },
    select: {
      inputs: true,
      options: true,
      snapshot: true,
      selectedKw: true,
      quoteDate: true,
      // First name only: this link carries no address or consumer number.
      lead: { select: { name: true, recommendedKw: true } },
      project: { select: { token: true, systemKw: true } },
    },
  });
  if (!quote) notFound();
  const t = await getTranslations("quote");
  const brand = await getTranslations("brand");
  const { inputs, options, snapshot } = readQuote(quote);
  const kw = quote.project?.systemKw ?? quote.selectedKw;
  return (
    <SiteShell>
      <h1 className="text-xl font-medium">{t("title")}</h1>
      <div className="mt-1">
        <QuoteStory
          token={token}
          options={options}
          initialKw={kw}
          recommendedKw={quote.selectedKw}
          tariffPerUnit={inputs.tariffPerUnit}
          surplusRate={snapshot.surplusRatePerUnit}
          generationFactor={snapshot.generationKwhPerKwYear}
          scheme={
            snapshot.subsidyRule && {
              name: snapshot.subsidyRule.schemeName,
              capAmount: snapshot.subsidyRule.capAmount,
              effectiveFrom: formatDate(snapshot.subsidyRule.effectiveFrom, locale),
            }
          }
          advancePercent={snapshot.advancePercent}
          projectToken={quote.project?.token ?? null}
          customerName={quote.lead.name.split(" ")[0]}
          quoteDate={formatDate(quote.quoteDate.toISOString().slice(0, 10), locale)}
          billView={snapshot.billView ?? null}
          brand={brand("name")}
          quoteUrl={`${appUrl()}/${locale}/q/${token}`}
        />
      </div>
    </SiteShell>
  );
}
