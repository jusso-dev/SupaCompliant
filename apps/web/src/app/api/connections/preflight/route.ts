import { NextResponse } from "next/server";
import { runPreflight } from "@supacompliant/assessment-engine";
import { allControls } from "@supacompliant/control-library";
import {
  connectionTestSchema,
  SUPERUSER_LIKE,
} from "@/lib/connections/schema";

/**
 * Server-only preflight. Never echoes password or management token.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = connectionTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;

  if (
    SUPERUSER_LIKE.has(input.username.toLowerCase()) &&
    !input.allowSuperuserDiagnostic
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Superuser-like assessment credentials are blocked. Create supacompliant_assessor or enable local diagnostic mode explicitly.",
      },
      { status: 400 },
    );
  }

  const preflight = await runPreflight({
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.username,
    password: input.password,
    ssl:
      input.sslMode === "disable"
        ? false
        : { rejectUnauthorized: input.sslMode === "verify-full" },
    projectRef: input.projectRef,
    managementToken: input.managementToken,
    allowPrivateNetwork: input.allowPrivateNetwork,
  });

  if (!preflight.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: preflight.error,
        // Never include secrets
      },
      { status: 422 },
    );
  }

  const available = new Set(preflight.capabilities);
  const controlAvailability = allControls.map((c) => {
    const missing = c.requiredCapabilities.filter((cap) => !available.has(cap));
    const targetOk = c.targets.includes(preflight.targetType);
    return {
      id: c.id,
      title: c.title,
      available: targetOk && missing.length === 0,
      reasons: [
        ...(!targetOk ? [`Target type ${preflight.targetType} not supported by control`] : []),
        ...missing.map((m) => `Missing capability: ${m}`),
      ],
    };
  });

  const unavailable = controlAvailability.filter((c) => !c.available);

  return NextResponse.json({
    ok: true,
    targetType: preflight.targetType,
    isSupabase: preflight.isSupabase,
    postgresVersion: preflight.postgresVersion,
    postgresMajor: preflight.postgresMajor,
    extensions: preflight.extensions,
    capabilities: preflight.capabilities,
    fingerprint: preflight.fingerprint,
    unavailableReasons: preflight.unavailableReasons,
    controlSummary: {
      total: controlAvailability.length,
      available: controlAvailability.length - unavailable.length,
      unavailable: unavailable.length,
    },
    unavailableControls: unavailable.slice(0, 100),
  });
}
