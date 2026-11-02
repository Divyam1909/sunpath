import { defineRouting } from "next-intl/routing";

export const locales = ["en", "mr", "hi"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({ locales, defaultLocale: "en" });

export const localeNames: Record<Locale, string> = { en: "English", mr: "मराठी", hi: "हिंदी" };
