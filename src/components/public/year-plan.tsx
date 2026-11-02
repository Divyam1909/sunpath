import { useFormatter, useTranslations } from "next-intl";
import { formatINR, formatNumber } from "@/domain/format";
import type { BillProjection } from "@/domain/projection";
import type { UsageBasis } from "@/domain/usage";

const WIDTH = 640;
const HEIGHT = 200;
const BASELINE = 165;
const TOP = 12;
const USE_COLOUR = "#2a8c85";
const SUN_COLOUR = "#b8740c";

interface Props {
  projection: BillProjection;
  /** Calendar months the bill did not print, so the chart can show them as estimates. */
  estimated: number[];
  basis: UsageBasis;
}

/** A year of use against sun. The gap is what the net meter's banking carries across the monsoon. */
export function YearPlan({ projection, estimated, basis }: Props) {
  const t = useTranslations("year");
  const format = useFormatter();
  const { months } = projection;
  const peak = Math.max(...months.flatMap((m) => [m.use, m.generation]), 1);
  const y = (units: number) => BASELINE - ((BASELINE - TOP) * units) / peak;
  const step = WIDTH / months.length;
  const barWidth = Math.min(step - 10, 30);
  const monthName = (index: number, month: "short" | "long" = "short") => format.dateTime(new Date(Date.UTC(2026, index, 15)), { month, timeZone: "UTC" });
  const line = months.map((m, i) => `${i === 0 ? "M" : "L"}${(step * i + step / 2).toFixed(1)} ${y(m.generation).toFixed(1)}`).join(" ");

  return (
    <div data-testid="year-plan">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><i aria-hidden className="size-3 rounded-sm" style={{ background: USE_COLOUR }} />{t("legendUse")}</span>
        <span className="flex items-center gap-1.5"><i aria-hidden className="h-0.5 w-4" style={{ background: SUN_COLOUR }} />{t("legendSun")}</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t("chartLabel")} className="mt-3 w-full">
        <line x1="0" x2={WIDTH} y1={BASELINE} y2={BASELINE} stroke="currentColor" strokeOpacity="0.2" />
        {months.map((m, i) => {
          const x = step * i + (step - barWidth) / 2;
          const isEstimate = estimated.includes(m.index);
          return (
            <g key={m.index} tabIndex={0} className="outline-none focus-visible:opacity-70">
              <title>{t("monthTip", { month: monthName(m.index, "long"), use: formatNumber(m.use), sun: formatNumber(m.generation) })}</title>
              <rect x={step * i} y="0" width={step} height={HEIGHT} fill="transparent" />
              <rect x={x} y={y(m.use)} width={barWidth} height={Math.max(BASELINE - y(m.use), 1)} rx="3" fill={USE_COLOUR} fillOpacity={isEstimate ? 0.4 : 1} />
              <text x={step * i + step / 2} y={HEIGHT - 10} textAnchor="middle" className="fill-muted-foreground text-[19px]">{monthName(m.index)}</text>
            </g>
          );
        })}
        <path d={line} fill="none" stroke={SUN_COLOUR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {months.map((m, i) => (
          <circle key={m.index} cx={step * i + step / 2} cy={y(m.generation)} r="3.5" fill={SUN_COLOUR} stroke="white" strokeWidth="2" />
        ))}
      </svg>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`basis.${basis}`)}</p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-medium">{t("tableView")}</summary>
        <table className="tabular mt-2 w-full">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-1.5 text-left font-normal">{t("colMonth")}</th>
              <th scope="col" className="py-1.5 text-right font-normal">{t("colUse")}</th>
              <th scope="col" className="py-1.5 text-right font-normal">{t("colSun")}</th>
              <th scope="col" className="py-1.5 text-right font-normal">{t("colBefore")}</th>
              <th scope="col" className="py-1.5 text-right font-normal">{t("colAfter")}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.index} className="border-b last:border-0">
                <th scope="row" className="py-1.5 text-left font-normal">{monthName(m.index, "long")}{estimated.includes(m.index) ? " *" : ""}</th>
                <td className="py-1.5 text-right">{formatNumber(m.use)}</td>
                <td className="py-1.5 text-right">{formatNumber(m.generation)}</td>
                <td className="py-1.5 text-right">{formatINR(Math.round(m.before))}</td>
                <td className="py-1.5 text-right">{formatINR(Math.round(m.after))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {estimated.length > 0 ? <p className="mt-1 text-muted-foreground">* {t("estimateNote")}</p> : null}
      </details>
    </div>
  );
}
