import type { ControlExecutionResult } from "@supacompliant/assessment-engine";
import type { ControlResultStatus } from "@supacompliant/shared";

export interface ComparisonDelta {
  controlId: string;
  baselineStatus?: ControlResultStatus;
  candidateStatus?: ControlResultStatus;
  baselineVersion?: string;
  candidateVersion?: string;
  kind:
    | "new_control"
    | "removed_control"
    | "status_changed"
    | "version_changed"
    | "unchanged"
    | "regression"
    | "resolved"
    | "capability_change";
  notes: string[];
}

export interface ReportComparison {
  baselineRunId: string;
  candidateRunId: string;
  deltas: ComparisonDelta[];
  summary: {
    newControls: number;
    removedControls: number;
    regressions: number;
    resolved: number;
    statusChanged: number;
    versionChangedOnly: number;
    unchanged: number;
  };
}

function key(r: ControlExecutionResult): string {
  return r.controlId;
}

export function compareReports(
  baselineRunId: string,
  baseline: ControlExecutionResult[],
  candidateRunId: string,
  candidate: ControlExecutionResult[],
): ReportComparison {
  const baseMap = new Map(baseline.map((r) => [key(r), r]));
  const candMap = new Map(candidate.map((r) => [key(r), r]));
  const ids = new Set([...baseMap.keys(), ...candMap.keys()]);
  const deltas: ComparisonDelta[] = [];

  for (const id of [...ids].sort()) {
    const b = baseMap.get(id);
    const c = candMap.get(id);
    if (b && !c) {
      deltas.push({
        controlId: id,
        baselineStatus: b.status,
        baselineVersion: b.controlVersion,
        kind: "removed_control",
        notes: ["Control absent in candidate run"],
      });
      continue;
    }
    if (!b && c) {
      deltas.push({
        controlId: id,
        candidateStatus: c.status,
        candidateVersion: c.controlVersion,
        kind: "new_control",
        notes: ["Control added in candidate run"],
      });
      continue;
    }
    if (!b || !c) continue;

    const notes: string[] = [];
    let kind: ComparisonDelta["kind"] = "unchanged";

    if (b.controlVersion !== c.controlVersion) {
      notes.push(
        `Control version changed ${b.controlVersion} → ${c.controlVersion}`,
      );
      kind = "version_changed";
    }

    if (b.status !== c.status) {
      notes.push(`Status ${b.status} → ${c.status}`);
      if (b.status === "pass" && (c.status === "fail" || c.status === "warning")) {
        kind = "regression";
        if (b.controlVersion !== c.controlVersion) {
          notes.push(
            "Evaluator version also changed — may not be pure target regression",
          );
        }
      } else if (
        (b.status === "fail" || b.status === "warning") &&
        c.status === "pass"
      ) {
        kind = "resolved";
      } else {
        kind = "status_changed";
      }
    }

    // capability-ish: unknown/not_assessed transitions
    if (
      (b.status === "unknown" || b.status === "not_assessed") !==
        (c.status === "unknown" || c.status === "not_assessed") &&
      b.status !== c.status
    ) {
      notes.push("Assessment capability may have changed");
      if (kind === "unchanged" || kind === "version_changed") {
        kind = "capability_change";
      }
    }

    deltas.push({
      controlId: id,
      baselineStatus: b.status,
      candidateStatus: c.status,
      baselineVersion: b.controlVersion,
      candidateVersion: c.controlVersion,
      kind,
      notes,
    });
  }

  const summary = {
    newControls: deltas.filter((d) => d.kind === "new_control").length,
    removedControls: deltas.filter((d) => d.kind === "removed_control").length,
    regressions: deltas.filter((d) => d.kind === "regression").length,
    resolved: deltas.filter((d) => d.kind === "resolved").length,
    statusChanged: deltas.filter((d) => d.kind === "status_changed").length,
    versionChangedOnly: deltas.filter(
      (d) => d.kind === "version_changed",
    ).length,
    unchanged: deltas.filter((d) => d.kind === "unchanged").length,
  };

  return { baselineRunId, candidateRunId, deltas, summary };
}
