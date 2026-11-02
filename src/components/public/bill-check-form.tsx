"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmedBillSchema, type ConfirmedBill } from "@/domain/bill";
import { cn } from "@/lib/utils";

const TEXT_FIELDS = ["consumerNumber", "tariffCategory", "billingMonth"] as const;
const REQUIRED = ["unitsLatestMonth", "averageMonthlyUnits", "billAmount"] as const;
const ORDER: (keyof ConfirmedBill)[] = [
  "consumerNumber",
  "tariffCategory",
  "sanctionedLoadKw",
  "unitsLatestMonth",
  "averageMonthlyUnits",
  "billAmount",
  "billingMonth",
  "ratePerUnit",
];

type Draft = Record<keyof ConfirmedBill, string>;

function toDraft(bill: ConfirmedBill): Draft {
  return Object.fromEntries(ORDER.map((k) => [k, bill[k]?.toString() ?? ""])) as Draft;
}

function fromDraft(draft: Draft) {
  const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value.replace(/,/g, "")));
  const textOrNull = (value: string) => value.trim() || null;
  return Object.fromEntries(
    ORDER.map((k) => [k, (TEXT_FIELDS as readonly string[]).includes(k) ? textOrNull(draft[k]) : numberOrNull(draft[k])]),
  );
}

interface Props {
  initial: ConfirmedBill;
  lowConfidence: string[];
  /** Runs on the server. Returns ok false when validation fails there too. */
  onConfirm: (bill: ConfirmedBill) => Promise<{ ok: boolean }>;
  submitLabel?: string;
}

export function BillCheckForm({ initial, lowConfidence, onConfirm, submitLabel }: Props) {
  const t = useTranslations("check");
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [invalid, setInvalid] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = confirmedBillSchema.safeParse(fromDraft(draft));
    if (!parsed.success) {
      setInvalid(parsed.error.issues.map((issue) => String(issue.path[0])));
      setFailed(true);
      return;
    }
    setInvalid([]);
    setFailed(false);
    startTransition(async () => {
      const result = await onConfirm(parsed.data);
      if (!result.ok) setFailed(true);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {ORDER.map((field) => {
        const isLow = lowConfidence.includes(field);
        const isText = (TEXT_FIELDS as readonly string[]).includes(field);
        const isRequired = (REQUIRED as readonly string[]).includes(field);
        return (
          <Field
            key={field}
            id={field}
            label={
              <>
                {t(field)}
                {isRequired ? null : <span className="ml-1.5 font-normal text-muted-foreground">{t("optional")}</span>}
              </>
            }
            hint={isLow ? t("lowConfidence") : undefined}
          >
            <Input
              id={field}
              value={draft[field]}
              inputMode={isText ? "text" : "decimal"}
              onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
              aria-invalid={invalid.includes(field)}
              data-low-confidence={isLow || undefined}
              className={cn(isLow && "border-primary bg-teal-tint")}
            />
          </Field>
        );
      })}
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("invalid")}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? t("confirming") : (submitLabel ?? t("confirm"))}
      </Button>
    </form>
  );
}
