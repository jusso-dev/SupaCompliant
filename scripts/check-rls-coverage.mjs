#!/usr/bin/env node
/**
 * Fail if a known tenant table is missing RLS enablement in migrations.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TENANT_TABLES = [
  "organisations",
  "memberships",
  "invitations",
  "projects",
  "environments",
  "database_connections",
  "connection_secrets",
  "assessment_profiles",
  "assessment_runs",
  "control_executions",
  "report_snapshots",
  "findings",
  "comment_threads",
  "comments",
  "audit_events",
  "jobs",
  "api_keys",
  "webhooks",
  "notifications",
  "exceptions",
  "risk_acceptances",
];

const migDir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(migDir).filter((f) => f.endsWith(".sql"));
const sql = files.map((f) => readFileSync(join(migDir, f), "utf8")).join("\n");

const missing = [];
for (const table of TENANT_TABLES) {
  const enable = new RegExp(
    `ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`,
    "i",
  );
  if (!enable.test(sql)) {
    missing.push(table);
  }
}

if (missing.length) {
  console.error("RLS coverage check failed. Missing ENABLE RLS for:");
  for (const t of missing) console.error(`  - ${t}`);
  process.exit(1);
}

console.log(`RLS coverage OK (${TENANT_TABLES.length} tenant tables).`);
