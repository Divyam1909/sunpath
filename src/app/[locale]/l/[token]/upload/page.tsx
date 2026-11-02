import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BillUpload } from "@/components/public/bill-upload";
import { SiteShell } from "@/components/public/site-shell";
import { db } from "@/server/db";

export default async function UploadPage({ params }: PageProps<"/[locale]/l/[token]/upload">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const lead = await db.lead.findUnique({ where: { accessToken: token }, select: { id: true } });
  if (!lead) notFound();
  const t = await getTranslations();
  return (
    <SiteShell>
      <p className="text-sm text-muted-foreground">{t("home.stepOf", { step: 4, total: 4 })}</p>
      <div className="mt-2 mb-8 flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-primary" />
        ))}
      </div>
      <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("upload.title")}</h1>
      <p className="mt-2 mb-7 leading-relaxed text-muted-foreground">{t("upload.lead")}</p>
      <BillUpload url={`/api/leads/${token}/bill`} next={`/l/${token}/check`} manualHref={`/l/${token}/check?manual=1`} />
    </SiteShell>
  );
}
