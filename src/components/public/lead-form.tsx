"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitLead } from "@/app/[locale]/actions";
import { describedBy, Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { leadInputSchema, OWNERSHIPS, ROOF_TYPES } from "@/lib/validation";

const STEP_FIELDS = [
  ["ownership", "roofType"],
  ["roofAreaSqFt", "monthlyBill", "pincode"],
  ["name", "phone", "consent"],
] as const;

type FieldName = (typeof STEP_FIELDS)[number][number];
type Values = Partial<Record<FieldName, string | boolean>>;

function Choice({
  legend,
  name,
  options,
  value,
  error,
  onChange,
  label,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  value: unknown;
  error?: string;
  onChange: (value: string) => void;
  label: (option: string) => string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-[1.0625rem] font-medium">{legend}</legend>
      {options.map((option) => (
        <label
          key={option}
          className={cn(
            "flex min-h-13 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            value === option ? "border-primary bg-teal-tint" : "border-input hover:border-foreground/40",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="size-4 accent-primary"
          />
          <span>{label(option)}</span>
        </label>
      ))}
      {error ? <p className="text-[0.8125rem] text-destructive">{error}</p> : null}
    </fieldset>
  );
}

export function LeadForm({ totalSteps }: { totalSteps: number }) {
  const t = useTranslations("form");
  const tHome = useTranslations("home");
  const tError = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const stepHeading = useRef<HTMLParagraphElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else stepHeading.current?.focus();
  }, [step]);

  const set = (field: FieldName, value: string | boolean) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function validateStep() {
    const fields = Object.fromEntries(STEP_FIELDS[step].map((f) => [f, true])) as Record<FieldName, true>;
    const result = leadInputSchema.pick(fields).safeParse(values);
    if (result.success) return true;
    const next: typeof errors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as FieldName;
      next[field] ??= tError(issue.message as "choose");
    }
    setErrors(next);
    return false;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validateStep()) return;
    if (step < STEP_FIELDS.length - 1) {
      setStep(step + 1);
      return;
    }
    startTransition(async () => {
      const result = await submitLead({ ...values, locale });
      if (result.ok) router.push(`/l/${result.token}/upload`);
      else setFormError(t(result.error));
    });
  }

  const textField = (field: FieldName, label: string, props: React.ComponentProps<typeof Input>, hint?: ReactNode) => (
    <Field id={field} label={label} hint={hint} error={errors[field]}>
      <Input
        id={field}
        value={(values[field] as string) ?? ""}
        onChange={(e) => set(field, e.target.value)}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={describedBy(field, hint, errors[field])}
        {...props}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <div>
        <p ref={stepHeading} tabIndex={-1} className="text-sm text-muted-foreground outline-none">
          {tHome("stepOf", { step: step + 1, total: totalSteps })}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>

      {step === 0 ? (
        <div className="grid gap-7">
          <Choice
            legend={t("ownershipLegend")}
            name="ownership"
            options={OWNERSHIPS}
            value={values.ownership}
            error={errors.ownership}
            onChange={(v) => set("ownership", v)}
            label={(o) => t(o as "OWNER")}
          />
          <Choice
            legend={t("roofLegend")}
            name="roofType"
            options={ROOF_TYPES}
            value={values.roofType}
            error={errors.roofType}
            onChange={(v) => set("roofType", v)}
            label={(o) => t(o as "RCC_FLAT")}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-5">
          {textField("roofAreaSqFt", t("roofArea"), { inputMode: "numeric", autoComplete: "off" }, t("roofAreaHint"))}
          {textField("monthlyBill", t("monthlyBill"), { inputMode: "numeric", autoComplete: "off" })}
          {textField("pincode", t("pincode"), { inputMode: "numeric", autoComplete: "postal-code", maxLength: 6 })}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-5">
          {textField("name", t("name"), { autoComplete: "name" })}
          {textField("phone", t("phone"), { inputMode: "tel", autoComplete: "tel-national", maxLength: 10 }, t("phoneHint"))}
          <div className="grid gap-3 rounded-lg bg-muted p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("consentNotice")}</p>
            <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
              <Checkbox
                className="mt-0.5 bg-background"
                checked={values.consent === true}
                onCheckedChange={(checked) => set("consent", checked === true)}
                aria-invalid={Boolean(errors.consent)}
              />
              <span>{t("consentLabel")}</span>
            </label>
            {errors.consent ? <p className="text-[0.8125rem] text-destructive">{errors.consent}</p> : null}
          </div>
        </div>
      ) : null}

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" size="lg" onClick={() => setStep(step - 1)} disabled={pending}>
            {t("back")}
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? t("submitting") : step === STEP_FIELDS.length - 1 ? t("submit") : t("next")}
        </Button>
      </div>
    </form>
  );
}
