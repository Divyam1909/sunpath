import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BillImage } from "@/components/public/bill-image";
import { HomeownerBillCheck } from "@/components/public/homeowner-bill-check";
import { SiteShell } from "@/components/public/site-shell";
import { Link, redirect } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/server/db";
import { latestBill, prefillBill, type StoredAiRead } from "@/server/leads";
import { getSettings } from "@/server/settings";
import { fileStore } from "@/server/storage";

export default async function CheckPage({ params, searchParams }: PageProps<"/[locale]/l/[token]/check">) {
  const { locale, token } = await params;
  const { manual } = await searchParams;
  setRequestLocale(locale);
  const lead = await db.lead.findUnique({ where: { accessToken: token } });
  if (!lead) notFound();

  const reading = await latestBill(lead.id);
  const typing = manual === "1";
  if (!reading && !typing) redirect({ href: `/l/${token}/upload`, locale });
  if (reading?.status === "CONFIRMED") redirect({ href: `/l/${token}/result`, locale });

  const t = await getTranslations("check");

  if (reading?.status === "POOR_PHOTO" && !typing) {
    const reason = (reading.poorReason ?? "unreadable") as "notBill";
    return (
      <SiteShell>
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t(`poorTitle.${reason}`)}</h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">{t("poorLead")}</p>
        <h2 className="mt-8 font-medium">{t("tipsTitle")}</h2>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 leading-relaxed">
          <li>{t("tip1")}</li>
          <li>{t("tip2")}</li>
          <li>{t("tip3")}</li>
        </ol>
        <div className="mt-8 grid gap-4">
          <Link href={`/l/${token}/upload`} className={buttonVariants({ size: "lg" })}>
            {t("reupload")}
          </Link>
          <Link href={`/l/${token}/check?manual=1`} className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("typeInstead")}
          </Link>
        </div>
      </SiteShell>
    );
  }

  const ai = reading?.status === "READ" ? (reading.ai as unknown as StoredAiRead) : null;
  const settings = await getSettings();
  const initial = prefillBill(ai, lead, settings);
  const hasImage = Boolean(reading?.storageKey) && reading?.status !== "POOR_PHOTO";
  const imageUrl = hasImage ? await fileStore.signedUrl(reading!.storageKey, reading!.mimeType) : null;
  const isPdf = reading?.mimeType === "application/pdf";
  const form = <HomeownerBillCheck token={token} initial={initial} lowConfidence={ai?.lowConfidence ?? []} />;
  const heading = ai ? t("title") : t("manualTitle");
  const lead_ = ai ? t("lead") : typing ? t("noBillLead") : t("manualLead");

  if (!imageUrl) {
    return (
      <SiteShell>
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{heading}</h1>
        <p className="mt-2 mb-7 leading-relaxed text-muted-foreground">{lead_}</p>
        {form}
      </SiteShell>
    );
  }

  return (
    <SiteShell wide>
      <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{heading}</h1>
      <p className="mt-2 mb-7 max-w-prose leading-relaxed text-muted-foreground">{lead_}</p>
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        {isPdf ? (
          <a href={imageUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-4">
            {t("openPdf")}
          </a>
        ) : (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <BillImage src={imageUrl} alt={t("billImage")} zoomInLabel={t("zoomIn")} zoomOutLabel={t("zoomOut")} />
          </div>
        )}
        <div className="grid gap-4">
          {form}
          <Link href={`/l/${token}/upload`} className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("reupload")}
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
