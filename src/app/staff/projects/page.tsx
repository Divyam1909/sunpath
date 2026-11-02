import Link from "next/link";
import { STAGE_LABELS } from "@/components/staff/labels";
import { formatINR, formatNumber } from "@/domain/format";
import { checkStuck, FINAL_STAGE, STAGES, type Stage } from "@/domain/project";
import { db } from "@/server/db";
import { forecastFor, loadDurations } from "@/server/forecast";
import { requireStaff } from "@/server/guards";
import { savingsChecksBehind } from "@/server/savings";
import { getSettings } from "@/server/settings";

export default async function ProjectsPage() {
  await requireStaff();
  const [projects, settings, durations, behind] = await Promise.all([
    db.project.findMany({ include: { lead: { select: { name: true } } }, orderBy: { stageEnteredAt: "asc" } }),
    getSettings(),
    loadDurations(),
    savingsChecksBehind(),
  ]);
  const now = new Date();
  const rows = projects.map((project) => ({
    ...project,
    stageNumber: STAGES.indexOf(project.stage as Stage) + 1,
    check: checkStuck(project.stage as Stage, project.stageEnteredAt, settings.stageSlaDays, now),
    forecast: forecastFor(project, durations, settings, now),
  }));
  const stuck = rows.filter((row) => row.check.stuck).sort((a, b) => b.check.overdueBy - a.check.overdueBy);
  const active = rows.filter((row) => row.stage !== FINAL_STAGE).length;
  const slipping = rows
    .filter((row) => row.forecast?.slips && !row.check.stuck)
    .sort((a, b) => (b.forecast?.slipDays ?? 0) - (a.forecast?.slipDays ?? 0));

  return (
    <div className="grid gap-9">
      <section aria-labelledby="stuck-heading">
        <h1 id="stuck-heading" className="text-xl font-medium">
          Stuck projects <span className="tabular ml-1 text-muted-foreground" data-testid="stuck-count">{stuck.length}</span>
        </h1>
        {stuck.length === 0 ? (
          <p className="mt-3 rounded-xl bg-muted px-6 py-10 text-center font-medium">No stuck projects 🎉</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stuck.map((row) => (
              <li key={row.id}>
                <Link href={`/staff/projects/${row.id}`} data-testid="stuck-project" className="block h-full rounded-lg border border-destructive/40 p-4 transition-colors hover:border-destructive">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{row.lead.name}</span>
                    <span className="tabular text-sm font-medium text-destructive">{row.check.overdueBy} days over</span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {STAGE_LABELS[row.stage]}, {row.check.days} days against a {row.check.slaDays}-day limit
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {slipping.length > 0 ? (
        <section aria-labelledby="slip-heading">
          <h2 id="slip-heading" className="text-lg font-medium">
            Likely to slip <span className="tabular ml-1 text-muted-foreground" data-testid="slip-count">{slipping.length}</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Not late yet, but they will pass the promised date if stages run as they have so far.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {slipping.map((row) => (
              <li key={row.id}>
                <Link href={`/staff/projects/${row.id}`} data-testid="slipping-project" className="block h-full rounded-lg border p-4 transition-colors hover:border-foreground/40">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{row.lead.name}</span>
                    <span className="tabular text-sm font-medium">{row.forecast!.slipDays} days late</span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Likely {row.forecast!.likely}, promised {row.forecast!.promised}.
                    {row.forecast!.slowest ? ` ${STAGE_LABELS[row.forecast!.slowest.stage]} usually takes ${row.forecast!.slowest.typicalDays} days, not ${row.forecast!.slowest.slaDays}.` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {behind.length > 0 ? (
        <section aria-labelledby="behind-heading">
          <h2 id="behind-heading" className="text-lg font-medium">
            Savings behind the quote <span className="tabular ml-1 text-muted-foreground" data-testid="behind-count">{behind.length}</span>
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {behind.map((check) => (
              <li key={check.id}>
                <Link href={`/staff/projects/${check.project.id}`} data-testid="behind-project" className="block h-full rounded-lg border border-destructive/40 p-4 transition-colors hover:border-destructive">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{check.project.lead.name}</span>
                    <span className="tabular text-sm font-medium text-destructive">{Math.round(check.ratio * 100)}%</span>
                  </span>
                  <span className="tabular mt-1 block text-sm text-muted-foreground">
                    {check.month}: saved {formatINR(check.actualSaving)} of {formatINR(check.promisedSaving)} promised. Check the system.
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="text-lg font-medium">
          All projects <span className="tabular ml-1 text-muted-foreground">{active} active</span>
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl bg-muted px-6 py-10 text-center text-muted-foreground">Projects appear here when a customer pays an advance.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-normal">Project</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Stage</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">In stage</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Likely finish</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">System</th>
                  <th scope="col" className="py-2 text-right font-normal">Net cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/60">
                    <td className="py-3 pr-4">
                      <Link href={`/staff/projects/${row.id}`} className="font-medium underline-offset-4 hover:underline">{row.lead.name}</Link>
                      <div className="text-[0.8125rem] text-muted-foreground">{row.code}</div>
                    </td>
                    <td className="py-3 pr-4">
                      {STAGE_LABELS[row.stage]} <span className="tabular text-muted-foreground">({row.stageNumber} of {STAGES.length})</span>
                    </td>
                    <td className={`tabular py-3 pr-4 text-right ${row.check.stuck ? "font-medium text-destructive" : ""}`}>
                      {row.stage === FINAL_STAGE ? "Done" : `${row.check.days} of ${row.check.slaDays} days`}
                    </td>
                    <td className={`tabular py-3 pr-4 text-right ${row.forecast?.slips ? "font-medium" : ""}`}>{row.forecast?.likely ?? "-"}</td>
                    <td className="tabular py-3 pr-4 text-right">{formatNumber(row.systemKw)} kW</td>
                    <td className="tabular py-3 text-right">{formatINR(row.netCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
