import Link from "next/link";
import { ImpactPanel } from "@/components/staff/impact-panel";
import { LEAD_STAGE_LABELS, ScoreBadge } from "@/components/staff/labels";
import { maskConsumerNumber, type ConfirmedBill } from "@/domain/bill";
import { daysAgo, formatINR, formatNumber, istDate } from "@/domain/format";
import type { ScoreReason } from "@/domain/score";
import type { LeadStage, Score } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { requireStaff } from "@/server/guards";

const SCORES = ["HIGH", "MEDIUM", "LOW"];
const WINDOWS: Record<string, number> = { "7": 7, "30": 30 };

function nextStep(lead: { stage: string; nextAction: string | null }) {
  if (lead.stage === "NEW") return "Wait for bill";
  if (lead.stage === "SCORED") return lead.nextAction === "SURVEY_VISIT" ? "Book survey" : "Call";
  if (lead.stage === "SURVEY_BOOKED") return "Record survey";
  if (lead.stage === "SURVEYED") return "Build quote";
  if (lead.stage === "QUOTED") return "Follow up";
  return "None";
}

/** Up to two reasons, most useful first: problems, then caveats, then the bill. */
const leadReasons = (reasons: unknown) => {
  const list = (reasons ?? []) as ScoreReason[];
  const rank = (r: ScoreReason) => (r.tone === "problem" ? 0 : r.tone === "note" ? 1 : r.code === "strongBill" ? 2 : 3);
  return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, 2).map((r) => r.text).join(". ");
};

export default async function LeadsPage({ searchParams }: PageProps<"/staff/leads">) {
  await requireStaff();
  const params = await searchParams;
  const score = SCORES.includes(params.score as string) ? (params.score as Score) : undefined;
  const stage = typeof params.stage === "string" && params.stage in LEAD_STAGE_LABELS ? (params.stage as LeadStage) : undefined;
  const days = WINDOWS[params.days as string];

  const leads = await db.lead.findMany({
    where: {
      score,
      stage,
      createdAt: days ? { gte: daysAgo(days) } : undefined,
    },
    orderBy: [{ score: "asc" }, { createdAt: "desc" }],
    include: { bills: { orderBy: { createdAt: "desc" }, take: 1, select: { confirmed: true } } },
    take: 200,
  });

  const selectClass = "h-10 rounded-lg border border-input bg-background px-2.5 text-sm";

  return (
    <div className="grid gap-6">
      <ImpactPanel />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-medium">Leads</h1>
        <form className="flex flex-wrap items-center gap-2" method="get">
          <select name="score" defaultValue={score ?? ""} aria-label="Score" className={selectClass}>
            <option value="">All scores</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select name="stage" defaultValue={stage ?? ""} aria-label="Stage" className={selectClass}>
            <option value="">All stages</option>
            {Object.entries(LEAD_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="days" defaultValue={days ? String(days) : ""} aria-label="Received" className={selectClass}>
            <option value="">Any date</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <button className="h-10 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Apply</button>
        </form>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl bg-muted px-6 py-12 text-center">
          <p className="font-medium">No leads match these filters</p>
          <Link href="/staff/leads" className="mt-1 inline-block text-sm text-primary underline underline-offset-4">
            Clear filters
          </Link>
        </div>
      ) : (
        <>
        <ul className="grid gap-3 md:hidden">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded-lg border p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/staff/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline">{lead.name}</Link>
                <ScoreBadge score={lead.score} />
              </div>
              <p className="mt-1 text-muted-foreground">{leadReasons(lead.scoreReasons)}</p>
              <p className="tabular mt-2">
                {formatINR(lead.monthlyBill)}{lead.recommendedKw ? `, ${formatNumber(lead.recommendedKw)} kW` : ""}. Next: <span className="font-medium">{nextStep(lead)}</span>
              </p>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-normal">Lead</th>
                <th scope="col" className="py-2 pr-4 font-normal">Score</th>
                <th scope="col" className="py-2 pr-4 font-normal">Why</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Bill</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Size</th>
                <th scope="col" className="py-2 pr-4 font-normal">Consumer</th>
                <th scope="col" className="py-2 pr-4 font-normal">Stage</th>
                <th scope="col" className="py-2 pr-4 font-normal">Next step</th>
                <th scope="col" className="py-2 font-normal">Received</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const bill = lead.bills[0]?.confirmed as ConfirmedBill | null | undefined;
                return (
                  <tr key={lead.id} data-testid="lead-row" className="border-b align-top hover:bg-muted/60">
                    <td className="py-3 pr-4">
                      <Link href={`/staff/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline">
                        {lead.name}
                      </Link>
                      <div className="text-[0.8125rem] text-muted-foreground">{lead.code}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="max-w-64 py-3 pr-4 text-muted-foreground">{leadReasons(lead.scoreReasons)}</td>
                    <td className="tabular py-3 pr-4 text-right">{formatINR(lead.monthlyBill)}</td>
                    <td className="tabular py-3 pr-4 text-right">{lead.recommendedKw ? `${formatNumber(lead.recommendedKw)} kW` : "-"}</td>
                    <td className="tabular py-3 pr-4 text-muted-foreground">{bill ? maskConsumerNumber(bill.consumerNumber) : "-"}</td>
                    <td className="py-3 pr-4">{LEAD_STAGE_LABELS[lead.stage]}</td>
                    <td className="py-3 pr-4 font-medium">{nextStep(lead)}</td>
                    <td className="tabular py-3 whitespace-nowrap text-muted-foreground">{istDate(lead.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
