import Link from "next/link";
import { STAGE_LABELS } from "@/components/staff/labels";
import { formatINR, formatNumber } from "@/domain/format";
import { checkStuck, FINAL_STAGE, STAGES, type Stage } from "@/domain/project";
import { db } from "@/server/db";
import { requireStaff } from "@/server/guards";
import { getSettings } from "@/server/settings";

export default async function ProjectsPage() {
  await requireStaff();
  const [projects, settings] = await Promise.all([
    db.project.findMany({ include: { lead: { select: { name: true } } }, orderBy: { stageEnteredAt: "asc" } }),
    getSettings(),
  ]);
  const now = new Date();
  const rows = projects.map((project) => ({
    ...project,
    stageNumber: STAGES.indexOf(project.stage as Stage) + 1,
    check: checkStuck(project.stage as Stage, project.stageEnteredAt, settings.stageSlaDays, now),
  }));
  const stuck = rows.filter((row) => row.check.stuck).sort((a, b) => b.check.overdueBy - a.check.overdueBy);
  const active = rows.filter((row) => row.stage !== FINAL_STAGE).length;

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
                <Link href={`/staff/projects/${row.id}`} data-testid="stuck-project" className="block rounded-lg border border-destructive/40 p-4 transition-colors hover:border-destructive">
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

      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="text-lg font-medium">
          All projects <span className="tabular ml-1 text-muted-foreground">{active} active</span>
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl bg-muted px-6 py-10 text-center text-muted-foreground">Projects appear here when a customer pays an advance.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-normal">Project</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Stage</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">In stage</th>
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
