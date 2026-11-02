import { CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Blocker } from "@/domain/blockers";
import { formatINR, formatNumber } from "@/domain/format";

export function blockerValues(blocker: Blocker) {
  const { params } = blocker;
  return {
    onBill: params.onBill ?? "",
    amount: typeof params.amount === "number" ? formatINR(params.amount) : "",
    loadKw: typeof params.loadKw === "number" ? formatNumber(params.loadKw) : "",
    wantedKw: typeof params.wantedKw === "number" ? formatNumber(params.wantedKw) : "",
    status: params.status ?? "",
  };
}

/** What to fix now, in plain words. Each item says what to do, so none of it reads as a rejection. */
export function BlockerList({ blockers }: { blockers: Blocker[] }) {
  const t = useTranslations("blockers");
  if (blockers.length === 0) return null;
  return (
    <section data-testid="blockers" className="mt-8 rounded-xl border p-5">
      <h2 className="font-medium">{t("title")}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("lead")}</p>
      <ul className="mt-4 grid gap-4">
        {blockers.map((blocker) => {
          const Icon = blocker.severity === "STOPS" ? CircleAlert : TriangleAlert;
          return (
            <li key={blocker.code} className="flex gap-3" data-blocker={blocker.code}>
              <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${blocker.severity === "STOPS" ? "text-destructive" : "text-muted-foreground"}`} />
              <div>
                <p className="font-medium">{t(`${blocker.code}.title`, blockerValues(blocker))}</p>
                <p className="mt-0.5 text-sm leading-relaxed">{t(`${blocker.code}.fix`, blockerValues(blocker))}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
