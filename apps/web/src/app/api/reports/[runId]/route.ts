import { NextResponse } from "next/server";
import {
  exportCsvControls,
  exportExecutiveHtml,
  exportJsonReport,
  exportSarif,
} from "@supacompliant/reporting";
import type { CompletedRun, ControlExecutionResult } from "@supacompliant/assessment-engine";
import { demoRuns } from "@/lib/demo-data";

function toCompleted(runId: string): CompletedRun | null {
  const run = demoRuns.find((r) => r.id === runId);
  if (!run) return null;
  const results: ControlExecutionResult[] = run.results.map((r) => ({
    controlId: r.controlId,
    controlVersion: r.controlVersion,
    status: r.status,
    severity: r.severity,
    summary: r.summary,
    expected: r.expected,
    actual: r.actual,
    evidence: { summary: r.evidenceSummary },
    evidenceSummary: r.evidenceSummary,
    durationMs: 0,
    categories: r.categories,
    mappings: [],
    remediation: { summary: r.remediation, steps: [] },
  }));
  return {
    manifest: {
      runId: run.id,
      organisationId: "demo-org",
      projectId: "demo-project",
      environmentId: run.environment,
      targetFingerprint: run.digest.slice(0, 16),
      postgresVersion: run.postgresVersion,
      extensions: ["plpgsql", "pgcrypto"],
      capabilities: ["basic_catalogue", "monitoring", "audit_log", "manual_evidence"],
      controlLibraryVersion: "0.1.0",
      frameworkLibraryVersion: "0.1.0",
      engineVersion: "0.1.0",
      controlSet: results.map((r) => ({
        id: r.controlId,
        version: r.controlVersion,
      })),
      startedAt: run.completedAt,
      frameworkPacks: ["ism", "essential-eight", "cis-postgresql"],
    },
    results,
    completedAt: run.completedAt,
    digest: run.digest,
    status: "completed",
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";
  const completed = toCompleted(runId);
  if (!completed) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (format === "csv") {
    return new NextResponse(exportCsvControls(completed.results), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${runId}.csv"`,
      },
    });
  }
  if (format === "sarif") {
    return new NextResponse(exportSarif(completed), {
      headers: {
        "Content-Type": "application/sarif+json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${runId}.sarif.json"`,
      },
    });
  }
  if (format === "html") {
    return new NextResponse(exportExecutiveHtml(completed), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new NextResponse(exportJsonReport(completed), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${runId}.json"`,
    },
  });
}
