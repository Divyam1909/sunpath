import { getTranslations, setRequestLocale } from "next-intl/server";
import { logoutAction } from "@/app/[locale]/actions";
import { SiteShell } from "@/components/public/site-shell";
import { buttonVariants } from "@/components/ui/button";
import { formatNumber } from "@/domain/format";
import { Link, redirect } from "@/i18n/navigation";
import { db } from "@/server/db";
import { AuthError, requireHomeowner } from "@/server/guards";

export default async function MyPage({ params }: PageProps<"/[locale]/my">) {
  const { locale } = await params;
  setRequestLocale(locale);
  let userId: string;
  try {
    userId = (await requireHomeowner()).id;
  } catch (error) {
    if (error instanceof AuthError) return redirect({ href: "/login", locale });
    throw error;
  }
  // Ownership check: only leads linked to this account are ever read.
  const leads = await db.lead.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      accessToken: true,
      recommendedKw: true,
      quotes: { select: { token: true }, orderBy: { createdAt: "desc" }, take: 1 },
      project: { select: { token: true } },
    },
  });
  const t = await getTranslations();
  return (
    <SiteShell>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("my.title")}</h1>
        <form action={logoutAction}>
          <button className="py-1 text-sm text-muted-foreground underline-offset-4 hover:underline">{t("nav.signOut")}</button>
        </form>
      </div>
      {leads.length === 0 ? (
        <div className="mt-8 rounded-xl bg-muted p-6 text-center">
          <p className="text-muted-foreground">{t("my.empty")}</p>
          <Link href="/" className={`${buttonVariants()} mt-4`}>{t("my.startOne")}</Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4">
          {leads.map((lead) => {
            const quote = lead.quotes[0];
            const href = lead.project ? `/s/${lead.project.token}` : quote ? `/q/${quote.token}` : `/l/${lead.accessToken}/result`;
            const label = lead.project ? "my.viewProject" : quote ? "my.viewQuote" : "my.viewResult";
            return (
              <li key={lead.id} className="rounded-xl border p-5">
                <p className="text-sm text-muted-foreground">{t("my.lead", { code: lead.code })}</p>
                <p className="mt-0.5 text-xl font-medium">
                  {lead.recommendedKw ? t("my.system", { kw: formatNumber(lead.recommendedKw) }) : t("my.noSize")}
                </p>
                <Link href={href} className={`${buttonVariants()} mt-4 w-full`}>{t(label as "my.viewResult")}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </SiteShell>
  );
}
