"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const linkClass = "py-1 text-sm font-medium whitespace-nowrap underline-offset-4 hover:underline";

/** Asks for the session in the browser, so the public pages stay static and fast. */
export function AccountLink() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((session) => setRole(session?.user?.role ?? null))
      .catch(() => setRole(null));
  }, [pathname]);

  if (pathname === "/login" || pathname === "/my") return null;
  if (role === "HOMEOWNER") return <Link href="/my" className={linkClass}>{t("mySolar")}</Link>;
  if (role) return <NextLink href="/staff/leads" className={linkClass}>{t("staff")}</NextLink>;
  return <Link href="/login" className={linkClass}>{t("signIn")}</Link>;
}
