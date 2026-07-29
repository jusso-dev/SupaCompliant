import type { FindingStatus, Severity } from "@supacompliant/shared";

export type FindingRecord = {
  id: string;
  title: string;
  description?: string;
  severity: Severity;
  status: FindingStatus;
  controlId: string;
  owner?: string;
  environment?: string;
  proposedResolution?: boolean;
  createdAt: string;
  updatedAt: string;
};

const g = globalThis as unknown as { __scFindings?: FindingRecord[] };

function list(): FindingRecord[] {
  if (!g.__scFindings) {
    g.__scFindings = [
      {
        id: "f-1",
        title: "Tables without RLS",
        severity: "critical",
        status: "in_progress",
        controlId: "pg.rls.tables_without_rls",
        owner: "Jordan Lee",
        environment: "production",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
  return g.__scFindings;
}

export function listFindings(): FindingRecord[] {
  return [...list()];
}

export function updateFindingStatus(
  id: string,
  status: FindingStatus,
): FindingRecord | undefined {
  const f = list().find((x) => x.id === id);
  if (!f) return undefined;
  f.status = status;
  f.updatedAt = new Date().toISOString();
  if (status !== "resolved") f.proposedResolution = false;
  return f;
}

/**
 * When a control later passes, do NOT auto-close — propose resolution.
 */
export function onControlPassed(controlId: string): FindingRecord[] {
  const updated: FindingRecord[] = [];
  for (const f of list()) {
    if (
      f.controlId === controlId &&
      f.status !== "resolved" &&
      f.status !== "false_positive" &&
      f.status !== "duplicate" &&
      f.status !== "risk_accepted"
    ) {
      f.proposedResolution = true;
      f.updatedAt = new Date().toISOString();
      updated.push(f);
    }
  }
  return updated;
}

export function acceptRisk(id: string, rationale: string): FindingRecord | undefined {
  const f = list().find((x) => x.id === id);
  if (!f) return undefined;
  f.status = "risk_accepted";
  f.description = `${f.description ?? ""}\nRisk accepted: ${rationale}`.trim();
  f.updatedAt = new Date().toISOString();
  f.proposedResolution = false;
  return f;
}

export function confirmResolution(id: string): FindingRecord | undefined {
  const f = list().find((x) => x.id === id);
  if (!f || !f.proposedResolution) return undefined;
  f.status = "resolved";
  f.proposedResolution = false;
  f.updatedAt = new Date().toISOString();
  return f;
}
