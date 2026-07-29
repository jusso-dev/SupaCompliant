import Link from "next/link";
import { notFound } from "next/navigation";
import { computeTechnicalPosture } from "@supacompliant/shared";
import { demoComments, demoRuns } from "@/lib/demo-data";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = demoRuns.find((r) => r.id === runId);
  if (!run) notFound();

  const posture = computeTechnicalPosture(
    run.results.map((r) => ({ status: r.status, severity: r.severity })),
  );
  const fails = run.results.filter((r) => r.status === "fail");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/assessments" className="hover:underline">
              Assessments
            </Link>
            <span className="mx-1.5">/</span>
            {run.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {run.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.environment} · {run.postgresVersion}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/app/assessments/compare?base=${demoRuns[demoRuns.length - 2]?.id}&candidate=${run.id}`}>
              Compare
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/reports/${run.id}?format=json`}>Export JSON</a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/reports/${run.id}?format=sarif`}>Export SARIF</a>
          </Button>
          <Button asChild>
            <a href={`/api/reports/${run.id}?format=html`}>Executive HTML</a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Technical pass rate"
          value={
            posture.technicalPassRate == null
              ? "n/a"
              : `${(posture.technicalPassRate * 100).toFixed(1)}%`
          }
        />
        <Stat label="Critical fails" value={String(posture.criticalFindings)} />
        <Stat label="Unknown / error" value={String(posture.unknownOrError)} />
        <Stat label="Manual review" value={String(posture.manualReview)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report integrity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <span className="capitalize">{run.status}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Completed:</span>{" "}
            {new Date(run.completedAt).toLocaleString()}
          </p>
          <p className="break-all">
            <span className="text-muted-foreground">Digest (SHA-256):</span>{" "}
            <code className="text-xs">{run.digest}</code>
          </p>
          <p className="text-xs text-muted-foreground">
            This report provides point-in-time technical evidence and does not by
            itself constitute certification or accreditation against any
            framework.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Control results ({run.results.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Control</th>
                  <th className="pb-2 font-medium">Result</th>
                  <th className="pb-2 font-medium">Severity</th>
                  <th className="pb-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {run.results.map((r) => (
                  <tr key={r.controlId} className="border-b border-border/60 align-top">
                    <td className="py-2.5">
                      <div className="font-medium">{r.title}</div>
                      <code className="text-[11px] text-muted-foreground">
                        {r.controlId}@{r.controlVersion}
                      </code>
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2.5 capitalize text-muted-foreground">
                      {r.severity}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {fails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Failed controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fails.map((f) => (
              <div key={f.controlId} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={f.status} />
                  <span className="font-medium">{f.title}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Remediation: {f.remediation}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discussion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {demoComments.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium">
                {c.author}{" "}
                <span className="font-normal text-muted-foreground">
                  · {new Date(c.at).toLocaleString()}
                </span>
              </p>
              <p className="mt-1 text-sm">{c.body}</p>
              <code className="mt-2 block text-[11px] text-muted-foreground">
                {c.controlId}
              </code>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Comments never alter immutable technical results.
          </p>
        </CardContent>
      </Card>
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
