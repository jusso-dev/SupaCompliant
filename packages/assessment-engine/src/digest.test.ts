import { describe, expect, it } from "vitest";
import { computeReportDigest, fingerprintTarget } from "./digest.js";
import type { ControlExecutionResult, RunManifest } from "./types.js";

const manifest: RunManifest = {
  runId: "run-1",
  organisationId: "org-1",
  projectId: "proj-1",
  environmentId: "env-1",
  targetFingerprint: "abc",
  postgresVersion: "PostgreSQL 16.0",
  extensions: ["plpgsql"],
  capabilities: ["basic_catalogue"],
  controlLibraryVersion: "0.1.0",
  frameworkLibraryVersion: "0.1.0",
  engineVersion: "0.1.0",
  controlSet: [{ id: "pg.version.supported", version: "1.0.0" }],
  startedAt: "2026-01-01T00:00:00.000Z",
  frameworkPacks: ["ism"],
};

const result: ControlExecutionResult = {
  controlId: "pg.version.supported",
  controlVersion: "1.0.0",
  status: "pass",
  severity: "high",
  summary: "ok",
  expected: "supported",
  actual: "16",
  evidence: { major: 16 },
  evidenceSummary: "PG 16",
  durationMs: 10,
  categories: ["hardening"],
  mappings: [],
  remediation: { summary: "n/a", steps: [] },
};

describe("computeReportDigest", () => {
  it("is stable for same inputs", () => {
    const a = computeReportDigest(manifest, [result]);
    const b = computeReportDigest(manifest, [result]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when status changes", () => {
    const a = computeReportDigest(manifest, [result]);
    const b = computeReportDigest(manifest, [
      { ...result, status: "fail", summary: "bad" },
    ]);
    expect(a).not.toBe(b);
  });
});

describe("fingerprintTarget", () => {
  it("returns short hex fingerprint", () => {
    const fp = fingerprintTarget({
      host: "db.example.com",
      port: 5432,
      database: "postgres",
      serverVersion: "PostgreSQL 16",
    });
    expect(fp).toHaveLength(16);
  });
});
