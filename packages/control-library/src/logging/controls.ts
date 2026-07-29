import { defineControl, evalResult, map, rem } from "../helpers.js";

const ISM = "https://www.cyber.gov.au/ism";

export const loggingControls = [
  defineControl({
    id: "pg.logging.pgaudit_installed",
    version: "1.0.0",
    title: "pgAudit extension availability",
    description: "Checks whether pgaudit extension is installed.",
    rationale: "Detailed statement auditing supports incident investigation.",
    severity: "high",
    categories: ["logging", "audit"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => ({
      installed: ctx.extensions.includes("pgaudit"),
      extensions: ctx.extensions,
    }),
    evaluate: (input) => {
      if (input.installed) {
        return evalResult("pass", {
          summary: "pgaudit extension is installed",
          expected: "pgaudit installed and configured",
          actual: "installed",
          evidence: input,
          evidenceSummary: "pgaudit present",
        });
      }
      return evalResult("fail", {
        summary: "pgaudit extension not installed",
        expected: "pgaudit installed and configured",
        actual: "missing",
        evidence: input,
        evidenceSummary: "pgaudit missing",
      });
    },
    remediation: rem("Install pgaudit where platform permits", [
      "CREATE EXTENSION pgaudit",
      "Configure pgaudit.log classes",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Event Logging",
        "directly_supports",
        "Database event logging capability",
        ISM,
        "high",
      ),
      map(
        "nist-800-53",
        "Rev. 5",
        "AU-2",
        "partially_supports",
        "Audit events",
        "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
        "medium",
        "NIST SP 800-53 Rev. 5",
      ),
    ],
  }),

  defineControl({
    id: "pg.logging.pgaudit_enabled",
    version: "1.0.0",
    title: "pgAudit log classes configured",
    description: "Reads pgaudit.log setting when accessible.",
    rationale: "Installed but disabled audit provides false assurance.",
    severity: "high",
    categories: ["logging", "audit"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["audit_log"],
    missingCapabilityStatus: "unknown",
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ name: string; setting: string }>(`
          SELECT name, setting FROM pg_settings
          WHERE name LIKE 'pgaudit%'
          ORDER BY 1
        `);
        return {
          settings: Object.fromEntries(rows.map((r) => [r.name, r.setting])),
          readable: true,
        };
      } catch {
        return { settings: {}, readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read pgaudit settings",
          expected: "pgaudit.log includes write/ddl/role as appropriate",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      const value = input.settings["pgaudit.log"] ?? "";
      if (!value || value === "none") {
        return evalResult("fail", {
          summary: "pgaudit.log is none or empty",
          expected: "pgaudit.log includes write/ddl/role as appropriate",
          actual: value || "empty",
          evidence: input,
          evidenceSummary: "pgaudit disabled",
        });
      }
      return evalResult("pass", {
        summary: `pgaudit.log=${value}`,
        expected: "pgaudit.log includes write/ddl/role as appropriate",
        actual: value,
        evidence: input,
        evidenceSummary: value,
      });
    },
    remediation: rem("Configure pgaudit.log", [
      "SET pgaudit.log = 'write, ddl, role'",
      "On Supabase: configure via supported role-level settings",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Event Logging",
        "directly_supports",
        "Audit classes enabled",
        ISM,
        "high",
      ),
      map(
        "soc2",
        "2017",
        "CC7.2",
        "partially_supports",
        "System monitoring",
        "https://www.aicpa.org/soc2",
      ),
    ],
  }),

  defineControl({
    id: "pg.logging.connections",
    version: "1.0.0",
    title: "Connection logging",
    description: "Checks log_connections and log_disconnections.",
    rationale: "Connection events support access monitoring and forensics.",
    severity: "medium",
    categories: ["logging"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["audit_log"],
    missingCapabilityStatus: "unknown",
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ name: string; setting: string }>(`
          SELECT name, setting FROM pg_settings
          WHERE name IN ('log_connections', 'log_disconnections', 'log_hostname')
        `);
        return {
          settings: Object.fromEntries(rows.map((r) => [r.name, r.setting])),
          readable: true,
        };
      } catch {
        return { settings: {}, readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read connection logging settings",
          expected: "log_connections=on",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      if (input.settings.log_connections === "on") {
        return evalResult("pass", {
          summary: "log_connections is on",
          expected: "log_connections=on",
          actual: JSON.stringify(input.settings),
          evidence: input,
          evidenceSummary: "connections logged",
        });
      }
      return evalResult("fail", {
        summary: "log_connections is not on",
        expected: "log_connections=on",
        actual: input.settings.log_connections ?? "missing",
        evidence: input,
        evidenceSummary: "connections not logged",
      });
    },
    remediation: rem("Enable connection logging", [
      "log_connections = on",
      "log_disconnections = on",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Event Logging",
        "partially_supports",
        "Authentication/session events",
        ISM,
      ),
      map(
        "cis-postgresql",
        "1.2.0",
        "3.1",
        "directly_supports",
        "Logging connections",
        "https://www.cisecurity.org/benchmark/postgresql",
      ),
    ],
  }),

  defineControl({
    id: "pg.logging.failed_auth_visibility",
    version: "1.0.0",
    title: "Failed authentication visibility",
    description:
      "Checks log_min_messages / log_line_prefix patterns that aid failed auth analysis.",
    rationale: "Failed logins must be visible for brute-force detection.",
    severity: "medium",
    categories: ["logging"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["audit_log"],
    missingCapabilityStatus: "unknown",
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ name: string; setting: string }>(`
          SELECT name, setting FROM pg_settings
          WHERE name IN ('log_min_messages', 'log_line_prefix', 'log_statement')
        `);
        return {
          settings: Object.fromEntries(rows.map((r) => [r.name, r.setting])),
          readable: true,
        };
      } catch {
        return { settings: {}, readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read logging verbosity settings",
          expected: "Failed auth events retained in central logs",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      return evalResult("manual_review", {
        summary: "Verify failed authentication appears in centralised logs",
        expected: "Failed auth events retained in central logs",
        actual: JSON.stringify(input.settings),
        evidence: input,
        evidenceSummary: "settings captured; export path needs human check",
      });
    },
    remediation: rem("Ensure failed auth is exported centrally", [
      "Configure log drain / SIEM",
      "Test with intentional failed login in non-prod",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Monitoring",
        "manual_validation_required",
        "Need evidence of central monitoring of failed auth",
        ISM,
      ),
    ],
  }),

  defineControl({
    id: "pg.logging.timezone_consistency",
    version: "1.0.0",
    title: "Timezone consistency for logs",
    description: "Records TimeZone and log_timezone settings.",
    rationale: "Inconsistent timezones hinder correlation across systems.",
    severity: "low",
    categories: ["logging"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ name: string; setting: string }>(`
          SELECT name, setting FROM pg_settings
          WHERE name IN ('TimeZone', 'log_timezone')
        `);
        return {
          settings: Object.fromEntries(rows.map((r) => [r.name, r.setting])),
          readable: true,
        };
      } catch {
        return { settings: {}, readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read timezone settings",
          expected: "UTC or consistent enterprise timezone",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      const tz = input.settings.TimeZone;
      const ltz = input.settings.log_timezone;
      if (tz && ltz && tz !== ltz) {
        return evalResult("warning", {
          summary: "TimeZone and log_timezone differ",
          expected: "UTC or consistent enterprise timezone",
          actual: `TimeZone=${tz}, log_timezone=${ltz}`,
          evidence: input,
          evidenceSummary: "mismatch",
        });
      }
      return evalResult("pass", {
        summary: `Timezone settings: ${tz ?? "n/a"}`,
        expected: "UTC or consistent enterprise timezone",
        actual: JSON.stringify(input.settings),
        evidence: input,
        evidenceSummary: tz ?? "n/a",
      });
    },
    remediation: rem("Align TimeZone and log_timezone", [
      "Prefer UTC for multi-region correlation",
    ]),
    mappings: [
      map(
        "nist-800-53",
        "Rev. 5",
        "AU-8",
        "partially_supports",
        "Time stamps",
        "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
        "medium",
        "NIST SP 800-53 Rev. 5",
      ),
    ],
  }),

  defineControl({
    id: "pg.logging.central_export_evidence",
    version: "1.0.0",
    title: "Centralised log export evidence",
    description:
      "Cannot fully verify SIEM export via SQL alone — requires manual evidence.",
    rationale: "Local logs without export fail retention and integrity goals.",
    severity: "high",
    categories: ["logging"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ requiresEvidence: true }),
    evaluate: () =>
      evalResult("manual_review", {
        summary: "Provide evidence of log drain / SIEM integration",
        expected: "Central export with retention and access control",
        actual: "not verified automatically",
        evidence: { requiresEvidence: true },
        evidenceSummary: "manual evidence required",
      }),
    remediation: rem("Configure and evidence log export", [
      "Supabase: Log drains",
      "Self-host: ship postgres logs to SIEM",
      "Attach retention policy evidence",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Log Protection",
        "manual_validation_required",
        "Integrity and centralisation of logs",
        ISM,
        "high",
      ),
      map(
        "essential-eight",
        "2023",
        "Regular backups",
        "evidence_contributes",
        "Logging supports recovery investigations; not a backup control itself",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "low",
      ),
    ],
  }),

  defineControl({
    id: "pg.logging.log_statement",
    version: "1.0.0",
    title: "log_statement setting",
    description: "Records log_statement (none/ddl/mod/all).",
    rationale: "Insufficient statement logging weakens accountability.",
    severity: "medium",
    categories: ["logging"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["audit_log"],
    missingCapabilityStatus: "unknown",
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ setting: string }>(`
          SELECT setting FROM pg_settings WHERE name = 'log_statement'
        `);
        return { value: rows[0]?.setting ?? "unknown", readable: true };
      } catch {
        return { value: "unknown", readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable || input.value === "unknown") {
        return evalResult("unknown", {
          summary: "Cannot read log_statement",
          expected: "ddl or mod (or pgaudit covering writes)",
          actual: "unknown",
          evidence: input,
          evidenceSummary: "unknown",
        });
      }
      if (input.value === "none") {
        return evalResult("warning", {
          summary: "log_statement is none — rely on pgaudit or raise level",
          expected: "ddl or mod (or pgaudit covering writes)",
          actual: "none",
          evidence: input,
          evidenceSummary: "none",
        });
      }
      return evalResult("pass", {
        summary: `log_statement=${input.value}`,
        expected: "ddl or mod (or pgaudit covering writes)",
        actual: input.value,
        evidence: input,
        evidenceSummary: input.value,
      });
    },
    remediation: rem("Increase statement logging or enable pgaudit", [
      "log_statement = 'ddl'",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "3.2",
        "partially_supports",
        "Statement logging",
        "https://www.cisecurity.org/benchmark/postgresql",
      ),
    ],
  }),
];
