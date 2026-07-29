import type { CompletedRun } from "@supacompliant/assessment-engine";
import { computeTechnicalPosture } from "@supacompliant/shared";
import { REPORT_QUALIFICATION } from "./export.js";

/**
 * Minimal PDF 1.4 generator (no external deps).
 * Text-only pages suitable for executive/technical downloads.
 */
export function exportPdfReport(
  run: CompletedRun,
  kind: "executive" | "technical",
): Buffer {
  const posture = computeTechnicalPosture(
    run.results.map((r) => ({ status: r.status, severity: r.severity })),
  );
  const rate =
    posture.technicalPassRate == null
      ? "n/a"
      : `${(posture.technicalPassRate * 100).toFixed(1)}%`;

  const lines: string[] = [
    "SupaCompliant report",
    kind === "executive" ? "Executive summary" : "Technical report",
    "",
    "NOT AFFILIATED WITH SUPABASE, INC.",
    "Independent open-source project — not an official Supabase product.",
    "",
    REPORT_QUALIFICATION,
    "",
    `Run: ${run.manifest.runId}`,
    `Digest: ${run.digest}`,
    `Completed: ${run.completedAt}`,
    `PostgreSQL: ${run.manifest.postgresVersion}`,
    `Status: ${run.status}`,
    "",
    `Technical pass rate: ${rate}`,
    `Critical fails: ${posture.criticalFindings}`,
    `Fails: ${posture.fail}`,
    `Unknown/error: ${posture.unknownOrError}`,
    `Manual review: ${posture.manualReview}`,
    "",
  ];

  if (kind === "technical") {
    lines.push("Control results:");
    for (const r of run.results.slice(0, 80)) {
      lines.push(
        `- ${r.controlId} [${r.status}/${r.severity}] ${r.summary}`.slice(
          0,
          110,
        ),
      );
    }
    if (run.results.length > 80) {
      lines.push(`… ${run.results.length - 80} more controls in JSON export`);
    }
  } else {
    const critical = run.results.filter(
      (r) => r.status === "fail" && r.severity === "critical",
    );
    lines.push("Material risks (critical failures):");
    if (critical.length === 0) lines.push("- None recorded");
    else
      for (const c of critical.slice(0, 20)) {
        lines.push(`- ${c.controlId}: ${c.summary}`.slice(0, 110));
      }
  }

  return buildSimplePdf(lines);
}

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Buffer {
  const contentLines = ["BT", "/F1 10 Tf", "50 780 Td", "14 TL"];
  for (const line of lines) {
    contentLines.push(`(${escapePdfText(line)}) Tj`, "T*");
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push(
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
