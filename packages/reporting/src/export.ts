import type {
  CompletedRun,
  ControlExecutionResult,
} from "@supacompliant/assessment-engine";
import { computeTechnicalPosture } from "@supacompliant/shared";

export const REPORT_QUALIFICATION =
  "This report provides point-in-time technical evidence and does not by itself constitute certification or accreditation against any framework.";

export function exportJsonReport(run: CompletedRun): string {
  const posture = computeTechnicalPosture(
    run.results.map((r) => ({ status: r.status, severity: r.severity })),
  );
  return JSON.stringify(
    {
      qualification: REPORT_QUALIFICATION,
      digest: run.digest,
      completedAt: run.completedAt,
      status: run.status,
      manifest: run.manifest,
      posture,
      results: run.results.map(stripHeavy),
    },
    null,
    2,
  );
}

function stripHeavy(r: ControlExecutionResult) {
  return {
    controlId: r.controlId,
    controlVersion: r.controlVersion,
    status: r.status,
    severity: r.severity,
    summary: r.summary,
    expected: r.expected,
    actual: r.actual,
    evidenceSummary: r.evidenceSummary,
    categories: r.categories,
    durationMs: r.durationMs,
  };
}

export function exportCsvControls(results: ControlExecutionResult[]): string {
  const header = [
    "control_id",
    "version",
    "status",
    "severity",
    "summary",
    "expected",
    "actual",
    "categories",
  ];
  const lines = [header.join(",")];
  for (const r of results) {
    lines.push(
      [
        r.controlId,
        r.controlVersion,
        r.status,
        r.severity,
        csvEscape(r.summary),
        csvEscape(r.expected),
        csvEscape(r.actual),
        csvEscape(r.categories.join("|")),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** SARIF 2.1.0 minimal export for CI */
export function exportSarif(run: CompletedRun): string {
  const results = run.results
    .filter((r) => r.status === "fail" || r.status === "warning")
    .map((r) => ({
      ruleId: r.controlId,
      level: r.status === "fail" ? "error" : "warning",
      message: { text: r.summary },
      properties: {
        severity: r.severity,
        expected: r.expected,
        actual: r.actual,
        controlVersion: r.controlVersion,
      },
    }));

  const rules = run.results.map((r) => ({
    id: r.controlId,
    name: r.controlId,
    shortDescription: { text: r.summary },
    properties: { version: r.controlVersion, severity: r.severity },
  }));

  return JSON.stringify(
    {
      $schema:
        "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "SupaCompliant",
              informationUri: "https://github.com/supacompliant/supacompliant",
              version: run.manifest.engineVersion,
              rules,
            },
          },
          results,
          properties: {
            digest: run.digest,
            qualification: REPORT_QUALIFICATION,
          },
        },
      ],
    },
    null,
    2,
  );
}

export function exportExecutiveHtml(run: CompletedRun): string {
  const posture = computeTechnicalPosture(
    run.results.map((r) => ({ status: r.status, severity: r.severity })),
  );
  const critical = run.results.filter(
    (r) => r.status === "fail" && r.severity === "critical",
  );
  const rate =
    posture.technicalPassRate == null
      ? "n/a"
      : `${(posture.technicalPassRate * 100).toFixed(1)}%`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>SupaCompliant Executive Report</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;margin:2rem;line-height:1.5;background:#fafaf9}
    h1{font-size:1.5rem;margin:0 0 .25rem}
    .muted{color:#64748b;font-size:.9rem}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:1rem 1.25rem;margin:1rem 0}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem}
    .metric strong{display:block;font-size:1.4rem}
    .warn{border-left:4px solid #d97706}
    .fail{border-left:4px solid #dc2626}
    table{width:100%;border-collapse:collapse;font-size:.9rem}
    th,td{text-align:left;padding:.5rem;border-bottom:1px solid #e2e8f0}
    .badge{display:inline-block;padding:.1rem .45rem;border-radius:4px;background:#f1f5f9;font-size:.75rem}
  </style>
</head>
<body>
  <h1>SupaCompliant executive report</h1>
  <p class="muted">Continuous database assurance for Supabase and PostgreSQL</p>
  <p class="muted"><strong>Qualification:</strong> ${REPORT_QUALIFICATION}</p>
  <div class="card">
    <div class="grid">
      <div class="metric"><span class="muted">Technical pass rate</span><strong>${rate}</strong></div>
      <div class="metric"><span class="muted">Critical fails</span><strong>${posture.criticalFindings}</strong></div>
      <div class="metric"><span class="muted">Unknown / error</span><strong>${posture.unknownOrError}</strong></div>
      <div class="metric"><span class="muted">Manual review</span><strong>${posture.manualReview}</strong></div>
    </div>
  </div>
  <div class="card">
    <p><span class="badge">Run</span> ${run.manifest.runId}</p>
    <p><span class="badge">Digest</span> <code>${run.digest}</code></p>
    <p><span class="badge">Target</span> ${run.manifest.targetFingerprint}</p>
    <p><span class="badge">PostgreSQL</span> ${escapeHtml(run.manifest.postgresVersion)}</p>
    <p><span class="badge">Completed</span> ${run.completedAt}</p>
  </div>
  <div class="card ${critical.length ? "fail" : ""}">
    <h2>Material risks (critical failures)</h2>
    ${
      critical.length === 0
        ? "<p class='muted'>No critical technical failures recorded.</p>"
        : `<ul>${critical
            .map(
              (c) =>
                `<li><strong>${escapeHtml(c.controlId)}</strong> — ${escapeHtml(c.summary)}</li>`,
            )
            .join("")}</ul>`
    }
  </div>
  <div class="card warn">
    <h2>Limitations</h2>
    <ul>
      <li>Unknown and error results are never treated as pass.</li>
      <li>Framework views show contribution only — not certification.</li>
      <li>Manual review items require organisational evidence.</li>
    </ul>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
