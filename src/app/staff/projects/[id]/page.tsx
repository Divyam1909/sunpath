import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentUpload } from "@/components/status/document-upload";
import { AdvanceStage } from "@/components/staff/advance-stage";
import { DOC_LABELS, STAGE_LABELS } from "@/components/staff/labels";
import { buttonVariants } from "@/components/ui/button";
import { formatINR, formatNumber, istDate } from "@/domain/format";
import { checkStuck, nextStage, REQUIRED_DOCS, STAGES, type Stage } from "@/domain/project";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { requireStaff } from "@/server/guards";
import { getSettings } from "@/server/settings";
import { fileStore } from "@/server/storage";

export default async function ProjectDetailPage({ params }: PageProps<"/staff/projects/[id]">) {
  await requireStaff();
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      lead: true,
      documents: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
      outbox: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) notFound();

  const settings = await getSettings();
  const stage = project.stage as Stage;
  const index = STAGES.indexOf(stage);
  const next = nextStage(stage);
  const check = checkStuck(stage, project.stageEnteredAt, settings.stageSlaDays, new Date());
  const urls = new Map(
    await Promise.all(
      project.documents.map(async (doc) => [doc.docType, await fileStore.signedUrl(doc.storageKey, doc.mimeType)] as const),
    ),
  );

  return (
    <div className="grid gap-8">
      <div>
        <Link href="/staff/projects" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Projects</Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-medium tracking-tight">{project.lead.name}</h1>
          <span className="text-sm text-muted-foreground">{project.code}</span>
        </div>
        <p className="tabular mt-1 text-sm text-muted-foreground">
          {formatNumber(project.systemKw)} kW, {formatINR(project.netCost)} net cost, {formatINR(project.advanceAmount)} advance ({project.advanceReference}), {project.statusViews} status page views
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">
            Now: <span data-testid="project-stage">{STAGE_LABELS[stage]}</span>
          </h2>
          {check.slaDays !== null ? (
            <p className={cn("tabular text-sm", check.stuck ? "font-medium text-destructive" : "text-muted-foreground")}>
              {check.days} of {check.slaDays} days{check.stuck ? `, stuck by ${check.overdueBy}` : ""}
            </p>
          ) : null}
        </div>
        {next ? <AdvanceStage projectId={project.id} nextLabel={STAGE_LABELS[next]} /> : <p className="text-sm text-muted-foreground">This project is complete.</p>}
        <Link
          href={`/${project.lead.locale}/s/${project.token}`}
          target="_blank"
          data-testid="status-link"
          className={cn(buttonVariants({ variant: "outline" }), "justify-self-start")}
        >
          Open customer status page
        </Link>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="checklist-heading">
          <h2 id="checklist-heading" className="text-lg font-medium">Stage checklist</h2>
          <ol className="mt-3 grid gap-5">
            {STAGES.map((item, i) => (
              <li key={item}>
                <p className={cn("text-sm font-medium", i > index && "text-muted-foreground")}>
                  {i + 1}. {STAGE_LABELS[item]}
                </p>
                {REQUIRED_DOCS[item].length > 0 ? (
                  <ul className="mt-1 grid">
                    {REQUIRED_DOCS[item].map((doc) => {
                      const url = urls.get(doc.type);
                      return (
                        <li key={doc.type} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                          <span>
                            {DOC_LABELS[doc.type]}
                            {doc.byCustomer ? <span className="text-muted-foreground"> (from customer)</span> : null}
                          </span>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">View</a>
                          ) : i <= index ? (
                            <DocumentUpload
                              url={`/api/staff/projects/${project.id}/documents`}
                              docType={doc.type}
                              label="Upload"
                              uploadingLabel="Uploading"
                              failedLabel="Use a JPG, PNG, WEBP or PDF under 4 MB."
                            />
                          ) : (
                            <span className="text-muted-foreground">Later</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <div className="grid content-start gap-8">
          <section aria-labelledby="messages-heading">
            <h2 id="messages-heading" className="text-lg font-medium">Messages sent</h2>
            {project.outbox.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <ul className="mt-2 grid gap-3">
                {project.outbox.map((message) => (
                  <li key={message.id} data-testid="project-message" className="rounded-lg bg-muted p-3 text-sm leading-relaxed">
                    <p className="break-words">{message.body}</p>
                    <p className="tabular mt-1 text-[0.8125rem] text-muted-foreground">
                      Mock WhatsApp, {message.locale}, {istDate(message.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-lg font-medium">History</h2>
            <ul className="mt-2 grid gap-1.5 text-sm">
              {project.events.map((event) => (
                <li key={event.id} className="flex justify-between gap-4">
                  <span>{STAGE_LABELS[event.toStage]}{event.actor ? `, by ${event.actor.name}` : ""}</span>
                  <span className="tabular whitespace-nowrap text-muted-foreground">{istDate(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
