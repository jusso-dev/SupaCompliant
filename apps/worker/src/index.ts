import pg from "pg";
import pino from "pino";
import {
  createAssessmentContext,
  executeAssessment,
  runPreflight,
  type TargetConnectionConfig,
} from "@supacompliant/assessment-engine";
import { allControls, CONTROL_LIBRARY_VERSION } from "@supacompliant/control-library";
import { FRAMEWORK_LIBRARY_VERSION } from "@supacompliant/framework-mappings";
import { decryptSecret, type EncryptedBlob } from "@supacompliant/database";
import { redactValue } from "@supacompliant/shared";

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "password",
      "token",
      "secret",
      "*.password",
      "*.token",
      "payload.password",
      "ephemeral_secrets",
    ],
    censor: "[REDACTED]",
  },
});

const WORKER_ID = `worker-${process.pid}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);

interface JobRow {
  id: string;
  organisation_id: string;
  job_type: string;
  payload: {
    runId?: string;
    connectionId?: string;
    projectId?: string;
    environmentId?: string;
    frameworkPacks?: string[];
    allowPrivateNetwork?: boolean;
  };
  ephemeral_secrets: EncryptedBlob | null;
  attempts: number;
  max_attempts: number;
}

async function claimJob(pool: pg.Pool): Promise<JobRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<JobRow>(`
      SELECT id, organisation_id, job_type, payload, ephemeral_secrets, attempts, max_attempts
      FROM jobs
      WHERE status = 'pending'
        AND run_after <= now()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const job = res.rows[0];
    if (!job) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `UPDATE jobs
       SET status = 'running', locked_at = now(), locked_by = $2, attempts = attempts + 1
       WHERE id = $1`,
      [job.id, WORKER_ID],
    );
    await client.query("COMMIT");
    return job;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function loadConnection(
  pool: pg.Pool,
  connectionId: string,
  orgId: string,
): Promise<{
  meta: {
    host: string;
    port: number;
    database_name: string;
    username: string;
    ssl_mode: string | null;
    project_ref: string | null;
    target_type: string;
  };
  secrets: EncryptedBlob | null;
}> {
  const metaRes = await pool.query(
    `SELECT host, port, database_name, username, ssl_mode, project_ref, target_type
     FROM database_connections
     WHERE id = $1 AND organisation_id = $2`,
    [connectionId, orgId],
  );
  const meta = metaRes.rows[0];
  if (!meta) throw new Error("Connection not found");

  const secretRes = await pool.query(
    `SELECT ciphertext, nonce, wrapped_dek, kek_version
     FROM connection_secrets
     WHERE connection_id = $1 AND organisation_id = $2`,
    [connectionId, orgId],
  );
  const secrets = secretRes.rows[0]
    ? (secretRes.rows[0] as EncryptedBlob)
    : null;
  return { meta, secrets };
}

async function processAssessmentJob(
  pool: pg.Pool,
  job: JobRow,
): Promise<void> {
  const payload = job.payload;
  if (!payload.runId || !payload.connectionId) {
    throw new Error("assessment job missing runId/connectionId");
  }

  await pool.query(
    `UPDATE assessment_runs SET status = 'collecting', started_at = now(), progress = 5
     WHERE id = $1 AND organisation_id = $2`,
    [payload.runId, job.organisation_id],
  );

  const { meta, secrets } = await loadConnection(
    pool,
    payload.connectionId,
    job.organisation_id,
  );

  let password: string | undefined;
  let managementToken: string | undefined;
  const secretSource = job.ephemeral_secrets ?? secrets;
  if (secretSource) {
    const plain = decryptSecret(secretSource);
    try {
      const parsed = JSON.parse(plain) as {
        password?: string;
        managementToken?: string;
      };
      password = parsed.password;
      managementToken = parsed.managementToken;
    } catch {
      password = plain;
    }
  }

  const config: TargetConnectionConfig = {
    host: meta.host,
    port: meta.port,
    database: meta.database_name,
    user: meta.username,
    password,
    ssl: meta.ssl_mode === "disable" ? false : { rejectUnauthorized: meta.ssl_mode === "verify-full" },
    projectRef: meta.project_ref ?? undefined,
    managementToken,
    allowPrivateNetwork: payload.allowPrivateNetwork === true,
  };

  const preflight = await runPreflight(config);
  if (!preflight.ok) {
    throw new Error(preflight.error ?? "Preflight failed");
  }

  const { context, close } = await createAssessmentContext(config, preflight, {
    info: (msg, meta) => log.info(redactValue(meta ?? {}), msg),
    warn: (msg, meta) => log.warn(redactValue(meta ?? {}), msg),
    error: (msg, meta) => log.error(redactValue(meta ?? {}), msg),
  });

  try {
    await pool.query(
      `UPDATE assessment_runs SET status = 'evaluating', progress = 20 WHERE id = $1`,
      [payload.runId],
    );

    const completed = await executeAssessment(
      allControls,
      context,
      {
        runId: payload.runId,
        organisationId: job.organisation_id,
        projectId: payload.projectId ?? "",
        environmentId: payload.environmentId ?? "",
        targetFingerprint: preflight.fingerprint,
        postgresVersion: preflight.postgresVersion,
        extensions: preflight.extensions,
        capabilities: preflight.capabilities,
        controlLibraryVersion: CONTROL_LIBRARY_VERSION,
        frameworkLibraryVersion: FRAMEWORK_LIBRARY_VERSION,
        frameworkPacks: payload.frameworkPacks ?? ["ism"],
      },
      { concurrency: 4, overallTimeoutMs: 15 * 60_000 },
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of completed.results) {
        await client.query(
          `INSERT INTO control_executions (
            organisation_id, run_id, control_id, control_version, status, severity,
            summary, expected, actual, evidence, evidence_summary, duration_ms,
            categories, mappings, remediation
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            job.organisation_id,
            payload.runId,
            r.controlId,
            r.controlVersion,
            r.status,
            r.severity,
            r.summary,
            r.expected,
            r.actual,
            JSON.stringify(r.evidence),
            r.evidenceSummary,
            r.durationMs,
            JSON.stringify(r.categories),
            JSON.stringify(r.mappings),
            JSON.stringify(r.remediation),
          ],
        );
      }

      await client.query(
        `INSERT INTO report_snapshots (organisation_id, run_id, digest, payload)
         VALUES ($1,$2,$3,$4)`,
        [
          job.organisation_id,
          payload.runId,
          completed.digest,
          JSON.stringify({
            manifest: completed.manifest,
            resultCount: completed.results.length,
            status: completed.status,
          }),
        ],
      );

      await client.query(
        `UPDATE assessment_runs
         SET status = $2, digest = $3, manifest = $4, progress = 100, completed_at = now()
         WHERE id = $1`,
        [
          payload.runId,
          completed.status,
          completed.digest,
          JSON.stringify(completed.manifest),
        ],
      );

      await client.query(
        `INSERT INTO audit_events (organisation_id, action, resource_type, resource_id, metadata)
         VALUES ($1,'assessment.completed','assessment_run',$2,$3)`,
        [
          job.organisation_id,
          payload.runId,
          JSON.stringify({ digest: completed.digest, status: completed.status }),
        ],
      );

      await client.query(
        `UPDATE jobs SET status = 'completed', completed_at = now(), ephemeral_secrets = NULL
         WHERE id = $1`,
        [job.id],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    log.info(
      { runId: payload.runId, digest: completed.digest, status: completed.status },
      "assessment completed",
    );
  } finally {
    await close();
  }
}

async function failJob(
  pool: pg.Pool,
  job: JobRow,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const retry = job.attempts + 1 < job.max_attempts;
  await pool.query(
    `UPDATE jobs
     SET status = $2,
         last_error = $3,
         run_after = CASE WHEN $4 THEN now() + interval '30 seconds' ELSE run_after END,
         locked_at = NULL,
         locked_by = NULL,
         completed_at = CASE WHEN $4 THEN NULL ELSE now() END,
         ephemeral_secrets = CASE WHEN $4 THEN ephemeral_secrets ELSE NULL END
     WHERE id = $1`,
    [job.id, retry ? "pending" : "failed", message, retry],
  );
  if (job.payload.runId) {
    await pool.query(
      `UPDATE assessment_runs SET status = 'failed', error_message = $2
       WHERE id = $1 AND status NOT IN ('completed','approved')`,
      [job.payload.runId, message],
    );
  }
  log.error({ jobId: job.id, err: message, retry }, "job failed");
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log.warn("DATABASE_URL not set — worker idle (demo mode)");
    // Keep process alive for docker compose without DB
    setInterval(() => log.info("waiting for DATABASE_URL"), 60_000);
    return;
  }
  if (!process.env.SUPACOMPLIANT_KEK) {
    throw new Error("SUPACOMPLIANT_KEK required");
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  log.info({ workerId: WORKER_ID }, "worker started");

  for (;;) {
    let job: JobRow | null = null;
    try {
      job = await claimJob(pool);
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      log.info({ jobId: job.id, type: job.job_type }, "claimed job");
      if (job.job_type === "assessment.run") {
        await processAssessmentJob(pool, job);
      } else {
        throw new Error(`Unknown job type: ${job.job_type}`);
      }
    } catch (e) {
      if (job) {
        await failJob(pool, job, e).catch((err) =>
          log.error({ err }, "failJob error"),
        );
      } else {
        log.error({ err: e instanceof Error ? e.message : e }, "loop error");
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

main().catch((e) => {
  log.fatal(e);
  process.exit(1);
});
