import { getImpact } from "@/server/impact";

export async function ImpactPanel() {
  const impact = await getImpact();
  const metrics = [
    {
      label: "Surveys that were unqualified",
      value: impact.unqualifiedPercent === null ? "No surveys yet" : `${impact.unqualifiedPercent}%`,
      note: `Target under 15%, was 40%. ${impact.surveys} surveys.`,
    },
    {
      label: "Quotes sent the same day as the survey",
      value: impact.sameDayPercent === null ? "No quotes yet" : `${impact.sameDayPercent}%`,
      note: `Target 90%, was 3 days. ${impact.quotes} quotes.`,
    },
    {
      label: "Status page views",
      value: new Intl.NumberFormat("en-IN").format(impact.statusViews),
      note: "Each view stands in for a status call avoided. Target 50% fewer calls.",
    },
  ];
  return (
    <section aria-label="Impact against client targets" className="grid gap-x-10 gap-y-5 border-b pb-6 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <p className="text-sm text-muted-foreground">{metric.label}</p>
          <p data-testid="impact-value" className="tabular mt-1 text-[1.75rem] leading-tight font-medium tracking-tight">
            {metric.value}
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">{metric.note}</p>
        </div>
      ))}
    </section>
  );
}
