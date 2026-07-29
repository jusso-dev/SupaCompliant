import Link from "next/link";
import { compareReports } from "@supacompliant/reporting";
import { demoRuns } from "@/lib/demo-data";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ControlExecutionResult } from "@supacompliant/assessment-engine";

function toExecution(
  r: (typeof demoRuns)[0]["results"][0],
): ControlExecutionResult {
  return {
    controlId: r.controlId,
    controlVersion: r.controlVersion,
    status: r.status,
    severity: r.severity,
    summary: r.summary,
    expected: r.expected,
    actual: r.actual,
    evidence: {},
    evidenceSummary: r.evidenceSummary,
    durationMs: 0,
    categories: r.categories,
    mappings: [],
    remediation: { summary: r.remediation, steps: [] },
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string; candidate?: string }>;
}) {
  const sp = await searchParams;
  const base =
    demoRuns.find((r) => r.id === sp.base) ?? demoRuns[demoRuns.length - 2]!;
  const candidate =
    demoRuns.find((r) => r.id === sp.candidate) ??
    demoRuns[demoRuns.length - 1]!;

  const cmp = compareReports(
    base.id,
    base.results.map(toExecution),
    candidate.id,
    candidate.results.map(toExecution),
  );

  const interesting = cmp.deltas.filter((d) => d.kind !== "unchanged");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/app/assessments" className="hover:underline">
            Assessments
          </Link>
          <span className="mx-1.5">/</span>
          Compare
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Report comparison
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {base.label} → {candidate.label}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Regressions" value={String(cmp.summary.regressions)} />
        <Stat label="Resolved" value={String(cmp.summary.resolved)} />
        <Stat label="New controls" value={String(cmp.summary.newControls)} />
        <Stat
          label="Status changed"
          value={String(cmp.summary.statusChanged)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Changes ({interesting.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Control</th>
                  <th className="pb-2 font-medium">Kind</th>
                  <th className="pb-2 font-medium">Baseline</th>
                  <th className="pb-2 font-medium">Candidate</th>
                  <th className="pb-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {interesting.map((d) => (
                  <tr key={d.controlId} className="border-b border-border/60 align-top">
                    <td className="py-2.5">
                      <code className="text-xs">{d.controlId}</code>
                      {d.baselineVersion !== d.candidateVersion && (
                        <p className="text-[11px] text-muted-foreground">
                          v{d.baselineVersion} → v{d.candidateVersion}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 capitalize">
                      {d.kind.replaceAll("_", " ")}
                    </td>
                    <td className="py-2.5">
                      {d.baselineStatus ? (
                        <StatusBadge status={d.baselineStatus} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5">
                      {d.candidateStatus ? (
                        <StatusBadge status={d.candidateStatus} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {d.notes.join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Regressions where the control version also changed are annotated so
        evaluator evolution is not mistaken for pure target posture change.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
