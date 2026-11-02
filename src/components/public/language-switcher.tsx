"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { localeNames, locales } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("language")} className="flex items-center gap-3 text-sm">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === current ? "true" : undefined}
          className={cn(
            "py-1 underline-offset-4 hover:underline",
            locale === current ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {localeNames[locale]}
        </Link>
      ))}
    </nav>
  );
}
