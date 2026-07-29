/**
 * In-memory assessment run store for local/demo execution when app DB worker
 * is not available. Production uses PostgreSQL jobs table.
 */
import type { CompletedRun } from "@supacompliant/assessment-engine";

export type LiveRunRecord = {
  id: string;
  status:
    | "queued"
    | "collecting"
    | "evaluating"
    | "completed"
    | "failed"
    | "cancelled";
  progress: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  result?: CompletedRun;
  cancelRequested?: boolean;
};

const globalStore = globalThis as unknown as {
  __scRuns?: Map<string, LiveRunRecord>;
};

function store(): Map<string, LiveRunRecord> {
  if (!globalStore.__scRuns) globalStore.__scRuns = new Map();
  return globalStore.__scRuns;
}

export function createRun(id: string): LiveRunRecord {
  const rec: LiveRunRecord = {
    id,
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString(),
  };
  store().set(id, rec);
  return rec;
}

export function getRun(id: string): LiveRunRecord | undefined {
  return store().get(id);
}

export function updateRun(
  id: string,
  patch: Partial<LiveRunRecord>,
): LiveRunRecord | undefined {
  const cur = store().get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  store().set(id, next);
  return next;
}

export function listRuns(): LiveRunRecord[] {
  return [...store().values()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
