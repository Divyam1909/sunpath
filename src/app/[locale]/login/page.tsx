import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/public/login-form";
import { SiteShell } from "@/components/public/site-shell";

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("login");
  return (
    <SiteShell>
      <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("title")}</h1>
      <p className="mt-2 mb-7 leading-relaxed text-muted-foreground">{t("lead")}</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </SiteShell>
  );
}
