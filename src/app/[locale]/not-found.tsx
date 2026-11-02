import { getTranslations } from "next-intl/server";
import { SiteShell } from "@/components/public/site-shell";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <SiteShell>
      <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("title")}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{t("lead")}</p>
      <Link href="/" className={`${buttonVariants({ size: "lg" })} mt-6`}>{t("home")}</Link>
    </SiteShell>
  );
}
