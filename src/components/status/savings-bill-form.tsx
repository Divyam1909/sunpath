"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { confirmSavingsBill } from "@/app/[locale]/s/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

const NUMBERS = ["billAmount", "importUnits", "exportUnits", "bankedUnits", "billedUnits"] as const;

interface Props {
  token: string;
  readingId: string;
  initial: { month: string } & Record<(typeof NUMBERS)[number], number | null>;
}

export function SavingsBillForm({ token, readingId, initial }: Props) {
  const t = useTranslations("savingsBill");
  const router = useRouter();
  const [month, setMonth] = useState(initial.month);
  const [values, setValues] = useState(() => Object.fromEntries(NUMBERS.map((key) => [key, initial[key]?.toString() ?? ""])) as Record<(typeof NUMBERS)[number], string>);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailed(false);
    const numbers = Object.fromEntries(NUMBERS.map((key) => [key, values[key].trim() === "" ? null : Number(values[key].replace(/,/g, ""))]));
    startTransition(async () => {
      const result = await confirmSavingsBill(token, readingId, { month, ...numbers });
      if (result.ok) router.push(`/s/${token}`);
      else setFailed(true);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field id="month" label={t("month")}>
        <Input id="month" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="Mar 2027" />
      </Field>
      {NUMBERS.map((key) => (
        <Field key={key} id={key} label={t(key)}>
          <Input id={key} inputMode="decimal" value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
        </Field>
      ))}
      {failed ? <p role="alert" className="text-sm text-destructive">{t("invalid")}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>{pending ? t("saving") : t("save")}</Button>
    </form>
  );
}
