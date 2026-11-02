import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeadForm } from "@/components/public/lead-form";
import { SiteShell } from "@/components/public/site-shell";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  return (
    <SiteShell>
      <h1 className="text-[2rem] leading-[1.15] font-medium tracking-tight sm:text-[2.5rem]">{t("title")}</h1>
      <p className="mt-3 max-w-prose text-[1.0625rem] leading-relaxed text-muted-foreground">{t("lead")}</p>
      <div className="mt-9">
        <LeadForm totalSteps={4} />
      </div>
    </SiteShell>
  );
}
