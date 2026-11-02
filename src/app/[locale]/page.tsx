import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeadForm } from "@/components/public/lead-form";
import { SiteShell } from "@/components/public/site-shell";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  return (
    <SiteShell wide>
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:items-start lg:gap-16 lg:pt-4">
        <div>
          <h1 className="text-[2rem] leading-[1.15] font-medium tracking-tight sm:text-[2.5rem] lg:text-5xl lg:leading-[1.1]">{t("title")}</h1>
          <p className="mt-3 max-w-prose text-[1.0625rem] leading-relaxed text-muted-foreground lg:mt-5">{t("lead")}</p>
          <ol className="mt-10 hidden gap-4 lg:grid">
            {(["stepAnswer", "stepBill", "stepResult"] as const).map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-teal-tint text-sm font-medium text-primary">{index + 1}</span>
                {t(step)}
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:rounded-2xl lg:border lg:bg-card lg:p-8">
          <LeadForm totalSteps={4} />
        </div>
      </div>
    </SiteShell>
  );
}
