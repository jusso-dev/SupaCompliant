import type {
  ControlEvaluation,
  FrameworkMappingRef,
  RemediationDefinition,
  TechnicalControlDefinition,
} from "@supacompliant/assessment-engine";
import type { ControlResultStatus, Severity } from "@supacompliant/shared";

export const CONTROL_LIBRARY_VERSION = "0.1.0";

export function evalResult<TEvidence>(
  status: ControlResultStatus,
  parts: {
    summary: string;
    expected: string;
    actual: string;
    evidence: TEvidence;
    evidenceSummary: string;
    severity?: Severity;
    recommendations?: string[];
  },
): ControlEvaluation<TEvidence> {
  return {
    status,
    severity: parts.severity,
    summary: parts.summary,
    expected: parts.expected,
    actual: parts.actual,
    evidence: parts.evidence,
    evidenceSummary: parts.evidenceSummary,
    recommendations: parts.recommendations,
  };
}

export function map(
  frameworkId: string,
  frameworkVersion: string,
  controlIdentifier: string,
  relationship: FrameworkMappingRef["relationship"],
  rationale: string,
  sourceUrl: string,
  confidence: FrameworkMappingRef["confidence"] = "medium",
  publicationId?: string,
): FrameworkMappingRef {
  return {
    frameworkId,
    frameworkVersion,
    controlIdentifier,
    relationship,
    confidence,
    rationale,
    sourceUrl,
    publicationId,
  };
}

/** Concise common remediation builders */
export function rem(
  summary: string,
  steps: string[],
  safeSql?: string,
): RemediationDefinition {
  return { summary, steps, safeSql };
}

export type AnyControl = TechnicalControlDefinition<any, any>;

/** Evidence shape may vary by branch; keep flexible for catalogue authors. */
export function defineControl(
  def: TechnicalControlDefinition<any, any>,
): TechnicalControlDefinition<any, any> {
  return def;
}
