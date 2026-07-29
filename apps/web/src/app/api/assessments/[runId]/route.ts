import { NextResponse } from "next/server";
import { getRun, updateRun } from "@/lib/assessments/run-store";
import { computeTechnicalPosture } from "@supacompliant/shared";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const posture = run.result
    ? computeTechnicalPosture(
        run.result.results.map((r) => ({
          status: r.status,
          severity: r.severity,
        })),
      )
    : null;

  return NextResponse.json({
    id: run.id,
    status: run.status,
    progress: run.progress,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    digest: run.result?.digest,
    posture,
    // Full results only when complete — still no connection secrets
    resultCount: run.result?.results.length ?? 0,
    results:
      run.status === "completed" || run.status === "failed"
        ? run.result?.results.map((r) => ({
            controlId: r.controlId,
            controlVersion: r.controlVersion,
            status: r.status,
            severity: r.severity,
            summary: r.summary,
            evidenceSummary: r.evidenceSummary,
          }))
        : undefined,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (
    run.status === "completed" ||
    run.status === "failed" ||
    run.status === "cancelled"
  ) {
    return NextResponse.json(
      { error: "Run already finished" },
      { status: 409 },
    );
  }
  updateRun(runId, { cancelRequested: true });
  return NextResponse.json({ ok: true, message: "Cancel requested" });
}
