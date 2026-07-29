import { latestRun } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export default function EvidencePage() {
  const sample = latestRun.results.slice(0, 20);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Safe summaries only. Credentials redacted. Full structured evidence
          retained server-side with access audit.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Latest run evidence summaries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sample.map((r) => (
            <div
              key={r.controlId}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.evidenceSummary}
                </p>
                <code className="mt-1 block text-[11px] text-muted-foreground">
                  {r.controlId}
                </code>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
