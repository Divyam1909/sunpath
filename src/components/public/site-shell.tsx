import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand-mark";
import { AccountLink } from "@/components/public/account-link";
import { LanguageSwitcher } from "@/components/public/language-switcher";
import { SunPathBackdrop } from "@/components/public/sun-path-backdrop";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export async function SiteShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const t = await getTranslations();
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <SunPathBackdrop />
      <header className={cn("mx-auto flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-4 sm:px-6", wide ? "max-w-5xl" : "max-w-xl")}>
        <Link href="/" className="flex items-center gap-2 font-medium tracking-tight whitespace-nowrap">
          <BrandMark />
          {t("brand.name")}
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <LanguageSwitcher />
          <AccountLink />
        </div>
      </header>
      <main className={cn("mx-auto w-full flex-1 px-5 pt-6 pb-16 sm:px-6 sm:pt-10", wide ? "max-w-5xl" : "max-w-xl")}>{children}</main>
    </div>
  );
}
