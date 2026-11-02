"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loginAction } from "@/app/[locale]/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("login");
  const locale = useLocale();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setFailed(false);
        startTransition(async () => {
          const result = await loginAction({ login, password, next }, locale);
          if (result.ok) window.location.assign(result.next);
          else setFailed(true);
        });
      }}
    >
      <Field id="login" label={t("login")}>
        <Input id="login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
      </Field>
      <Field id="password" label={t("password")}>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
