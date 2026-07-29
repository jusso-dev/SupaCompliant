#!/usr/bin/env node
/**
 * supacompliant CLI
 * Secrets are never printed.
 */
import {
  createAssessmentContext,
  executeAssessment,
  runPreflight,
} from "@supacompliant/assessment-engine";
import {
  allControls,
  CONTROL_LIBRARY_VERSION,
  getControlById,
  listControls,
} from "@supacompliant/control-library";
import { FRAMEWORK_LIBRARY_VERSION } from "@supacompliant/framework-mappings";
import {
  exportCsvControls,
  exportJsonReport,
  exportSarif,
  REPORT_QUALIFICATION,
} from "@supacompliant/reporting";
import { computeTechnicalPosture } from "@supacompliant/shared";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

function usage(): never {
  console.log(`supacompliant — Continuous database assurance

Usage:
  supacompliant version
  supacompliant login
  supacompliant project list
  supacompliant controls list
  supacompliant controls explain <control-id>
  supacompliant connection test
  supacompliant assess [--fail-on critical|high] [--output json|csv|sarif] [--out path]
  supacompliant findings list
  supacompliant report download <run-id> [--format json|sarif|csv]

Environment for assess / connection test:
  SUPACOMPLIANT_DATABASE_URL   postgres://user:pass@host:5432/db
  SUPACOMPLIANT_ALLOW_PRIVATE  set to 1 for local/private targets only
  SUPACOMPLIANT_PROJECT_REF    optional Supabase project ref
  SUPACOMPLIANT_MANAGEMENT_TOKEN  optional (never printed)
  SUPACOMPLIANT_API_URL        optional API base for login/project list
  SUPACOMPLIANT_API_TOKEN      optional API token (never printed)

Never logs passwords or tokens.
Independent open-source — not affiliated with Supabase, Inc.
`);
  process.exit(1);
}

function redactError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_URL]")
    .replace(/password[=:][^\s&]+/gi, "password=[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
} {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: u.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(u.username),
    password: u.password ? decodeURIComponent(u.password) : undefined,
  };
}

async function cmdControlsList(): Promise<void> {
  const controls = listControls();
  console.log(`Control library ${CONTROL_LIBRARY_VERSION} (${controls.length} controls)`);
  for (const c of controls) {
    console.log(`${c.id}\tv${c.version}\t${c.severity}\t${c.title}`);
  }
}

async function cmdControlsExplain(id: string): Promise<void> {
  const c = getControlById(id);
  if (!c) {
    console.error(`Unknown control: ${id}`);
    process.exit(2);
  }
  console.log(c.title);
  console.log(`ID: ${c.id} @ ${c.version}`);
  console.log(`Severity: ${c.severity}`);
  console.log(`Categories: ${c.categories.join(", ")}`);
  console.log(`Targets: ${c.targets.join(", ")}`);
  console.log(`Capabilities: ${c.requiredCapabilities.join(", ")}`);
  console.log("");
  console.log(c.description);
  console.log("");
  console.log("Rationale:", c.rationale);
  console.log("Remediation:", c.remediation.summary);
  console.log("Mappings:");
  for (const m of c.mappings) {
    console.log(
      `  - ${m.frameworkId}@${m.frameworkVersion} ${m.controlIdentifier} (${m.relationship})`,
    );
  }
}

async function cmdConnectionTest(): Promise<void> {
  const url = process.env.SUPACOMPLIANT_DATABASE_URL;
  if (!url) {
    console.error("SUPACOMPLIANT_DATABASE_URL required");
    process.exit(2);
  }
  const parsed = parseDatabaseUrl(url);
  const preflight = await runPreflight({
    ...parsed,
    projectRef: process.env.SUPACOMPLIANT_PROJECT_REF,
    managementToken: process.env.SUPACOMPLIANT_MANAGEMENT_TOKEN,
    allowPrivateNetwork: process.env.SUPACOMPLIANT_ALLOW_PRIVATE === "1",
    ssl: true,
  });
  if (!preflight.ok) {
    console.error("Connection failed:", preflight.error);
    process.exit(2);
  }
  console.log("Connection OK");
  console.log(`Target type: ${preflight.targetType}`);
  console.log(`Version: ${preflight.postgresVersion}`);
  console.log(`Fingerprint: ${preflight.fingerprint}`);
  console.log(`Capabilities: ${preflight.capabilities.join(", ")}`);
  console.log(`Extensions: ${preflight.extensions.length}`);
  if (Object.keys(preflight.unavailableReasons).length) {
    console.log("Unavailable:");
    for (const [k, v] of Object.entries(preflight.unavailableReasons)) {
      console.log(`  - ${k}: ${v}`);
    }
  }
}

async function cmdAssess(args: string[]): Promise<void> {
  const url = process.env.SUPACOMPLIANT_DATABASE_URL;
  if (!url) {
    console.error("SUPACOMPLIANT_DATABASE_URL required");
    process.exit(2);
  }
  let failOn: "critical" | "high" | null = null;
  let output: "json" | "csv" | "sarif" = "json";
  let outPath: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fail-on") failOn = args[++i] as "critical" | "high";
    else if (args[i] === "--output") {
      const v = args[++i];
      if (v === "json" || v === "csv" || v === "sarif") output = v;
    } else if (args[i] === "--out") outPath = args[++i] ?? null;
  }

  const parsed = parseDatabaseUrl(url);
  const config = {
    ...parsed,
    projectRef: process.env.SUPACOMPLIANT_PROJECT_REF,
    managementToken: process.env.SUPACOMPLIANT_MANAGEMENT_TOKEN,
    allowPrivateNetwork: process.env.SUPACOMPLIANT_ALLOW_PRIVATE === "1",
    ssl: true as const,
  };
  const preflight = await runPreflight(config);
  if (!preflight.ok) {
    console.error("Preflight failed:", preflight.error);
    process.exit(2);
  }

  const { context, close } = await createAssessmentContext(config, preflight, {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  });

  try {
    const runId = randomUUID();
    console.error(`Running assessment ${runId} (${allControls.length} controls)…`);
    const completed = await executeAssessment(allControls, context, {
      runId,
      organisationId: "cli",
      projectId: "cli",
      environmentId: "cli",
      targetFingerprint: preflight.fingerprint,
      postgresVersion: preflight.postgresVersion,
      extensions: preflight.extensions,
      capabilities: preflight.capabilities,
      controlLibraryVersion: CONTROL_LIBRARY_VERSION,
      frameworkLibraryVersion: FRAMEWORK_LIBRARY_VERSION,
      frameworkPacks: ["ism"],
    });

    const posture = computeTechnicalPosture(
      completed.results.map((r) => ({ status: r.status, severity: r.severity })),
    );
    console.error(REPORT_QUALIFICATION);
    console.error(
      `Status=${completed.status} digest=${completed.digest} passRate=${
        posture.technicalPassRate == null
          ? "n/a"
          : (posture.technicalPassRate * 100).toFixed(1) + "%"
      } fail=${posture.fail} unknownOrError=${posture.unknownOrError}`,
    );

    let body: string;
    if (output === "csv") body = exportCsvControls(completed.results);
    else if (output === "sarif") body = exportSarif(completed);
    else body = exportJsonReport(completed);

    if (outPath) writeFileSync(outPath, body, "utf8");
    else process.stdout.write(body + (body.endsWith("\n") ? "" : "\n"));

    if (failOn === "critical" && posture.criticalFindings > 0) process.exit(3);
    if (
      failOn === "high" &&
      (posture.criticalFindings > 0 || posture.highFindings > 0)
    ) {
      process.exit(3);
    }
  } finally {
    await close();
  }
}

async function cmdVersion(): Promise<void> {
  console.log(`supacompliant CLI`);
  console.log(`control-library ${CONTROL_LIBRARY_VERSION}`);
  console.log(`framework-library ${FRAMEWORK_LIBRARY_VERSION}`);
  console.log(`controls ${allControls.length}`);
}

async function cmdLogin(): Promise<void> {
  const api = process.env.SUPACOMPLIANT_API_URL;
  const token = process.env.SUPACOMPLIANT_API_TOKEN;
  if (!api || !token) {
    console.error(
      "Set SUPACOMPLIANT_API_URL and SUPACOMPLIANT_API_TOKEN (token never printed).",
    );
    process.exit(2);
  }
  const res = await fetch(`${api.replace(/\/$/, "")}/api/v1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Login probe failed: HTTP ${res.status}`);
    process.exit(2);
  }
  console.error("API reachable. Token accepted for discovery (not stored).");
}

async function cmdProjectList(): Promise<void> {
  const api = process.env.SUPACOMPLIANT_API_URL;
  if (!api) {
    console.log("demo-project\tCustomer Platform\t(local demo — set SUPACOMPLIANT_API_URL for live)");
    return;
  }
  const res = await fetch(`${api.replace(/\/$/, "")}/api/v1/assessments`);
  if (!res.ok) {
    console.error(`project list failed: HTTP ${res.status}`);
    process.exit(2);
  }
  const data = (await res.json()) as { assessments?: Array<{ id: string }> };
  console.log(`${data.assessments?.length ?? 0} assessments visible via API`);
}

async function cmdFindingsList(): Promise<void> {
  console.log(
    "Use web UI or GET /api/findings when API is configured. Demo findings are in the seeded workspace.",
  );
}

async function main(): Promise<void> {
  const [cmd, sub, ...rest] = process.argv.slice(2);
  if (!cmd) usage();
  if (cmd === "version" || cmd === "--version" || cmd === "-V")
    return cmdVersion();
  if (cmd === "login") return cmdLogin();
  if (cmd === "project" && sub === "list") return cmdProjectList();
  if (cmd === "findings" && sub === "list") return cmdFindingsList();
  if (cmd === "controls" && sub === "list") return cmdControlsList();
  if (cmd === "controls" && sub === "explain" && rest[0]) {
    return cmdControlsExplain(rest[0]);
  }
  if (cmd === "connection" && sub === "test") return cmdConnectionTest();
  if (cmd === "assess") return cmdAssess([sub, ...rest].filter(Boolean) as string[]);
  usage();
}

main().catch((e) => {
  console.error(redactError(e));
  process.exit(1);
});

