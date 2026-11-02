import { istDate } from "@/domain/format";
import { db } from "@/server/db";
import { savingsTotals } from "@/server/savings";

const percent = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100));

/** The client's three success metrics, computed from live records. */
export async function getImpact() {
  const [surveys, unqualified, surveyedWithQuotes, views, savings] = await Promise.all([
    db.lead.count({ where: { surveyedAt: { not: null } } }),
    db.lead.count({ where: { surveyQualified: false } }),
    db.lead.findMany({
      where: { surveyedAt: { not: null }, quotes: { some: { sentAt: { not: null } } } },
      select: { surveyedAt: true, quotes: { select: { sentAt: true }, orderBy: { sentAt: "asc" }, take: 1 } },
    }),
    db.project.aggregate({ _sum: { statusViews: true } }),
    savingsTotals(),
  ]);
  const sameDay = surveyedWithQuotes.filter((lead) => istDate(lead.surveyedAt!) === istDate(lead.quotes[0].sentAt!)).length;
  return {
    surveys,
    unqualifiedPercent: percent(unqualified, surveys),
    quotes: surveyedWithQuotes.length,
    sameDayPercent: percent(sameDay, surveyedWithQuotes.length),
    statusViews: views._sum.statusViews ?? 0,
    savings,
  };
}
