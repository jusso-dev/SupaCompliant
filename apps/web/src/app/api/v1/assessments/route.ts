import { NextResponse } from "next/server";
import { demoRuns } from "@/lib/demo-data";
import { computeTechnicalPosture } from "@supacompliant/shared";

export async function GET() {
  const assessments = demoRuns.map((run) => {
    const posture = computeTechnicalPosture(
      run.results.map((r) => ({ status: r.status, severity: r.severity })),
    );
    return {
      id: run.id,
      label: run.label,
      environment: run.environment,
      status: run.status,
      completedAt: run.completedAt,
      digest: run.digest,
      posture: {
        technicalPassRate: posture.technicalPassRate,
        fail: posture.fail,
        criticalFindings: posture.criticalFindings,
        unknownOrError: posture.unknownOrError,
      },
    };
  });
  return NextResponse.json({ assessments });
}
