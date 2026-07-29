import type { Capability } from "@supacompliant/shared";
import { redactValue } from "@supacompliant/shared";
import { computeReportDigest } from "./digest.js";
import { mapPool, withTimeout } from "./pool.js";
import type {
  AssessmentContext,
  CompletedRun,
  ControlExecutionResult,
  RunManifest,
  TechnicalControlDefinition,
} from "./types.js";

export const ENGINE_VERSION = "0.1.0";

export interface RunOptions {
  concurrency?: number;
  overallTimeoutMs?: number;
  signal?: AbortSignal;
}

function missingCapabilities(
  control: TechnicalControlDefinition,
  available: Set<Capability>,
): Capability[] {
  return control.requiredCapabilities.filter((c) => !available.has(c));
}

function supportsTarget(
  control: TechnicalControlDefinition,
  ctx: AssessmentContext,
): boolean {
  if (!control.targets.includes(ctx.targetType)) return false;
  if (
    control.supportedPostgresMajors &&
    !control.supportedPostgresMajors.includes(ctx.postgresMajor)
  ) {
    return false;
  }
  return true;
}

export async function executeAssessment(
  controls: TechnicalControlDefinition[],
  context: AssessmentContext,
  manifestBase: Omit<RunManifest, "controlSet" | "startedAt" | "engineVersion">,
  options: RunOptions = {},
): Promise<CompletedRun> {
  const concurrency = options.concurrency ?? 4;
  const applicable = controls.filter((c) => supportsTarget(c, context));

  const manifest: RunManifest = {
    ...manifestBase,
    engineVersion: ENGINE_VERSION,
    startedAt: new Date().toISOString(),
    controlSet: applicable.map((c) => ({ id: c.id, version: c.version })),
  };

  const runControl = async (
    control: TechnicalControlDefinition,
  ): Promise<ControlExecutionResult> => {
    const started = Date.now();
    const base = {
      controlId: control.id,
      controlVersion: control.version,
      severity: control.severity,
      categories: control.categories,
      mappings: control.mappings,
      remediation: control.remediation,
    };

    const missing = missingCapabilities(control, context.capabilities);
    if (missing.length > 0) {
      const status = control.missingCapabilityStatus ?? "not_assessed";
      return {
        ...base,
        status,
        summary: `Required capabilities unavailable: ${missing.join(", ")}`,
        expected: "Collector privileges available",
        actual: `Missing: ${missing.join(", ")}`,
        evidence: { missingCapabilities: missing },
        evidenceSummary: `Not assessed — missing ${missing.join(", ")}`,
        durationMs: Date.now() - started,
      };
    }

    try {
      if (options.signal?.aborted) {
        throw new Error("Assessment cancelled");
      }
      const timeout = control.timeoutMs ?? 15_000;
      const input = await withTimeout(
        control.collect(context),
        timeout,
        control.id,
      );
      const evaluation = control.evaluate(input);
      const evidence = redactValue(evaluation.evidence);

      return {
        ...base,
        status: evaluation.status,
        severity: evaluation.severity ?? control.severity,
        summary: evaluation.summary,
        expected: evaluation.expected,
        actual: evaluation.actual,
        evidence,
        evidenceSummary: evaluation.evidenceSummary,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isCancel = message.includes("cancelled");
      return {
        ...base,
        status: isCancel ? "not_assessed" : "error",
        summary: isCancel
          ? "Assessment cancelled before control completed"
          : `Collection/evaluation error: ${message}`,
        expected: "Successful evidence collection",
        actual: message,
        evidence: { error: message },
        evidenceSummary: message,
        durationMs: Date.now() - started,
        errorMessage: message,
      };
    }
  };

  let results: ControlExecutionResult[];
  try {
    const work = mapPool(applicable, concurrency, runControl, {
      signal: options.signal,
    });
    results = options.overallTimeoutMs
      ? await withTimeout(work, options.overallTimeoutMs, "assessment")
      : await work;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results = applicable.map((control) => ({
      controlId: control.id,
      controlVersion: control.version,
      status: "error" as const,
      severity: control.severity,
      summary: message,
      expected: "Run completed",
      actual: message,
      evidence: { error: message },
      evidenceSummary: message,
      durationMs: 0,
      categories: control.categories,
      mappings: control.mappings,
      remediation: control.remediation,
      errorMessage: message,
    }));
    const digest = computeReportDigest(manifest, results);
    return {
      manifest,
      results,
      completedAt: new Date().toISOString(),
      digest,
      status: message.includes("cancelled") ? "cancelled" : "failed",
    };
  }

  const digest = computeReportDigest(manifest, results);
  const hasManual = results.some((r) => r.status === "manual_review");
  const hasHardFail = results.every((r) => r.status === "error");

  return {
    manifest,
    results,
    completedAt: new Date().toISOString(),
    digest,
    status: hasHardFail
      ? "failed"
      : hasManual
        ? "awaiting_manual_review"
        : "completed",
  };
}

/** Re-evaluate pure evaluators from captured inputs (tests / research). */
export function reEvaluateControl<TInput, TEvidence>(
  control: TechnicalControlDefinition<TInput, TEvidence>,
  input: TInput,
) {
  return control.evaluate(input);
}
