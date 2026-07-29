import { describe, expect, it } from "vitest";
import { exportPdfReport } from "./pdf.js";
import type { CompletedRun } from "@supacompliant/assessment-engine";

const run: CompletedRun = {
  manifest: {
    runId: "r1",
    organisationId: "o",
    projectId: "p",
    environmentId: "e",
    targetFingerprint: "fp",
    postgresVersion: "PostgreSQL 16",
    extensions: [],
    capabilities: ["basic_catalogue"],
    controlLibraryVersion: "0.1.0",
    frameworkLibraryVersion: "0.1.0",
    engineVersion: "0.1.0",
    controlSet: [],
    startedAt: new Date().toISOString(),
    frameworkPacks: ["ism"],
  },
  results: [
    {
      controlId: "pg.x",
      controlVersion: "1.0.0",
      status: "pass",
      severity: "low",
      summary: "ok",
      expected: "e",
      actual: "a",
      evidence: {},
      evidenceSummary: "s",
      durationMs: 1,
      categories: [],
      mappings: [],
      remediation: { summary: "", steps: [] },
    },
  ],
  completedAt: new Date().toISOString(),
  digest: "a".repeat(64),
  status: "completed",
};

describe("exportPdfReport", () => {
  it("produces PDF header and includes disclaimers", () => {
    const buf = exportPdfReport(run, "executive");
    const text = buf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("NOT AFFILIATED WITH SUPABASE");
    expect(text).toContain("point-in-time technical evidence");
  });
});
