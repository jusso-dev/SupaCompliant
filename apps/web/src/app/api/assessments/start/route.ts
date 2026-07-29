import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createAssessmentContext,
  executeAssessment,
  runPreflight,
} from "@supacompliant/assessment-engine";
import { allControls } from "@supacompliant/control-library";
import {
  CONTROL_LIBRARY_VERSION,
} from "@supacompliant/control-library";
import { FRAMEWORK_LIBRARY_VERSION } from "@supacompliant/framework-mappings";
import { createRun, getRun, updateRun } from "@/lib/assessments/run-store";
import { SUPERUSER_LIKE } from "@/lib/connections/schema";

const startSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().default(5432),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().optional(),
  sslMode: z.enum(["disable", "require", "verify-full"]).default("require"),
  allowPrivateNetwork: z.boolean().default(false),
  projectRef: z.string().optional(),
  managementToken: z.string().optional(),
  frameworkPacks: z.array(z.string()).default(["ism"]),
});

/**
 * Start an in-process assessment (demo/local). Secrets never returned.
 * Production deployments should insert into `jobs` for the worker.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (SUPERUSER_LIKE.has(input.username.toLowerCase())) {
    return NextResponse.json(
      {
        error:
          "Superuser assessment blocked. Use supacompliant_assessor credentials.",
      },
      { status: 400 },
    );
  }

  const runId = randomUUID();
  createRun(runId);

  // Fire-and-forget background execution
  void (async () => {
    try {
      updateRun(runId, { status: "collecting", progress: 5 });
      const config = {
        host: input.host,
        port: input.port,
        database: input.database,
        user: input.username,
        password: input.password,
        ssl:
          input.sslMode === "disable"
            ? false
            : ({
                rejectUnauthorized: input.sslMode === "verify-full",
              } as const),
        projectRef: input.projectRef,
        managementToken: input.managementToken,
        allowPrivateNetwork: input.allowPrivateNetwork,
      };

      const preflight = await runPreflight(config);
      if (!preflight.ok) {
        updateRun(runId, {
          status: "failed",
          progress: 100,
          errorMessage: preflight.error,
          completedAt: new Date().toISOString(),
        });
        return;
      }

      if (getRun(runId)?.cancelRequested) {
        updateRun(runId, {
          status: "cancelled",
          progress: 100,
          completedAt: new Date().toISOString(),
        });
        return;
      }

      updateRun(runId, { status: "evaluating", progress: 20 });
      const { context, close } = await createAssessmentContext(
        config,
        preflight,
        {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        },
      );

      try {
        const ac = new AbortController();
        const poll = setInterval(() => {
          if (getRun(runId)?.cancelRequested) ac.abort();
        }, 500);

        const completed = await executeAssessment(
          allControls,
          context,
          {
            runId,
            organisationId: "local",
            projectId: "local",
            environmentId: "local",
            targetFingerprint: preflight.fingerprint,
            postgresVersion: preflight.postgresVersion,
            extensions: preflight.extensions,
            capabilities: preflight.capabilities,
            controlLibraryVersion: CONTROL_LIBRARY_VERSION,
            frameworkLibraryVersion: FRAMEWORK_LIBRARY_VERSION,
            frameworkPacks: input.frameworkPacks,
          },
          { concurrency: 4, signal: ac.signal, overallTimeoutMs: 10 * 60_000 },
        );
        clearInterval(poll);

        updateRun(runId, {
          status:
            completed.status === "cancelled"
              ? "cancelled"
              : completed.status === "failed"
                ? "failed"
                : "completed",
          progress: 100,
          result: completed,
          completedAt: completed.completedAt,
        });
      } finally {
        await close();
      }
    } catch (e) {
      updateRun(runId, {
        status: "failed",
        progress: 100,
        errorMessage: e instanceof Error ? e.message : String(e),
        completedAt: new Date().toISOString(),
      });
    }
  })();

  return NextResponse.json({
    runId,
    status: "queued",
    message: "Assessment started. Poll GET /api/assessments/{runId}.",
  });
}
