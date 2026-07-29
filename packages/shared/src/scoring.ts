import type { ControlResultStatus, Severity } from "./enums.js";

export interface ResultCount {
  status: ControlResultStatus;
  severity: Severity;
  count: number;
}

export interface TechnicalPosture {
  total: number;
  assessed: number;
  pass: number;
  fail: number;
  warning: number;
  manualReview: number;
  notApplicable: number;
  notAssessed: number;
  error: number;
  unknown: number;
  /** Passes / (pass + fail + warning). Excludes N/A, not assessed, error, unknown. */
  technicalPassRate: number | null;
  /** Never treats unknown/error as pass. */
  criticalFindings: number;
  highFindings: number;
  unknownOrError: number;
  evidenceCompleteness: number | null;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
  informational: 0,
};

export function computeTechnicalPosture(
  rows: Array<{ status: ControlResultStatus; severity: Severity }>,
  options?: { evidenceComplete?: number; evidenceTotal?: number },
): TechnicalPosture {
  const base: TechnicalPosture = {
    total: rows.length,
    assessed: 0,
    pass: 0,
    fail: 0,
    warning: 0,
    manualReview: 0,
    notApplicable: 0,
    notAssessed: 0,
    error: 0,
    unknown: 0,
    technicalPassRate: null,
    criticalFindings: 0,
    highFindings: 0,
    unknownOrError: 0,
    evidenceCompleteness: null,
  };

  for (const row of rows) {
    switch (row.status) {
      case "pass":
        base.pass += 1;
        base.assessed += 1;
        break;
      case "fail":
        base.fail += 1;
        base.assessed += 1;
        if (row.severity === "critical") base.criticalFindings += 1;
        if (row.severity === "high") base.highFindings += 1;
        break;
      case "warning":
        base.warning += 1;
        base.assessed += 1;
        break;
      case "manual_review":
        base.manualReview += 1;
        break;
      case "not_applicable":
        base.notApplicable += 1;
        break;
      case "not_assessed":
        base.notAssessed += 1;
        break;
      case "error":
        base.error += 1;
        base.unknownOrError += 1;
        break;
      case "unknown":
        base.unknown += 1;
        base.unknownOrError += 1;
        break;
    }
  }

  const denom = base.pass + base.fail + base.warning;
  base.technicalPassRate = denom === 0 ? null : base.pass / denom;

  if (
    options?.evidenceTotal != null &&
    options.evidenceTotal > 0 &&
    options.evidenceComplete != null
  ) {
    base.evidenceCompleteness =
      options.evidenceComplete / options.evidenceTotal;
  }

  return base;
}

export function riskWeightedScore(
  rows: Array<{ status: ControlResultStatus; severity: Severity }>,
): number | null {
  let max = 0;
  let earned = 0;
  for (const row of rows) {
    if (
      row.status === "not_applicable" ||
      row.status === "not_assessed" ||
      row.status === "manual_review"
    ) {
      continue;
    }
    const w = SEVERITY_WEIGHT[row.severity];
    max += w;
    if (row.status === "pass") {
      earned += w;
    } else if (row.status === "warning") {
      earned += w * 0.5;
    }
    // fail, error, unknown contribute 0 — never counted as pass
  }
  if (max === 0) return null;
  return earned / max;
}

/**
 * Framework contribution view — never a maturity certification claim.
 */
export interface FrameworkContribution {
  frameworkId: string;
  frameworkVersion: string;
  assessed: number;
  notAssessed: number;
  notApplicable: number;
  manualReview: number;
  passed: number;
  failed: number;
  unknown: number;
  disclaimer: string;
}

export const FRAMEWORK_DISCLAIMER =
  "This view shows technical database evidence contribution only. It is not certification, accreditation, or an Essential Eight maturity rating.";
