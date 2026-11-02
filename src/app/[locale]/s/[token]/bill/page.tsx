import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BillUpload } from "@/components/public/bill-upload";
import { SiteShell } from "@/components/public/site-shell";
import { SavingsBillForm } from "@/components/status/savings-bill-form";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import type { StoredAiRead } from "@/server/leads";
import { canCheckSavings } from "@/server/savings";

export const metadata: Metadata = { robots: { index: false } };

const SAMPLE = [{ file: "after-solar-bill.jpg", label: "Bill after solar, with a net meter" }];

export default async function SavingsBillPage({ params }: PageProps<"/[locale]/s/[token]/bill">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const project = await db.project.findUnique({ where: { token }, select: { stage: true, leadId: true } });
  if (!project || !canCheckSavings(project.stage)) notFound();
  const t = await getTranslations("savingsBill");

  const reading = await db.billReading.findFirst({
    where: { leadId: project.leadId, purpose: "AFTER_SOLAR", status: { not: "CONFIRMED" } },
    orderBy: { createdAt: "desc" },
  });
  const extraction = reading?.status === "READ" ? (reading.ai as unknown as StoredAiRead).extraction : null;
  const back = (
    <Link href={`/s/${token}`} className="mt-6 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
      {t("back")}
    </Link>
  );

  if (!reading || reading.status === "POOR_PHOTO") {
    return (
      <SiteShell>
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-2 mb-7 leading-relaxed text-muted-foreground">{t("lead")}</p>
        <BillUpload url={`/api/s/${token}/bills`} next={`/s/${token}/bill`} samples={SAMPLE} />
        {back}
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("checkTitle")}</h1>
      <p className="mt-2 mb-7 leading-relaxed text-muted-foreground">{extraction ? t("checkLead") : t("manualLead")}</p>
      <SavingsBillForm
        token={token}
        readingId={reading.id}
        initial={{
          month: extraction?.billingMonth.value ?? "",
          billAmount: extraction?.currentBillAmount.value ?? extraction?.billAmount.value ?? null,
          importUnits: extraction?.solarImportUnits.value ?? null,
          exportUnits: extraction?.solarExportUnits.value ?? null,
          bankedUnits: extraction?.solarBankedUnits.value ?? null,
          billedUnits: extraction?.solarBilledUnits.value ?? extraction?.unitsLatestMonth.value ?? null,
        }}
      />
      {back}
    </SiteShell>
  );
}
