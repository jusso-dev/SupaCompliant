import { createHash } from "node:crypto";
import type { ControlExecutionResult, RunManifest } from "./types.js";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function computeReportDigest(
  manifest: RunManifest,
  results: ControlExecutionResult[],
): string {
  const payload = {
    manifest: {
      runId: manifest.runId,
      targetFingerprint: manifest.targetFingerprint,
      postgresVersion: manifest.postgresVersion,
      controlLibraryVersion: manifest.controlLibraryVersion,
      frameworkLibraryVersion: manifest.frameworkLibraryVersion,
      engineVersion: manifest.engineVersion,
      controlSet: manifest.controlSet,
      frameworkPacks: manifest.frameworkPacks,
    },
    results: results.map((r) => ({
      controlId: r.controlId,
      controlVersion: r.controlVersion,
      status: r.status,
      severity: r.severity,
      summary: r.summary,
      expected: r.expected,
      actual: r.actual,
      evidenceSummary: r.evidenceSummary,
    })),
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function fingerprintTarget(parts: {
  host?: string;
  port?: number;
  database?: string;
  projectRef?: string;
  serverVersion: string;
}): string {
  const raw = [
    parts.projectRef ?? "",
    parts.host ?? "",
    String(parts.port ?? ""),
    parts.database ?? "",
    parts.serverVersion,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
