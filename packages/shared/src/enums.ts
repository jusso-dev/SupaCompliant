import { z } from "zod";

export const ControlResultStatus = z.enum([
  "pass",
  "fail",
  "warning",
  "manual_review",
  "not_applicable",
  "not_assessed",
  "error",
  "unknown",
]);
export type ControlResultStatus = z.infer<typeof ControlResultStatus>;

export const Severity = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "informational",
]);
export type Severity = z.infer<typeof Severity>;

export const TargetType = z.enum(["supabase", "postgresql"]);
export type TargetType = z.infer<typeof TargetType>;

export const Capability = z.enum([
  "basic_catalogue",
  "monitoring",
  "audit_log",
  "supabase_management",
  "manual_evidence",
]);
export type Capability = z.infer<typeof Capability>;

export const OrgRole = z.enum([
  "owner",
  "administrator",
  "assessment_lead",
  "assessor",
  "engineer",
  "reviewer",
  "viewer",
]);
export type OrgRole = z.infer<typeof OrgRole>;

export const AssessmentRunStatus = z.enum([
  "draft",
  "queued",
  "collecting",
  "evaluating",
  "awaiting_manual_review",
  "completed",
  "approved",
  "superseded",
  "cancelled",
  "failed",
]);
export type AssessmentRunStatus = z.infer<typeof AssessmentRunStatus>;

export const FindingStatus = z.enum([
  "open",
  "acknowledged",
  "in_progress",
  "ready_for_verification",
  "resolved",
  "risk_accepted",
  "false_positive",
  "duplicate",
]);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const MappingRelationship = z.enum([
  "directly_supports",
  "partially_supports",
  "evidence_contributes",
  "manual_validation_required",
]);
export type MappingRelationship = z.infer<typeof MappingRelationship>;

export const EnvironmentKind = z.enum([
  "development",
  "staging",
  "production",
  "other",
]);
export type EnvironmentKind = z.infer<typeof EnvironmentKind>;

export const EvidenceClassification = z.enum([
  "public",
  "internal",
  "sensitive",
  "restricted",
]);
export type EvidenceClassification = z.infer<typeof EvidenceClassification>;

export const JobStatus = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatus>;

/** Statuses that must never be treated as successful compliance. */
export const NON_PASSING_STATUSES: readonly ControlResultStatus[] = [
  "fail",
  "warning",
  "manual_review",
  "not_applicable",
  "not_assessed",
  "error",
  "unknown",
] as const;

export function isPassingStatus(status: ControlResultStatus): boolean {
  return status === "pass";
}

/** Collection/API failures never become pass. */
export function statusFromCollectionFailure(
  kind: "permission" | "timeout" | "error" | "unavailable",
): ControlResultStatus {
  switch (kind) {
    case "permission":
      return "unknown";
    case "unavailable":
      return "not_assessed";
    case "timeout":
    case "error":
      return "error";
  }
}
