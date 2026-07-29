import { defineControl, evalResult, map, rem } from "../helpers.js";

export const resilienceControls = [
  defineControl({
    id: "pg.resilience.connection_saturation",
    version: "1.0.0",
    title: "Connection saturation risk",
    description: "Compares active connections to max_connections.",
    rationale: "Saturation causes outages and can be used as a DoS vector.",
    severity: "medium",
    categories: ["resilience"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["monitoring"],
    missingCapabilityStatus: "unknown",
    collect: async (ctx) => {
      try {
        const max = await ctx.query<{ setting: string }>(`
          SELECT setting FROM pg_settings WHERE name = 'max_connections'
        `);
        const cur = await ctx.query<{ count: string }>(`
          SELECT count(*)::text AS count FROM pg_stat_activity
        `);
        return {
          maxConnections: Number(max[0]?.setting ?? 0),
          current: Number(cur[0]?.count ?? 0),
          readable: true,
        };
      } catch {
        return { maxConnections: 0, current: 0, readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable || !input.maxConnections) {
        return evalResult("unknown", {
          summary: "Cannot measure connection usage",
          expected: "Usage well below max_connections",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      const ratio = input.current / input.maxConnections;
      if (ratio >= 0.9) {
        return evalResult("fail", {
          summary: `Connections at ${(ratio * 100).toFixed(0)}% of max`,
          expected: "Usage well below max_connections",
          actual: `${input.current}/${input.maxConnections}`,
          evidence: input,
          evidenceSummary: `${input.current}/${input.maxConnections}`,
        });
      }
      if (ratio >= 0.75) {
        return evalResult("warning", {
          summary: `Connections at ${(ratio * 100).toFixed(0)}% of max`,
          expected: "Usage well below max_connections",
          actual: `${input.current}/${input.maxConnections}`,
          evidence: input,
          evidenceSummary: `${input.current}/${input.maxConnections}`,
        });
      }
      return evalResult("pass", {
        summary: `Connections ${input.current}/${input.maxConnections}`,
        expected: "Usage well below max_connections",
        actual: `${input.current}/${input.maxConnections}`,
        evidence: input,
        evidenceSummary: `${input.current}/${input.maxConnections}`,
      });
    },
    remediation: rem("Reduce connection pressure", [
      "Use pooling (PgBouncer/Supabase pooler)",
      "Fix connection leaks",
      "Raise max only with memory headroom",
    ]),
    mappings: [
      map(
        "soc2",
        "2017",
        "A1.1",
        "evidence_contributes",
        "Capacity monitoring",
        "https://www.aicpa.org/soc2",
      ),
    ],
  }),

  defineControl({
    id: "pg.resilience.long_transactions",
    version: "1.0.0",
    title: "Long-running transactions",
    description: "Detects transactions open longer than 30 minutes.",
    rationale: "Long transactions block vacuum and increase bloat/outage risk.",
    severity: "medium",
    categories: ["resilience"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["monitoring"],
    missingCapabilityStatus: "unknown",
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{
          pid: number;
          usename: string;
          state: string;
          duration_seconds: string;
        }>(`
          SELECT pid, usename, state,
            EXTRACT(EPOCH FROM (now() - xact_start))::bigint::text AS duration_seconds
          FROM pg_stat_activity
          WHERE xact_start IS NOT NULL
            AND now() - xact_start > interval '30 minutes'
            AND pid <> pg_backend_pid()
          ORDER BY xact_start
          LIMIT 50
        `);
        return { longTx: rows, readable: true };
      } catch {
        return { longTx: [], readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read pg_stat_activity",
          expected: "No multi-hour idle-in-transaction sessions",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      if (input.longTx.length === 0) {
        return evalResult("pass", {
          summary: "No transactions older than 30 minutes",
          expected: "No multi-hour idle-in-transaction sessions",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 long tx",
        });
      }
      return evalResult("warning", {
        summary: `${input.longTx.length} long-running transactions`,
        expected: "No multi-hour idle-in-transaction sessions",
        actual: input.longTx
          .slice(0, 10)
          .map((t) => `pid=${t.pid} ${t.duration_seconds}s`)
          .join("; "),
        evidence: input,
        evidenceSummary: `${input.longTx.length} long tx`,
      });
    },
    remediation: rem("Investigate and terminate stuck transactions", [
      "SELECT pg_terminate_backend(pid)",
      "Fix application transaction boundaries",
    ]),
    mappings: [
      map(
        "nist-csf",
        "2.0",
        "PR.PS",
        "evidence_contributes",
        "Platform reliability hygiene",
        "https://www.nist.gov/cyberframework",
      ),
    ],
  }),

  defineControl({
    id: "pg.resilience.idle_in_transaction",
    version: "1.0.0",
    title: "Idle in transaction sessions",
    description: "Counts sessions in idle in transaction state.",
    rationale: "Idle-in-transaction holds locks and hurts availability.",
    severity: "medium",
    categories: ["resilience"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["monitoring"],
    missingCapabilityStatus: "unknown",
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ count: string }>(`
          SELECT count(*)::text AS count FROM pg_stat_activity
          WHERE state = 'idle in transaction' AND pid <> pg_backend_pid()
        `);
        return { count: Number(rows[0]?.count ?? 0), readable: true };
      } catch {
        return { count: 0, readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot count idle-in-transaction sessions",
          expected: "Near-zero idle in transaction",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      if (input.count === 0) {
        return evalResult("pass", {
          summary: "No idle-in-transaction sessions",
          expected: "Near-zero idle in transaction",
          actual: "0",
          evidence: input,
          evidenceSummary: "0",
        });
      }
      if (input.count >= 5) {
        return evalResult("fail", {
          summary: `${input.count} idle-in-transaction sessions`,
          expected: "Near-zero idle in transaction",
          actual: String(input.count),
          evidence: input,
          evidenceSummary: String(input.count),
        });
      }
      return evalResult("warning", {
        summary: `${input.count} idle-in-transaction sessions`,
        expected: "Near-zero idle in transaction",
        actual: String(input.count),
        evidence: input,
        evidenceSummary: String(input.count),
      });
    },
    remediation: rem("Set idle_in_transaction_session_timeout", [
      "idle_in_transaction_session_timeout = '60s'",
    ]),
    mappings: [
      map(
        "soc2",
        "2017",
        "A1.2",
        "evidence_contributes",
        "Availability protections",
        "https://www.aicpa.org/soc2",
      ),
    ],
  }),

  defineControl({
    id: "pg.resilience.invalid_indexes",
    version: "1.0.0",
    title: "Invalid indexes",
    description: "Finds indexes left INVALID after failed CREATE INDEX CONCURRENTLY.",
    rationale: "Invalid indexes waste space and mislead planners.",
    severity: "low",
    categories: ["resilience"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        schemaname: string;
        indexname: string;
      }>(`
        SELECT n.nspname AS schemaname, c.relname AS indexname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relkind = 'i' AND i.indisvalid = false
        ORDER BY 1, 2
      `);
      return { indexes: rows };
    },
    evaluate: (input) => {
      if (input.indexes.length === 0) {
        return evalResult("pass", {
          summary: "No invalid indexes",
          expected: "No INVALID indexes",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 invalid",
        });
      }
      return evalResult("fail", {
        summary: `${input.indexes.length} invalid indexes`,
        expected: "No INVALID indexes",
        actual: input.indexes
          .map((i) => `${i.schemaname}.${i.indexname}`)
          .join(", "),
        evidence: input,
        evidenceSummary: `${input.indexes.length} invalid`,
      });
    },
    remediation: rem("Drop and rebuild invalid indexes", [
      "DROP INDEX CONCURRENTLY ...",
      "CREATE INDEX CONCURRENTLY ...",
    ]),
    mappings: [
      map(
        "cis-controls",
        "8.0",
        "3.3",
        "evidence_contributes",
        "Data management hygiene",
        "https://www.cisecurity.org/controls/v8",
        "low",
      ),
    ],
  }),

  defineControl({
    id: "pg.resilience.database_size",
    version: "1.0.0",
    title: "Database size baseline",
    description: "Records current database size for growth tracking.",
    rationale: "Baseline size supports capacity and anomaly detection.",
    severity: "informational",
    categories: ["resilience"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ size_bytes: string; size_pretty: string }>(`
        SELECT pg_database_size(current_database())::text AS size_bytes,
               pg_size_pretty(pg_database_size(current_database())) AS size_pretty
      `);
      return {
        sizeBytes: Number(rows[0]?.size_bytes ?? 0),
        sizePretty: rows[0]?.size_pretty ?? "unknown",
      };
    },
    evaluate: (input) =>
      evalResult("pass", {
        summary: `Database size ${input.sizePretty}`,
        expected: "Size recorded for baseline",
        actual: input.sizePretty,
        evidence: input,
        evidenceSummary: input.sizePretty,
      }),
    remediation: rem("Monitor growth trends", [
      "Alert on unexpected growth",
      "Review bloat and retention",
    ]),
    mappings: [
      map(
        "nist-csf",
        "2.0",
        "ID.AM",
        "evidence_contributes",
        "Asset/capacity awareness",
        "https://www.nist.gov/cyberframework",
        "low",
      ),
    ],
  }),

  defineControl({
    id: "pg.resilience.migration_tracking",
    version: "1.0.0",
    title: "Migration history table present",
    description:
      "Looks for common migration history tables (schema_migrations, supabase_migrations).",
    rationale: "Untracked schema change undermines change control and recovery.",
    severity: "medium",
    categories: ["resilience", "change_management"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        table_schema: string;
        table_name: string;
      }>(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_name IN (
          'schema_migrations', 'supabase_migrations', 'flyway_schema_history',
          'drizzle_migrations', 'knex_migrations', '__drizzle_migrations', 'schema_migration'
        )
           OR (table_schema = 'supabase_migrations' AND table_name = 'schema_migrations')
        ORDER BY 1, 2
      `);
      // also list supabase_migrations schema tables
      const supa = await ctx.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'supabase_migrations'
        ORDER BY 1
      `);
      return { tables: rows, supabaseMigrationTables: supa.map((t) => t.table_name) };
    },
    evaluate: (input) => {
      if (input.tables.length > 0 || input.supabaseMigrationTables.length > 0) {
        return evalResult("pass", {
          summary: "Migration history artefacts present",
          expected: "Schema changes tracked via migrations",
          actual: [
            ...input.tables.map((t) => `${t.table_schema}.${t.table_name}`),
            ...input.supabaseMigrationTables.map((t) => `supabase_migrations.${t}`),
          ].join(", "),
          evidence: input,
          evidenceSummary: "migration tracking found",
        });
      }
      return evalResult("warning", {
        summary: "No common migration history table detected",
        expected: "Schema changes tracked via migrations",
        actual: "none",
        evidence: input,
        evidenceSummary: "no migration tables",
      });
    },
    remediation: rem("Adopt migration tooling", [
      "Use Supabase migrations, Drizzle, Flyway, or similar",
      "Forbid ad-hoc production DDL without records",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Change Management",
        "evidence_contributes",
        "Tracked configuration changes",
        "https://www.cyber.gov.au/ism",
      ),
      map(
        "iso27001",
        "2022",
        "A.8.32",
        "evidence_contributes",
        "Change management",
        "https://www.iso.org/standard/27001",
      ),
    ],
  }),

  defineControl({
    id: "pg.resilience.backup_pitr_evidence",
    version: "1.0.0",
    title: "Backup and PITR evidence",
    description:
      "Backup/PITR posture cannot be fully proven from SQL alone — manual evidence required.",
    rationale: "Regular backups are Essential Eight relevant; must not fake pass.",
    severity: "critical",
    categories: ["resilience", "backups"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ requiresEvidence: true }),
    evaluate: () =>
      evalResult("manual_review", {
        summary: "Provide backup schedule, PITR window, and restore-test evidence",
        expected: "Documented backups + successful restore test",
        actual: "not verified automatically",
        evidence: { requiresEvidence: true },
        evidenceSummary: "manual backup evidence required",
      }),
    remediation: rem("Evidence backups and restore tests", [
      "Supabase: confirm PITR enabled for production",
      "Self-host: WAL archiving + verified restore",
      "Attach last restore test date",
    ]),
    mappings: [
      map(
        "essential-eight",
        "2023",
        "Regular backups",
        "manual_validation_required",
        "Backups require organisational evidence; DB probe alone insufficient",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "high",
      ),
      map(
        "ism",
        "2025",
        "Backups",
        "manual_validation_required",
        "Backup effectiveness evidence",
        "https://www.cyber.gov.au/ism",
        "high",
      ),
      map(
        "soc2",
        "2017",
        "A1.2",
        "manual_validation_required",
        "Recovery evidence",
        "https://www.aicpa.org/soc2",
      ),
    ],
  }),

  defineControl({
    id: "pg.resilience.extension_versions",
    version: "1.0.0",
    title: "Extension version inventory",
    description: "Lists installed extensions and versions for patch review.",
    rationale: "Outdated extensions carry vulnerabilities.",
    severity: "low",
    categories: ["resilience", "patching"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        extname: string;
        extversion: string;
      }>(`
        SELECT extname, extversion FROM pg_extension ORDER BY 1
      `);
      return { extensions: rows };
    },
    evaluate: (input) =>
      evalResult("pass", {
        summary: `${input.extensions.length} extensions inventoried`,
        expected: "Extensions known and patched",
        actual: `${input.extensions.length} extensions`,
        evidence: input,
        evidenceSummary: input.extensions
          .map((e) => `${e.extname}@${e.extversion}`)
          .join(", "),
        recommendations: ["Compare versions against vendor advisories"],
      }),
    remediation: rem("Upgrade outdated extensions", [
      "ALTER EXTENSION name UPDATE",
    ]),
    mappings: [
      map(
        "essential-eight",
        "2023",
        "Patch applications",
        "evidence_contributes",
        "Extension inventory supports patching process",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "medium",
      ),
    ],
  }),
];
