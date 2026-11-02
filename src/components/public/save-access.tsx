"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveAccess } from "@/app/[locale]/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SaveAccess({ token, phone }: { token: string; phone: string }) {
  const t = useTranslations("result");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  if (message?.ok) return <p className="text-sm text-primary">{message.text}</p>;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveAccess(token, password);
          setMessage(result.ok ? { ok: true, text: t("saved", { phone }) } : { ok: false, text: t(result.error) });
        });
      }}
    >
      <Field id="password" label={t("password")} hint={t("passwordHint")} error={message?.text}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {t("savePassword")}
      </Button>
    </form>
  );
}
