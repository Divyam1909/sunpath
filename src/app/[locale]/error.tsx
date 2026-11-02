"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <main className="mx-auto max-w-xl px-5 py-16 sm:px-6">
      <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">{t("title")}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{t("lead")}</p>
      <Button size="lg" className="mt-6" onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
