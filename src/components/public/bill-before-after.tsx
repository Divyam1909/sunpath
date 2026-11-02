import { useTranslations } from "next-intl";
import { YearPlan } from "@/components/public/year-plan";
import { formatDate, formatINR } from "@/domain/format";
import type { BillProjection } from "@/domain/projection";
import type { UsageBasis } from "@/domain/usage";

interface Props {
  projection: BillProjection;
  estimated: number[];
  basis: UsageBasis;
  tariffName: string;
  tariffFrom: string;
  locale: string;
}

/** The homeowner's own bills with and without solar, on the published slab tariff. */
export function BillBeforeAfter({ projection, estimated, basis, tariffName, tariffFrom, locale }: Props) {
  const t = useTranslations("year");
  return (
    <section className="mt-9 border-t pt-7" aria-labelledby="bills-heading">
      <h2 id="bills-heading" className="text-lg font-medium">{t("title")}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4" data-testid="bill-before-after">
        <div>
          <dt className="text-sm text-muted-foreground">{t("before")}</dt>
          <dd className="tabular mt-0.5 text-[1.75rem] leading-tight font-medium tracking-tight">{formatINR(projection.monthlyBefore)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("after")}</dt>
          <dd className="tabular mt-0.5 text-[1.75rem] leading-tight font-medium tracking-tight text-primary">{formatINR(projection.monthlyAfter)}</dd>
        </div>
      </dl>
      <p className="mt-3 leading-relaxed">{t("savingLine", { amount: formatINR(projection.yearlySaving) })}</p>
      {projection.surplusUnits > 0 ? (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("surplusLine", { amount: formatINR(projection.surplusCredit) })}
        </p>
      ) : null}
      <div className="mt-5">
        <YearPlan projection={projection} estimated={estimated} basis={basis} />
      </div>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {t("tariffNote", { tariff: tariffName, date: formatDate(tariffFrom, locale) })}
      </p>
    </section>
  );
}
