import Link from "next/link";
import { demoRuns, latestPosture } from "@/lib/demo-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeTechnicalPosture } from "@supacompliant/shared";

export default function AssessmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable point-in-time runs with cryptographic digests
          </p>
        </div>
        <Button>New assessment</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Run</th>
                  <th className="pb-2 font-medium">Environment</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Pass rate</th>
                  <th className="pb-2 font-medium">Fails</th>
                  <th className="pb-2 font-medium">Digest</th>
                </tr>
              </thead>
              <tbody>
                {[...demoRuns].reverse().map((run) => {
                  const p = computeTechnicalPosture(
                    run.results.map((r) => ({
                      status: r.status,
                      severity: r.severity,
                    })),
                  );
                  return (
                    <tr key={run.id} className="border-b border-border/70">
                      <td className="py-3">
                        <Link
                          className="font-medium hover:underline"
                          href={`/app/assessments/${run.id}`}
                        >
                          {run.label}
                        </Link>
                      </td>
                      <td className="py-3 capitalize text-muted-foreground">
                        {run.environment}
                      </td>
                      <td className="py-3 capitalize">{run.status}</td>
                      <td className="py-3 tabular-nums">
                        {p.technicalPassRate == null
                          ? "n/a"
                          : `${(p.technicalPassRate * 100).toFixed(1)}%`}
                      </td>
                      <td className="py-3 tabular-nums">{p.fail}</td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {run.digest.slice(0, 16)}…
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Latest posture pass rate:{" "}
        {latestPosture().technicalPassRate == null
          ? "n/a"
          : `${(latestPosture().technicalPassRate! * 100).toFixed(1)}%`}
        . Completed runs cannot be edited; manual dispositions create new
        snapshots.
      </p>
    </div>
  );
}
