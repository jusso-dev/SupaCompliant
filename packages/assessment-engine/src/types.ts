import type {
  Capability,
  ControlResultStatus,
  Severity,
  TargetType,
} from "@supacompliant/shared";
import type { z } from "zod";

export interface FrameworkMappingRef {
  frameworkId: string;
  frameworkVersion: string;
  controlIdentifier: string;
  relationship:
    | "directly_supports"
    | "partially_supports"
    | "evidence_contributes"
    | "manual_validation_required";
  confidence: "high" | "medium" | "low";
  rationale: string;
  sourceUrl: string;
  publicationId?: string;
}

export interface RemediationDefinition {
  summary: string;
  steps: string[];
  safeSql?: string;
  references?: string[];
}

export interface ControlEvaluation<TEvidence = unknown> {
  status: ControlResultStatus;
  severity?: Severity;
  summary: string;
  expected: string;
  actual: string;
  evidence: TEvidence;
  evidenceSummary: string;
  recommendations?: string[];
}

export interface AssessmentContext {
  targetType: TargetType;
  postgresVersion: string;
  postgresMajor: number;
  extensions: string[];
  capabilities: Set<Capability>;
  isSupabase: boolean;
  /** Run a read-only SQL query against the target. */
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<T[]>;
  /** Optional Supabase Management API GET helper (server-side only). */
  managementGet?: <T = unknown>(path: string) => Promise<T>;
  signal?: AbortSignal;
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

export interface TechnicalControlDefinition<
  TInput = unknown,
  TEvidence = unknown,
> {
  id: string;
  version: string;
  title: string;
  description: string;
  rationale: string;
  severity: Severity;
  categories: string[];
  targets: TargetType[];
  supportedPostgresMajors?: number[];
  requiredCapabilities: Capability[];
  tags?: string[];
  references?: string[];
  timeoutMs?: number;
  /** When required capabilities missing */
  missingCapabilityStatus?: "not_assessed" | "unknown" | "manual_review";
  collect: (context: AssessmentContext) => Promise<TInput>;
  evaluate: (input: TInput) => ControlEvaluation<TEvidence>;
  remediation: RemediationDefinition;
  mappings: FrameworkMappingRef[];
  /** Optional Zod schema for evidence validation */
  evidenceSchema?: z.ZodType<TEvidence>;
}

export interface RunManifest {
  runId: string;
  organisationId: string;
  projectId: string;
  environmentId: string;
  targetFingerprint: string;
  postgresVersion: string;
  extensions: string[];
  capabilities: Capability[];
  controlLibraryVersion: string;
  frameworkLibraryVersion: string;
  engineVersion: string;
  controlSet: Array<{ id: string; version: string }>;
  startedAt: string;
  profileId?: string;
  frameworkPacks: string[];
}

export interface ControlExecutionResult {
  controlId: string;
  controlVersion: string;
  status: ControlResultStatus;
  severity: Severity;
  summary: string;
  expected: string;
  actual: string;
  evidence: unknown;
  evidenceSummary: string;
  durationMs: number;
  errorMessage?: string;
  categories: string[];
  mappings: FrameworkMappingRef[];
  remediation: RemediationDefinition;
}

export interface CompletedRun {
  manifest: RunManifest;
  results: ControlExecutionResult[];
  completedAt: string;
  digest: string;
  status: "completed" | "failed" | "cancelled" | "awaiting_manual_review";
}
