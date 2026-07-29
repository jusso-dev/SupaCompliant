import pg from "pg";
import type { Capability, TargetType } from "@supacompliant/shared";
import type { AssessmentContext } from "./types.js";
import { fingerprintTarget } from "./digest.js";

export interface TargetConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean | pg.ConnectionConfig["ssl"];
  statementTimeoutMs?: number;
  /** Block private IPs unless true (local diagnostic only). */
  allowPrivateNetwork?: boolean;
  projectRef?: string;
  managementToken?: string;
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.|metadata\.google|169\.254\.169\.254)/i;

export function assertSafeHost(
  host: string,
  allowPrivateNetwork?: boolean,
): void {
  if (allowPrivateNetwork) return;
  if (PRIVATE_HOST_RE.test(host) || host === "0.0.0.0") {
    throw new Error(
      `Connection host blocked for SSRF protection: ${host}. Enable local diagnostic mode only for trusted private targets.`,
    );
  }
}

export interface PreflightResult {
  ok: boolean;
  targetType: TargetType;
  isSupabase: boolean;
  postgresVersion: string;
  postgresMajor: number;
  extensions: string[];
  capabilities: Capability[];
  fingerprint: string;
  unavailableReasons: Record<string, string>;
  error?: string;
}

export async function runPreflight(
  config: TargetConnectionConfig,
): Promise<PreflightResult> {
  try {
    assertSafeHost(config.host, config.allowPrivateNetwork);
  } catch (e) {
    return {
      ok: false,
      targetType: "postgresql",
      isSupabase: false,
      postgresVersion: "",
      postgresMajor: 0,
      extensions: [],
      capabilities: [],
      fingerprint: "",
      unavailableReasons: {},
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    connectionTimeoutMillis: 10_000,
  });

  const unavailableReasons: Record<string, string> = {};

  try {
    await client.connect();
    await client.query("SET default_transaction_read_only = on");
    await client.query(
      `SET statement_timeout = ${config.statementTimeoutMs ?? 15_000}`,
    );

    const versionRes = await client.query<{ version: string }>(
      "SELECT version() AS version",
    );
    const version = versionRes.rows[0]?.version ?? "";
    const majorMatch = version.match(/PostgreSQL\s+(\d+)/i);
    const postgresMajor = majorMatch ? Number(majorMatch[1]) : 0;

    const extRes = await client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension ORDER BY 1",
    );
    const extensions = extRes.rows.map((r) => r.extname);

    // Supabase heuristic: supabase_admin role or auth schema presence
    const supabaseProbe = await client.query<{ is_supabase: boolean }>(`
      SELECT (
        EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin')
        OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')
        OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage')
      ) AS is_supabase
    `);
    const isSupabase = Boolean(supabaseProbe.rows[0]?.is_supabase);
    const targetType: TargetType = isSupabase ? "supabase" : "postgresql";

    const capabilities: Capability[] = ["basic_catalogue"];

    try {
      await client.query("SELECT 1 FROM pg_stat_activity LIMIT 1");
      capabilities.push("monitoring");
    } catch {
      unavailableReasons.monitoring =
        "Cannot read pg_stat_activity — grant pg_monitor or equivalent";
    }

    try {
      await client.query(`
        SELECT name, setting FROM pg_settings
        WHERE name IN ('log_connections', 'pgaudit.log')
        LIMIT 5
      `);
      capabilities.push("audit_log");
    } catch {
      unavailableReasons.audit_log =
        "Cannot read pg_settings for logging parameters";
    }

    if (config.managementToken && config.projectRef) {
      capabilities.push("supabase_management");
    } else if (isSupabase) {
      unavailableReasons.supabase_management =
        "No Management API token provided — Auth/Storage project settings limited";
    }

    capabilities.push("manual_evidence");

    const fingerprint = fingerprintTarget({
      host: config.host,
      port: config.port,
      database: config.database,
      projectRef: config.projectRef,
      serverVersion: version,
    });

    return {
      ok: true,
      targetType,
      isSupabase,
      postgresVersion: version,
      postgresMajor,
      extensions,
      capabilities,
      fingerprint,
      unavailableReasons,
    };
  } catch (e) {
    return {
      ok: false,
      targetType: "postgresql",
      isSupabase: false,
      postgresVersion: "",
      postgresMajor: 0,
      extensions: [],
      capabilities: [],
      fingerprint: "",
      unavailableReasons: {},
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function createAssessmentContext(
  config: TargetConnectionConfig,
  preflight: PreflightResult,
  logger: AssessmentContext["logger"],
  signal?: AbortSignal,
): Promise<{ context: AssessmentContext; close: () => Promise<void> }> {
  assertSafeHost(config.host, config.allowPrivateNetwork);

  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    max: 4,
    connectionTimeoutMillis: 10_000,
    statement_timeout: config.statementTimeoutMs ?? 15_000,
  });

  const query = async <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(
        `SET LOCAL statement_timeout = ${config.statementTimeoutMs ?? 15_000}`,
      );
      await client.query("SET LOCAL lock_timeout = 3000");
      const res = await client.query<T>(sql, params);
      await client.query("COMMIT");
      return res.rows;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  };

  let managementGet: AssessmentContext["managementGet"];
  if (config.managementToken && config.projectRef) {
    managementGet = async <T>(path: string): Promise<T> => {
      const url = `https://api.supabase.com/v1${path.startsWith("/") ? path : `/${path}`}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.managementToken}`,
          Accept: "application/json",
        },
        signal,
      });
      if (!res.ok) {
        throw new Error(`Management API ${res.status}: ${path}`);
      }
      return (await res.json()) as T;
    };
  }

  const context: AssessmentContext = {
    targetType: preflight.targetType,
    postgresVersion: preflight.postgresVersion,
    postgresMajor: preflight.postgresMajor,
    extensions: preflight.extensions,
    capabilities: new Set(preflight.capabilities),
    isSupabase: preflight.isSupabase,
    query,
    managementGet,
    signal,
    logger,
  };

  return {
    context,
    close: async () => {
      await pool.end();
    },
  };
}
