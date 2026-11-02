"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { payAdvanceAction } from "@/app/[locale]/q/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatINR, formatNumber } from "@/domain/format";
import type { QuoteOption } from "@/domain/quote";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface Props {
  token: string;
  options: QuoteOption[];
  initialKw: number;
  recommendedKw: number;
  tariffPerUnit: number;
  surplusRate: number;
  generationFactor: number;
  scheme: { name: string; capAmount: number; effectiveFrom: string } | null;
  advancePercent: number;
  projectToken: string | null;
  customerName: string;
  quoteDate: string;
}

export function QuoteStory(props: Props) {
  const { token, options, recommendedKw, tariffPerUnit, surplusRate, generationFactor, scheme, advancePercent, projectToken } = props;
  const t = useTranslations("quote");
  const locale = useLocale();
  const router = useRouter();
  const [kw, setKw] = useState(props.initialKw);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const option = options.find((o) => o.systemKw === kw) ?? options[0];
  const advance = Math.round((option.netCost * advancePercent) / 100);
  const years = option.paybackYears === null ? null : t("years", { years: formatNumber(option.paybackYears) });

  const rows: [string, (o: QuoteOption) => string][] = [
    ["gross", (o) => formatINR(o.grossCost)],
    ["subsidy", (o) => `− ${formatINR(o.subsidy)}`],
    ["net", (o) => formatINR(o.netCost)],
    ["generation", (o) => t("units", { units: formatNumber(o.yearlyGeneration) })],
    ["savings", (o) => formatINR(o.yearlySavings)],
    ["payback", (o) => (o.paybackYears === null ? "-" : t("years", { years: formatNumber(o.paybackYears) }))],
    ["lifetime", (o) => formatINR(o.savings25Years)],
  ];

  return (
    <div>
      <p className="text-sm text-muted-foreground">{t("forName", { name: props.customerName, date: props.quoteDate })}</p>

      <dl className="mt-8 grid gap-8" data-testid="quote-story">
        <div>
          <dt className="text-[0.9375rem] text-muted-foreground">{t("systemLabel")}</dt>
          <dd className="tabular mt-1 text-[3.5rem] leading-none font-medium tracking-tight">{formatNumber(option.systemKw)} kW</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="mt-2 text-[0.9375rem] text-muted-foreground">{t("afterSubsidy")}</dt>
          <dd className="tabular text-[3.5rem] leading-none font-medium tracking-tight text-primary">{formatINR(option.netCost)}</dd>
        </div>
        <div>
          <dt className="text-[0.9375rem] text-muted-foreground">{t("paybackLabel")}</dt>
          <dd className="tabular mt-1 text-[3.5rem] leading-none font-medium tracking-tight">{years ?? t("noPayback")}</dd>
        </div>
      </dl>

      {projectToken ? (
        <section className="mt-10 rounded-xl bg-teal-tint p-5">
          <h2 className="font-medium">{t("paid")}</h2>
          <Link href={`/s/${projectToken}`} className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}>
            {t("trackProject")}
          </Link>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-lg font-medium">{t("optionsTitle")}</h2>
        <fieldset className="mt-3 flex gap-2" disabled={Boolean(projectToken)}>
          <legend className="sr-only">{t("optionsTitle")}</legend>
          {options.map((o) => (
            <label
              key={o.systemKw}
              className={cn(
                "flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-2 py-3 text-center has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                o.systemKw === kw ? "border-primary bg-teal-tint" : "border-input hover:border-foreground/40",
              )}
            >
              <input type="radio" name="option" className="sr-only" checked={o.systemKw === kw} onChange={() => setKw(o.systemKw)} />
              <span className="tabular text-lg font-medium">{formatNumber(o.systemKw)} kW</span>
              <span className="tabular text-sm text-muted-foreground">{formatINR(o.netCost)}</span>
              {o.systemKw === recommendedKw ? <span className="text-xs text-primary">{t("recommended")}</span> : null}
            </label>
          ))}
        </fieldset>

        <table className="mt-5 w-full text-[0.9375rem]">
          <tbody>
            {rows.map(([key, value]) => (
              <tr key={key} className="border-b last:border-0">
                <th scope="row" className="py-2.5 text-left font-normal text-muted-foreground">
                  {t(`table.${key}` as "table.gross")}
                </th>
                <td className={cn("tabular py-2.5 text-right", key === "net" && "font-medium")}>{value(option)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <details className="group mt-4 rounded-lg border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t("howTitle")}
          </summary>
          <div className="tabular grid gap-1.5 border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            <p>{t("howCost", { kw: formatNumber(option.systemKw), rate: formatINR(option.pricePerKw), gross: formatINR(option.grossCost) })}</p>
            {option.subsidyLines.map((line) => (
              <p key={line.ratePerKw}>
                {t("howSubsidyLine", { kw: formatNumber(line.kw), rate: formatINR(line.ratePerKw), amount: formatINR(line.amount) })}
              </p>
            ))}
            {scheme ? (
              <>
                <p>{t("howSubsidyTotal", { amount: formatINR(option.subsidy) })}</p>
                {option.subsidyCapped ? <p>{t("howSubsidyCap", { cap: formatINR(scheme.capAmount) })}</p> : null}
                <p>{t("howSubsidyScheme", { scheme: scheme.name, date: scheme.effectiveFrom })}</p>
              </>
            ) : (
              <p>{t("howSubsidyNone")}</p>
            )}
            <p>{t("howNet", { gross: formatINR(option.grossCost), subsidy: formatINR(option.subsidy), net: formatINR(option.netCost) })}</p>
            <p>
              {t("howGeneration", {
                kw: formatNumber(option.systemKw),
                factor: formatNumber(generationFactor),
                units: formatNumber(option.yearlyGeneration),
              })}
            </p>
            <p>
              {t("howSavings", {
                offset: formatNumber(option.unitsOffset),
                tariff: `₹${tariffPerUnit}`,
                surplus: option.unitsSurplus > 0 ? t("howSurplus", { units: formatNumber(option.unitsSurplus), rate: `₹${surplusRate}` }) : "",
                savings: formatINR(option.yearlySavings),
              })}
            </p>
            {option.paybackYears !== null ? (
              <p>{t("howPayback", { net: formatINR(option.netCost), savings: formatINR(option.yearlySavings), years: formatNumber(option.paybackYears) })}</p>
            ) : null}
            <p>{t("howLifetime", { savings: formatINR(option.yearlySavings), net: formatINR(option.netCost), total: formatINR(option.savings25Years) })}</p>
          </div>
        </details>

        <a href={`/api/quotes/${token}/pdf?locale=${locale}`} download className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full")}>
          <Download aria-hidden />
          {t("downloadPdf")}
        </a>
      </section>

      {projectToken ? null : (
        <section className="mt-12 border-t pt-8">
          <h2 className="text-lg font-medium">{t("payTitle")}</h2>
          <p className="tabular mt-1 leading-relaxed text-muted-foreground">
            {t("payLead", { amount: formatINR(advance), kw: formatNumber(option.systemKw) })}
          </p>
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setFailed(false);
                const result = await payAdvanceAction(token, option.systemKw, locale);
                if (result.ok) router.push(`/s/${result.projectToken}`);
                else setFailed(true);
              })
            }
          >
            {pending ? t("paying") : t("pay", { amount: formatINR(advance) })}
          </Button>
          {failed ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {t("notFoundLead")}
            </p>
          ) : null}
          <p className="mt-2 text-center text-[0.8125rem] text-muted-foreground">{t("payNote")}</p>
        </section>
      )}
    </div>
  );
}
