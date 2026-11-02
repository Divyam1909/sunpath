import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/public/language-switcher";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export async function SiteShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className={cn("mx-auto flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-6", wide ? "max-w-5xl" : "max-w-xl")}>
        <Link href="/" className="font-medium tracking-tight">
          {t("brand.name")}
        </Link>
        <LanguageSwitcher />
      </header>
      <main className={cn("mx-auto w-full flex-1 px-5 pt-6 pb-16 sm:px-6 sm:pt-10", wide ? "max-w-5xl" : "max-w-xl")}>{children}</main>
      <footer className={cn("mx-auto w-full px-5 pb-6 text-sm text-muted-foreground sm:px-6", wide ? "max-w-5xl" : "max-w-xl")}>
        <Link href="/login" className="underline-offset-4 hover:underline">
          {t("nav.signIn")}
        </Link>
      </footer>
    </div>
  );
}
