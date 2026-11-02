import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/public/site-shell";
import { DocumentUpload } from "@/components/status/document-upload";
import { SunArc } from "@/components/status/sun-arc";
import { formatNumber, istDate } from "@/domain/format";
import { REQUIRED_DOCS, STAGES, type Stage } from "@/domain/project";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { fileStore } from "@/server/storage";

export const metadata: Metadata = { robots: { index: false } };

export default async function StatusPage({ params }: PageProps<"/[locale]/s/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const project = await db.project.findUnique({
    where: { token },
    select: {
      id: true,
      code: true,
      stage: true,
      systemKw: true,
      updatedAt: true,
      // Only the first name leaves this query. No phone, address or consumer number.
      lead: { select: { name: true } },
      events: { select: { toStage: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      documents: { select: { id: true, docType: true, storageKey: true, mimeType: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) notFound();
  await db.project.update({ where: { id: project.id }, data: { statusViews: { increment: 1 } } });

  const t = await getTranslations();
  const stage = project.stage as Stage;
  const index = STAGES.indexOf(stage);
  const reachedOn = new Map(project.events.map((e) => [e.toStage as string, e.createdAt]));
  const firstName = project.lead.name.split(" ")[0];

  const requiredSoFar = STAGES.slice(0, index + 1).flatMap((s) => REQUIRED_DOCS[s]);
  const docs = await Promise.all(
    requiredSoFar
      .filter((doc) => doc.byCustomer || project.documents.some((d) => d.docType === doc.type))
      .map(async (doc) => {
        const uploaded = project.documents.find((d) => d.docType === doc.type);
        return {
          ...doc,
          url: uploaded ? await fileStore.signedUrl(uploaded.storageKey, uploaded.mimeType) : null,
        };
      }),
  );

  return (
    <SiteShell>
      <p className="text-muted-foreground">{t("status.greeting", { name: firstName })}</p>
      <h1 className="mt-0.5 text-[1.75rem] leading-tight font-medium tracking-tight">{t("status.lead", { kw: formatNumber(project.systemKw) })}</h1>

      <div className="mt-8">
        <SunArc stageIndex={index} label={t("status.stageOf", { stage: index + 1, total: STAGES.length })} />
      </div>

      <div className="mt-2">
        <p className="text-sm text-muted-foreground">{t("status.stageOf", { stage: index + 1, total: STAGES.length })}</p>
        <p data-testid="current-stage" className="mt-0.5 text-2xl font-medium tracking-tight">{t(`stages.${stage}`)}</p>
      </div>

      <section className="mt-6 rounded-xl bg-teal-tint p-5">
        <h2 className="font-medium">{t("status.next")}</h2>
        <p className="mt-1 leading-relaxed">{t(`stageNext.${stage}`)}</p>
      </section>

      <ol className="mt-9 grid">
        {STAGES.map((item, i) => {
          const done = i < index;
          const current = i === index;
          const on = reachedOn.get(item);
          return (
            <li key={item} className="grid grid-cols-[1.5rem_1fr_auto] items-start gap-3 py-2 text-[0.9375rem]" aria-current={current ? "step" : undefined}>
              <span className={cn("mt-0.5 grid size-5 place-items-center rounded-full", done || current ? "bg-primary text-primary-foreground" : "border border-input")}>
                {done ? <Check className="size-3" aria-hidden /> : null}
              </span>
              <span className={cn(current && "font-medium", !done && !current && "text-muted-foreground")}>{t(`stages.${item}`)}</span>
              <span className="tabular text-sm text-muted-foreground">{on && (done || current) ? istDate(on) : ""}</span>
            </li>
          );
        })}
      </ol>

      <section className="mt-9 border-t pt-7">
        <h2 className="text-lg font-medium">{t("status.documentsTitle")}</h2>
        {docs.length === 0 ? (
          <p className="mt-2 text-muted-foreground">{t("status.noDocs")}</p>
        ) : (
          <ul className="mt-3 grid">
            {docs.map((doc) => (
              <li key={doc.type} className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
                <div>
                  <p>{t(`docs.${doc.type}` as "docs.ID_PROOF")}</p>
                  <p className="text-sm text-muted-foreground">{doc.url ? t("status.received") : t("status.needed")}</p>
                </div>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    {t("status.viewDoc")}
                  </a>
                ) : (
                  <DocumentUpload
                    url={`/api/s/${token}/documents`}
                    docType={doc.type}
                    label={t("status.upload")}
                    uploadingLabel={t("status.uploading")}
                    failedLabel={t("status.uploadFailed")}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-muted-foreground">{t("status.help", { code: project.code })}</p>
    </SiteShell>
  );
}
