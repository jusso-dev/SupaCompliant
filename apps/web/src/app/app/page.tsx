import Link from "next/link";
import {
  demoComments,
  demoFindings,
  demoRuns,
  latestPosture,
  latestRun,
  previousPosture,
} from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export default function OverviewPage() {
  const posture = latestPosture();
  const prev = previousPosture();
  const passDelta =
    posture.technicalPassRate != null && prev.technicalPassRate != null
      ? posture.technicalPassRate - prev.technicalPassRate
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest posture for production · run {latestRun.id}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/assessments">View assessments</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Technical pass rate"
          value={
            posture.technicalPassRate == null
              ? "n/a"
              : `${(posture.technicalPassRate * 100).toFixed(1)}%`
          }
          hint={
            passDelta == null
              ? "vs previous run"
              : `${passDelta >= 0 ? "+" : ""}${(passDelta * 100).toFixed(1)} pts vs previous`
          }
        />
        <Metric
          label="Critical findings"
          value={String(posture.criticalFindings)}
          hint={`${posture.fail} total fails · ${posture.highFindings} high`}
        />
        <Metric
          label="Unknown / error"
          value={String(posture.unknownOrError)}
          hint="Never counted as pass"
        />
        <Metric
          label="Manual review open"
          value={String(posture.manualReview)}
          hint="Organisational evidence still required"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent assessment runs</CardTitle>
            <Link
              href="/app/assessments"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Run</th>
                    <th className="pb-2 font-medium">Environment</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Completed</th>
                    <th className="pb-2 font-medium">Digest</th>
                  </tr>
                </thead>
                <tbody>
                  {[...demoRuns].reverse().map((run) => (
                    <tr key={run.id} className="border-b border-border/70">
                      <td className="py-2.5">
                        <Link
                          href={`/app/assessments/${run.id}`}
                          className="font-medium hover:underline"
                        >
                          {run.label}
                        </Link>
                      </td>
                      <td className="py-2.5 capitalize text-muted-foreground">
                        {run.environment}
                      </td>
                      <td className="py-2.5 capitalize">{run.status}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {new Date(run.completedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">
                        {run.digest.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open findings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoFindings.slice(0, 5).map((f) => (
              <div key={f.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{f.title}</p>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {f.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.status.replaceAll("_", " ")} · {f.owner}
                </p>
              </div>
            ))}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/app/findings">All findings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Control result distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(
              [
                ["pass", posture.pass],
                ["fail", posture.fail],
                ["warning", posture.warning],
                ["manual_review", posture.manualReview],
                ["unknown", posture.unknown],
                ["error", posture.error],
                ["not_applicable", posture.notApplicable],
                ["not_assessed", posture.notAssessed],
              ] as const
            ).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <StatusBadge status={status} />
                <span className="font-medium tabular-nums">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent team activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {demoComments.map((c) => (
              <div key={c.id} className="border-b border-border/70 pb-3 last:border-0">
                <p className="text-sm">
                  <span className="font-medium">{c.author}</span>
                  <span className="text-muted-foreground"> on </span>
                  <code className="text-xs">{c.controlId}</code>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(c.at).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Point-in-time technical evidence only. Not certification or accreditation
        against any framework. Unknown and error results are never treated as
        pass.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
