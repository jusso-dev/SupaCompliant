import { defineControl, evalResult, map, rem } from "../helpers.js";

const CIS = "https://www.cisecurity.org/benchmark/postgresql";
const ISM = "https://www.cyber.gov.au/ism";

/** PostgreSQL majors still commonly supported as of 2026 planning horizon */
const SUPPORTED_MAJORS = new Set([14, 15, 16, 17, 18]);
const EOL_SOON = new Set([13]);

const DANGEROUS_EXTENSIONS = new Set([
  "plpythonu",
  "plpython3u",
  "plperlu",
  "plperlu",
  "dblink",
  "postgres_fdw",
  "file_fdw",
  "adminpack",
]);

export const hardeningControls = [
  defineControl({
    id: "pg.hardening.version_supported",
    version: "1.0.0",
    title: "Supported PostgreSQL major version",
    description: "Ensures the server major version is within supported set.",
    rationale: "EOL PostgreSQL versions miss security fixes.",
    severity: "critical",
    categories: ["hardening", "patching"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => ({
      version: ctx.postgresVersion,
      major: ctx.postgresMajor,
    }),
    evaluate: (input) => {
      if (!input.major) {
        return evalResult("unknown", {
          summary: "Could not parse PostgreSQL major version",
          expected: `Supported majors: ${[...SUPPORTED_MAJORS].join(", ")}`,
          actual: input.version,
          evidence: input,
          evidenceSummary: "unparsed version",
        });
      }
      if (SUPPORTED_MAJORS.has(input.major)) {
        return evalResult("pass", {
          summary: `PostgreSQL ${input.major} is in supported set`,
          expected: `Supported majors: ${[...SUPPORTED_MAJORS].join(", ")}`,
          actual: String(input.major),
          evidence: input,
          evidenceSummary: `PG ${input.major}`,
        });
      }
      if (EOL_SOON.has(input.major)) {
        return evalResult("warning", {
          summary: `PostgreSQL ${input.major} approaching or past community support window`,
          expected: `Supported majors: ${[...SUPPORTED_MAJORS].join(", ")}`,
          actual: String(input.major),
          evidence: input,
          evidenceSummary: `PG ${input.major} review`,
        });
      }
      return evalResult("fail", {
        summary: `PostgreSQL ${input.major} not in supported set`,
        expected: `Supported majors: ${[...SUPPORTED_MAJORS].join(", ")}`,
        actual: String(input.major),
        evidence: input,
        evidenceSummary: `PG ${input.major} unsupported`,
      });
    },
    remediation: rem("Upgrade PostgreSQL to a supported major", [
      "Plan upgrade path via logical dump/restore or in-place vendor path",
      "Test extensions and application compatibility",
    ]),
    mappings: [
      map(
        "essential-eight",
        "2023",
        "Patch applications",
        "evidence_contributes",
        "Database engine is a critical application dependency",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "medium",
      ),
      map(
        "ism",
        "2025",
        "Patching",
        "partially_supports",
        "Supported platform versions",
        ISM,
      ),
      map(
        "cis-controls",
        "8.0",
        "2.2",
        "evidence_contributes",
        "Software inventory / supported software",
        "https://www.cisecurity.org/controls/v8",
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.dangerous_extensions",
    version: "1.0.0",
    title: "High-risk extensions installed",
    description:
      "Flags untrusted languages, dblink/FDW and adminpack when present.",
    rationale:
      "These extensions expand the ability to reach OS, remote DBs, or escalate.",
    severity: "high",
    categories: ["hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const found = ctx.extensions.filter((e) => DANGEROUS_EXTENSIONS.has(e));
      return { extensions: ctx.extensions, dangerous: found };
    },
    evaluate: (input) => {
      if (input.dangerous.length === 0) {
        return evalResult("pass", {
          summary: "No high-risk extension set detected",
          expected: "Avoid untrusted languages / unconstrained FDW in prod",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 dangerous extensions",
        });
      }
      return evalResult("fail", {
        summary: `High-risk extensions: ${input.dangerous.join(", ")}`,
        expected: "Avoid untrusted languages / unconstrained FDW in prod",
        actual: input.dangerous.join(", "),
        evidence: input,
        evidenceSummary: input.dangerous.join(", "),
      });
    },
    remediation: rem("Remove unnecessary high-risk extensions", [
      "DROP EXTENSION ... CASCADE only after impact review",
      "If FDW required, restrict user mappings tightly",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "6.1",
        "partially_supports",
        "Minimize installed extensions",
        CIS,
      ),
      map(
        "ism",
        "2025",
        "System Hardening",
        "evidence_contributes",
        "Reduce attack surface",
        ISM,
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.untrusted_languages",
    version: "1.0.0",
    title: "Untrusted procedural languages",
    description: "Detects untrusted languages (lanpltrusted = false).",
    rationale: "Untrusted languages can execute with broader OS access.",
    severity: "critical",
    categories: ["hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ lanname: string; lanpltrusted: boolean }>(`
        SELECT lanname, lanpltrusted FROM pg_language
        WHERE lanname NOT IN ('internal', 'c', 'sql', 'plpgsql')
        ORDER BY 1
      `);
      return { languages: rows, untrusted: rows.filter((l) => !l.lanpltrusted) };
    },
    evaluate: (input) => {
      if (input.untrusted.length === 0) {
        return evalResult("pass", {
          summary: "No untrusted procedural languages",
          expected: "No untrusted PL in production",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 untrusted languages",
        });
      }
      return evalResult("fail", {
        summary: `Untrusted languages: ${input.untrusted.map((l) => l.lanname).join(", ")}`,
        expected: "No untrusted PL in production",
        actual: input.untrusted.map((l) => l.lanname).join(", "),
        evidence: input,
        evidenceSummary: input.untrusted.map((l) => l.lanname).join(", "),
      });
    },
    remediation: rem("Drop untrusted languages", [
      "DROP LANGUAGE plpythonu;",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "6.3",
        "directly_supports",
        "Untrusted languages",
        CIS,
        "high",
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.search_path_roles",
    version: "1.0.0",
    title: "Role search_path containing writable schemas",
    description:
      "Checks if common roles use insecure search_path patterns ($user, empty).",
    rationale: "Writable search_path enables object shadowing attacks.",
    severity: "high",
    categories: ["hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ rolname: string; search_path: string }>(`
        SELECT r.rolname,
          COALESCE(
            (SELECT option_value FROM pg_options_to_table(r.rolconfig)
             WHERE option_name = 'search_path' LIMIT 1),
            current_setting('search_path')
          ) AS search_path
        FROM pg_roles r
        WHERE r.rolcanlogin = true
          AND r.rolname NOT LIKE 'pg_%'
        ORDER BY 1
        LIMIT 100
      `);
      const risky = rows.filter((r) => {
        const sp = r.search_path.toLowerCase();
        return sp.includes("$user") || sp === '""' || sp.includes(', ""');
      });
      return { roles: rows, risky };
    },
    evaluate: (input) => {
      if (input.risky.length === 0) {
        return evalResult("pass", {
          summary: "No obvious $user search_path on login roles",
          expected: "Fixed, minimal search_path",
          actual: "ok",
          evidence: { risky: [], sample: input.roles.slice(0, 10) },
          evidenceSummary: "0 risky search_path",
        });
      }
      return evalResult("fail", {
        summary: `${input.risky.length} roles with risky search_path`,
        expected: "Fixed, minimal search_path",
        actual: input.risky.map((r) => `${r.rolname}=${r.search_path}`).join("; "),
        evidence: { risky: input.risky },
        evidenceSummary: `${input.risky.length} risky`,
      });
    },
    remediation: rem("Set fixed search_path on roles", [
      "ALTER ROLE app SET search_path = app, public",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "6.5",
        "partially_supports",
        "search_path hardening",
        CIS,
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.default_privileges_broad",
    version: "1.0.0",
    title: "Broad default privileges to PUBLIC",
    description: "Inspects default ACLs granting to PUBLIC.",
    rationale: "Default privileges can re-open PUBLIC access on new objects.",
    severity: "medium",
    categories: ["hardening", "identity"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        defaclrole: string;
        defaclnamespace: string;
        defaclobjtype: string;
        defaclacl: string;
      }>(`
        SELECT r.rolname AS defaclrole,
          COALESCE(n.nspname, '-') AS defaclnamespace,
          d.defaclobjtype::text AS defaclobjtype,
          d.defaclacl::text AS defaclacl
        FROM pg_default_acl d
        JOIN pg_roles r ON r.oid = d.defaclrole
        LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
        WHERE d.defaclacl::text ILIKE '%public=%'
        ORDER BY 1, 2
      `);
      return { acls: rows };
    },
    evaluate: (input) => {
      if (input.acls.length === 0) {
        return evalResult("pass", {
          summary: "No default privileges granting to PUBLIC detected",
          expected: "Avoid PUBLIC in ALTER DEFAULT PRIVILEGES",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 PUBLIC default ACLs",
        });
      }
      return evalResult("warning", {
        summary: `${input.acls.length} default ACL entries grant to PUBLIC`,
        expected: "Avoid PUBLIC in ALTER DEFAULT PRIVILEGES",
        actual: `${input.acls.length} entries`,
        evidence: input,
        evidenceSummary: `${input.acls.length} entries`,
      });
    },
    remediation: rem("Revoke PUBLIC from default privileges", [
      "ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "5.3",
        "partially_supports",
        "Default privileges",
        CIS,
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.ssl_setting",
    version: "1.0.0",
    title: "SSL configuration visibility",
    description: "Reads ssl-related settings where accessible.",
    rationale: "Cleartext database traffic exposes credentials and data.",
    severity: "high",
    categories: ["hardening", "cryptography"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ name: string; setting: string }>(`
          SELECT name, setting FROM pg_settings
          WHERE name IN ('ssl', 'ssl_min_protocol_version', 'ssl_ciphers')
          ORDER BY 1
        `);
        return { settings: Object.fromEntries(rows.map((r) => [r.name, r.setting])), readable: true };
      } catch {
        return { settings: {}, readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read SSL settings",
          expected: "ssl = on",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "settings not readable",
        });
      }
      if (input.settings.ssl === "on") {
        return evalResult("pass", {
          summary: "ssl is on",
          expected: "ssl = on",
          actual: JSON.stringify(input.settings),
          evidence: input,
          evidenceSummary: "ssl=on",
        });
      }
      if (input.settings.ssl === "off") {
        return evalResult("fail", {
          summary: "ssl is off",
          expected: "ssl = on",
          actual: "off",
          evidence: input,
          evidenceSummary: "ssl=off",
        });
      }
      // Supabase often terminates TLS at proxy; setting may be off on backend
      return evalResult("manual_review", {
        summary: "SSL setting not definitively on — verify TLS termination path",
        expected: "TLS enforced end-to-end or at trusted terminator",
        actual: JSON.stringify(input.settings),
        evidence: input,
        evidenceSummary: "verify TLS path",
      });
    },
    remediation: rem("Enable and enforce TLS", [
      "ssl = on",
      "Require hostssl in pg_hba.conf",
      "Prefer verify-full clients",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Cryptographic Protection",
        "partially_supports",
        "Transit protection for database traffic",
        ISM,
      ),
      map(
        "pci-dss",
        "4.0",
        "4.2",
        "evidence_contributes",
        "Protect cardholder data in transit where applicable",
        "https://www.pcisecuritystandards.org/",
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.shared_preload_dangerous",
    version: "1.0.0",
    title: "shared_preload_libraries review",
    description: "Reports shared_preload_libraries content for unexpected modules.",
    rationale: "Preloaded libraries run in backend processes and expand surface.",
    severity: "low",
    categories: ["hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ setting: string }>(`
          SELECT setting FROM pg_settings WHERE name = 'shared_preload_libraries'
        `);
        return { value: rows[0]?.setting ?? "", readable: true };
      } catch {
        return { value: "", readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read shared_preload_libraries",
          expected: "Known, minimal preload set",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      return evalResult("pass", {
        summary: "shared_preload_libraries recorded for review",
        expected: "Known, minimal preload set",
        actual: input.value || "(empty)",
        evidence: input,
        evidenceSummary: input.value || "(empty)",
        recommendations: ["Confirm each library is required"],
      });
    },
    remediation: rem("Minimize shared_preload_libraries", [
      "Remove unused libraries and restart",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "1.2",
        "evidence_contributes",
        "Configuration inventory",
        CIS,
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.event_triggers",
    version: "1.0.0",
    title: "Event trigger inventory",
    description: "Lists event triggers that can intercept DDL.",
    rationale: "Malicious or forgotten event triggers can subvert change control.",
    severity: "medium",
    categories: ["hardening", "change_management"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        evtname: string;
        evtevent: string;
        evtowner: string;
        evtenabled: string;
      }>(`
        SELECT t.evtname, t.evtevent, r.rolname AS evtowner, t.evtenabled::text AS evtenabled
        FROM pg_event_trigger t
        JOIN pg_roles r ON r.oid = t.evtowner
        ORDER BY 1
      `);
      return { triggers: rows };
    },
    evaluate: (input) => {
      if (input.triggers.length === 0) {
        return evalResult("pass", {
          summary: "No event triggers installed",
          expected: "Known, reviewed event triggers only",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 event triggers",
        });
      }
      return evalResult("warning", {
        summary: `${input.triggers.length} event triggers present — review`,
        expected: "Known, reviewed event triggers only",
        actual: input.triggers.map((t) => t.evtname).join(", "),
        evidence: input,
        evidenceSummary: `${input.triggers.length} event triggers`,
      });
    },
    remediation: rem("Review and remove unexpected event triggers", [
      "DROP EVENT TRIGGER name",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Change Management",
        "evidence_contributes",
        "DDL interception controls",
        ISM,
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.replication_slots",
    version: "1.0.0",
    title: "Logical replication slots",
    description: "Inventories replication slots that may retain WAL or expose data.",
    rationale: "Forgotten slots cause disk pressure; unauthorized slots risk data exfil.",
    severity: "medium",
    categories: ["hardening", "resilience"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{
          slot_name: string;
          plugin: string | null;
          slot_type: string;
          active: boolean;
        }>(`
          SELECT slot_name, plugin, slot_type, active
          FROM pg_replication_slots
          ORDER BY 1
        `);
        return { slots: rows, readable: true };
      } catch {
        return { slots: [], readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read replication slots",
          expected: "Known, active slots only",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      const inactive = input.slots.filter((s) => !s.active);
      if (inactive.length > 0) {
        return evalResult("warning", {
          summary: `${inactive.length} inactive replication slots`,
          expected: "Known, active slots only",
          actual: inactive.map((s) => s.slot_name).join(", "),
          evidence: input,
          evidenceSummary: `${inactive.length} inactive`,
        });
      }
      return evalResult("pass", {
        summary: `${input.slots.length} replication slots (all active or none)`,
        expected: "Known, active slots only",
        actual: `${input.slots.length} slots`,
        evidence: input,
        evidenceSummary: `${input.slots.length} slots`,
      });
    },
    remediation: rem("Drop unused replication slots", [
      "SELECT pg_drop_replication_slot('name')",
    ]),
    mappings: [
      map(
        "nist-csf",
        "2.0",
        "PR.DS",
        "evidence_contributes",
        "Data protection / replication surface",
        "https://www.nist.gov/cyberframework",
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.publications",
    version: "1.0.0",
    title: "Publication exposure",
    description: "Lists logical replication publications and table counts.",
    rationale: "Over-broad publications can expose sensitive tables to subscribers.",
    severity: "medium",
    categories: ["hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const pubs = await ctx.query<{ pubname: string; puballtables: boolean }>(`
          SELECT pubname, puballtables FROM pg_publication ORDER BY 1
        `);
        return { publications: pubs, readable: true };
      } catch {
        return { publications: [], readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read publications",
          expected: "Least-privilege publication sets",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      const allTables = input.publications.filter((p) => p.puballtables);
      if (allTables.length > 0) {
        return evalResult("fail", {
          summary: `Publication(s) publish ALL tables: ${allTables.map((p) => p.pubname).join(", ")}`,
          expected: "Least-privilege publication sets",
          actual: allTables.map((p) => p.pubname).join(", "),
          evidence: input,
          evidenceSummary: "ALL TABLES publications",
        });
      }
      return evalResult("pass", {
        summary: `${input.publications.length} publications without FOR ALL TABLES`,
        expected: "Least-privilege publication sets",
        actual: `${input.publications.length} publications`,
        evidence: input,
        evidenceSummary: `${input.publications.length} pubs`,
      });
    },
    remediation: rem("Narrow publication table sets", [
      "DROP PUBLICATION ... / CREATE PUBLICATION ... FOR TABLE ...",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Data Handling",
        "evidence_contributes",
        "Control of data export paths",
        ISM,
      ),
    ],
  }),

  defineControl({
    id: "pg.hardening.unlogged_tables",
    version: "1.0.0",
    title: "UNLOGGED tables",
    description: "Finds UNLOGGED tables which skip WAL (durability/recovery risk).",
    rationale: "UNLOGGED tables lose data on crash and may hold sensitive data without recovery.",
    severity: "medium",
    categories: ["hardening", "resilience"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ schemaname: string; tablename: string }>(`
        SELECT n.nspname AS schemaname, c.relname AS tablename
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND c.relpersistence = 'u'
          AND n.nspname NOT LIKE 'pg_%'
        ORDER BY 1, 2
      `);
      return { tables: rows };
    },
    evaluate: (input) => {
      if (input.tables.length === 0) {
        return evalResult("pass", {
          summary: "No UNLOGGED user tables",
          expected: "UNLOGGED only for non-sensitive ephemeral data",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 unlogged",
        });
      }
      return evalResult("warning", {
        summary: `${input.tables.length} UNLOGGED tables`,
        expected: "UNLOGGED only for non-sensitive ephemeral data",
        actual: input.tables
          .map((t) => `${t.schemaname}.${t.tablename}`)
          .join(", "),
        evidence: input,
        evidenceSummary: `${input.tables.length} unlogged`,
      });
    },
    remediation: rem("Convert sensitive UNLOGGED tables to LOGGED", [
      "ALTER TABLE ... SET LOGGED",
    ]),
    mappings: [
      map(
        "soc2",
        "2017",
        "A1.2",
        "evidence_contributes",
        "Availability / recovery considerations",
        "https://www.aicpa.org/soc2",
      ),
    ],
  }),
];
