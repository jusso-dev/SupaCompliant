import { defineControl, evalResult, map, rem } from "../helpers.js";

export const supabaseControls = [
  defineControl({
    id: "sb.auth.schema_present",
    version: "1.0.0",
    title: "Auth schema present",
    description: "Confirms Supabase auth schema exists on target.",
    rationale: "Auth configuration checks depend on auth schema.",
    severity: "informational",
    categories: ["supabase", "identity"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ exists: boolean }>(`
        SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'auth') AS exists
      `);
      return { exists: Boolean(rows[0]?.exists) };
    },
    evaluate: (input) =>
      input.exists
        ? evalResult("pass", {
            summary: "auth schema present",
            expected: "auth schema for Supabase projects",
            actual: "present",
            evidence: input,
            evidenceSummary: "auth present",
          })
        : evalResult("fail", {
            summary: "auth schema missing on Supabase target",
            expected: "auth schema for Supabase projects",
            actual: "missing",
            evidence: input,
            evidenceSummary: "auth missing",
          }),
    remediation: rem("Use a genuine Supabase project database", [
      "Confirm connection targets the project database",
    ]),
    mappings: [
      map(
        "nist-csf",
        "2.0",
        "PR.AA",
        "evidence_contributes",
        "Identity subsystem presence",
        "https://www.nist.gov/cyberframework",
        "low",
      ),
    ],
  }),

  defineControl({
    id: "sb.auth.users_table_rls",
    version: "1.0.0",
    title: "auth.users privileges exposure",
    description:
      "Checks whether anon/authenticated can SELECT auth.users (should not).",
    rationale: "auth.users contains sensitive identity attributes.",
    severity: "critical",
    categories: ["supabase", "identity"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{
          grantee: string;
          privilege_type: string;
        }>(`
          SELECT grantee, privilege_type
          FROM information_schema.role_table_grants
          WHERE table_schema = 'auth' AND table_name = 'users'
            AND grantee IN ('anon', 'authenticated', 'PUBLIC')
        `);
        return { grants: rows, readable: true };
      } catch {
        return { grants: [], readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read grants on auth.users",
          expected: "No SELECT for anon/authenticated on auth.users",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      const selectGrants = input.grants.filter(
        (g) => g.privilege_type === "SELECT",
      );
      if (selectGrants.length > 0) {
        return evalResult("fail", {
          summary: "anon/authenticated/PUBLIC have grants on auth.users",
          expected: "No SELECT for anon/authenticated on auth.users",
          actual: selectGrants
            .map((g) => `${g.grantee}:${g.privilege_type}`)
            .join(", "),
          evidence: input,
          evidenceSummary: "excessive grants",
        });
      }
      return evalResult("pass", {
        summary: "No anon/authenticated SELECT grants on auth.users",
        expected: "No SELECT for anon/authenticated on auth.users",
        actual: "none",
        evidence: input,
        evidenceSummary: "ok",
      });
    },
    remediation: rem("Revoke client grants on auth.users", [
      "REVOKE ALL ON auth.users FROM anon, authenticated, PUBLIC",
    ]),
    mappings: [
      map(
        "owasp-top10",
        "2021",
        "A01",
        "directly_supports",
        "Identity store access control",
        "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
        "high",
      ),
      map(
        "ism",
        "2025",
        "Authentication",
        "partially_supports",
        "Protection of credential store",
        "https://www.cyber.gov.au/ism",
      ),
    ],
  }),

  defineControl({
    id: "sb.public_schema.api_exposure",
    version: "1.0.0",
    title: "PUBLIC schema tables exposed to API roles",
    description:
      "Lists public schema tables with grants to anon or authenticated.",
    rationale: "Everything granted to API roles is part of the attack surface.",
    severity: "high",
    categories: ["supabase", "rls"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        table_name: string;
        grantee: string;
        privilege_type: string;
        rowsecurity: boolean;
      }>(`
        SELECT g.table_name, g.grantee, g.privilege_type, c.relrowsecurity AS rowsecurity
        FROM information_schema.role_table_grants g
        JOIN pg_class c ON c.relname = g.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = g.table_schema
        WHERE g.table_schema = 'public'
          AND g.grantee IN ('anon', 'authenticated')
          AND c.relkind = 'r'
        ORDER BY 1, 2, 3
      `);
      return { grants: rows };
    },
    evaluate: (input) => {
      const withoutRls = input.grants.filter((g) => !g.rowsecurity);
      if (withoutRls.length > 0) {
        return evalResult("fail", {
          summary: "API-exposed public tables without RLS",
          expected: "RLS on all API-exposed tables",
          actual: [
            ...new Set(withoutRls.map((g) => g.table_name)),
          ].join(", "),
          evidence: { withoutRls: withoutRls.slice(0, 50), total: input.grants.length },
          evidenceSummary: `${withoutRls.length} grants without RLS`,
        });
      }
      return evalResult("pass", {
        summary: `API grants present on ${new Set(input.grants.map((g) => g.table_name)).size} tables with RLS`,
        expected: "RLS on all API-exposed tables",
        actual: `${input.grants.length} grants`,
        evidence: { sample: input.grants.slice(0, 30) },
        evidenceSummary: `${input.grants.length} grants, RLS ok`,
      });
    },
    remediation: rem("Enable RLS or revoke API grants", [
      "ALTER TABLE ... ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON table FROM anon, authenticated",
    ]),
    mappings: [
      map(
        "owasp-api",
        "2023",
        "API1",
        "directly_supports",
        "Object exposure via API roles",
        "https://owasp.org/API-Security/",
        "high",
      ),
    ],
  }),

  defineControl({
    id: "sb.realtime.publication",
    version: "1.0.0",
    title: "Realtime publication tables",
    description: "Lists tables in supabase_realtime publication if present.",
    rationale: "Realtime can stream row changes to clients — scope carefully.",
    severity: "medium",
    categories: ["supabase"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{
          schemaname: string;
          tablename: string;
        }>(`
          SELECT schemaname, tablename
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
          ORDER BY 1, 2
        `);
        return { tables: rows, readable: true };
      } catch {
        return { tables: [], readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read realtime publication",
          expected: "Minimal realtime table set",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      if (input.tables.length === 0) {
        return evalResult("pass", {
          summary: "No tables in supabase_realtime publication",
          expected: "Minimal realtime table set",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 tables",
        });
      }
      return evalResult("warning", {
        summary: `${input.tables.length} tables in supabase_realtime`,
        expected: "Minimal realtime table set",
        actual: input.tables
          .map((t) => `${t.schemaname}.${t.tablename}`)
          .join(", "),
        evidence: input,
        evidenceSummary: `${input.tables.length} tables`,
      });
    },
    remediation: rem("Remove sensitive tables from realtime publication", [
      "ALTER PUBLICATION supabase_realtime DROP TABLE ...",
    ]),
    mappings: [
      map(
        "owasp-api",
        "2023",
        "API3",
        "evidence_contributes",
        "Broken object property level authorisation via streams",
        "https://owasp.org/API-Security/",
      ),
    ],
  }),

  defineControl({
    id: "sb.graphql.schema",
    version: "1.0.0",
    title: "GraphQL schema exposure",
    description: "Detects graphql / graphql_public schemas.",
    rationale: "GraphQL increases query surface; ensure authz matches REST.",
    severity: "low",
    categories: ["supabase"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ nspname: string }>(`
        SELECT nspname FROM pg_namespace
        WHERE nspname IN ('graphql', 'graphql_public')
        ORDER BY 1
      `);
      return { schemas: rows.map((r) => r.nspname) };
    },
    evaluate: (input) => {
      if (input.schemas.length === 0) {
        return evalResult("pass", {
          summary: "GraphQL schemas not present",
          expected: "GraphQL disabled or tightly controlled",
          actual: "absent",
          evidence: input,
          evidenceSummary: "no graphql schemas",
        });
      }
      return evalResult("manual_review", {
        summary: `GraphQL schemas present: ${input.schemas.join(", ")}`,
        expected: "GraphQL disabled or tightly controlled",
        actual: input.schemas.join(", "),
        evidence: input,
        evidenceSummary: input.schemas.join(", "),
      });
    },
    remediation: rem("Disable GraphQL if unused", [
      "Remove grants on graphql_public",
      "Review exposed views/functions",
    ]),
    mappings: [
      map(
        "owasp-api",
        "2023",
        "API6",
        "evidence_contributes",
        "Unrestricted business flows / query complexity",
        "https://owasp.org/API-Security/",
        "low",
      ),
    ],
  }),

  defineControl({
    id: "sb.postgrest.functions_exposed",
    version: "1.0.0",
    title: "Functions granted to anon/authenticated",
    description: "Lists callable functions granted to API roles.",
    rationale: "SECURITY DEFINER RPCs are a common privilege escalation path.",
    severity: "high",
    categories: ["supabase", "identity"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        routine_schema: string;
        routine_name: string;
        grantee: string;
      }>(`
        SELECT routine_schema, routine_name, grantee
        FROM information_schema.routine_privileges
        WHERE grantee IN ('anon', 'authenticated', 'PUBLIC')
          AND routine_schema NOT IN ('pg_catalog', 'information_schema', 'extensions')
        ORDER BY 1, 2, 3
        LIMIT 300
      `);
      return { functions: rows };
    },
    evaluate: (input) => {
      if (input.functions.length === 0) {
        return evalResult("pass", {
          summary: "No non-system functions granted to API roles",
          expected: "Least privilege EXECUTE on RPCs",
          actual: "none",
          evidence: input,
          evidenceSummary: "0",
        });
      }
      return evalResult("warning", {
        summary: `${input.functions.length} function grants to API roles`,
        expected: "Least privilege EXECUTE on RPCs",
        actual: input.functions
          .slice(0, 25)
          .map((f) => `${f.routine_schema}.${f.routine_name}:${f.grantee}`)
          .join(", "),
        evidence: { sample: input.functions.slice(0, 100) },
        evidenceSummary: `${input.functions.length} grants`,
      });
    },
    remediation: rem("Revoke unnecessary function EXECUTE", [
      "REVOKE EXECUTE ON FUNCTION ... FROM anon, authenticated, PUBLIC",
    ]),
    mappings: [
      map(
        "owasp-asvs",
        "4.0.3",
        "V5.1",
        "partially_supports",
        "Input validation / dangerous function exposure",
        "https://owasp.org/www-project-application-security-verification-standard/",
      ),
    ],
  }),

  defineControl({
    id: "sb.anon_authenticated_roles",
    version: "1.0.0",
    title: "Supabase API roles exist",
    description: "Confirms anon, authenticated, service_role roles exist.",
    rationale: "Baseline for Supabase privilege model assessments.",
    severity: "informational",
    categories: ["supabase", "identity"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ rolname: string; rolbypassrls: boolean }>(`
        SELECT rolname, rolbypassrls FROM pg_roles
        WHERE rolname IN ('anon', 'authenticated', 'service_role')
        ORDER BY 1
      `);
      return { roles: rows };
    },
    evaluate: (input) => {
      const names = new Set(input.roles.map((r) => r.rolname));
      const missing = ["anon", "authenticated", "service_role"].filter(
        (n) => !names.has(n),
      );
      if (missing.length) {
        return evalResult("warning", {
          summary: `Missing expected roles: ${missing.join(", ")}`,
          expected: "anon, authenticated, service_role present",
          actual: [...names].join(", "),
          evidence: input,
          evidenceSummary: `missing ${missing.join(",")}`,
        });
      }
      const service = input.roles.find((r) => r.rolname === "service_role");
      if (service && !service.rolbypassrls) {
        return evalResult("warning", {
          summary: "service_role without BYPASSRLS (unexpected)",
          expected: "service_role bypasses RLS; never expose to browser",
          actual: "no bypassrls flag",
          evidence: input,
          evidenceSummary: "service_role flag unexpected",
        });
      }
      return evalResult("pass", {
        summary: "Supabase API roles present",
        expected: "anon, authenticated, service_role present",
        actual: "all present",
        evidence: input,
        evidenceSummary: "roles ok",
        recommendations: [
          "Never ship service_role key to browsers or mobile apps",
        ],
      });
    },
    remediation: rem("Protect service_role key", [
      "Rotate if ever exposed",
      "Use only on trusted servers",
    ]),
    mappings: [
      map(
        "owasp-top10",
        "2021",
        "A07",
        "evidence_contributes",
        "Identification and authentication failures / secret handling",
        "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/",
      ),
    ],
  }),

  defineControl({
    id: "sb.service_role_key_rotation",
    version: "1.0.0",
    title: "Service-role key rotation evidence",
    description: "Manual attestation of service_role key handling and rotation.",
    rationale: "Keys cannot be proven rotated via SQL.",
    severity: "high",
    categories: ["supabase", "identity"],
    targets: ["supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ requiresEvidence: true }),
    evaluate: () =>
      evalResult("manual_review", {
        summary: "Provide service_role storage location and last rotation date",
        expected: "Server-only storage + rotation procedure",
        actual: "not verified automatically",
        evidence: { requiresEvidence: true },
        evidenceSummary: "manual key hygiene evidence",
      }),
    remediation: rem("Document and rotate service_role keys", [
      "Store in secret manager",
      "Rotate on staff change and periodic schedule",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "System Administration",
        "manual_validation_required",
        "Privileged credential management",
        "https://www.cyber.gov.au/ism",
        "high",
      ),
      map(
        "essential-eight",
        "2023",
        "Restrict administrative privileges",
        "manual_validation_required",
        "Admin secret handling evidence",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
      ),
    ],
  }),

  defineControl({
    id: "sb.mfa_policy_evidence",
    version: "1.0.0",
    title: "MFA policy evidence",
    description:
      "MFA enforcement for privileged users requires Management API or manual evidence.",
    rationale: "Essential Eight MFA cannot be inferred from SQL alone.",
    severity: "high",
    categories: ["supabase", "identity"],
    targets: ["supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async (ctx) => {
      if (ctx.managementGet && ctx.capabilities.has("supabase_management")) {
        try {
          // Best-effort; path may vary — failure becomes unknown not pass
          await ctx.managementGet("/projects");
          return { managementReachable: true };
        } catch (e) {
          return {
            managementReachable: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }
      return { managementReachable: false };
    },
    evaluate: (input) =>
      evalResult("manual_review", {
        summary: "Confirm MFA required for admin and privileged app users",
        expected: "MFA enforced for privileged access paths",
        actual: input.managementReachable
          ? "Management API reachable — still requires human MFA policy confirmation"
          : "Management API not used; manual evidence required",
        evidence: input,
        evidenceSummary: "MFA not auto-certified",
      }),
    remediation: rem("Enforce MFA for privileged users", [
      "Enable MFA in Supabase Auth for users",
      "Require AAL2 for admin application routes",
      "Evidence IdP MFA for operators",
    ]),
    mappings: [
      map(
        "essential-eight",
        "2023",
        "Multi-factor authentication",
        "manual_validation_required",
        "MFA maturity cannot be claimed from database evidence alone",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "high",
      ),
      map(
        "ism",
        "2025",
        "Multi-factor Authentication",
        "manual_validation_required",
        "Privileged MFA evidence",
        "https://www.cyber.gov.au/ism",
        "high",
      ),
    ],
  }),

  defineControl({
    id: "sb.vector_tenant_rls",
    version: "1.0.0",
    title: "Vector / embedding tables tenant RLS",
    description:
      "Finds tables with vector-like columns and checks RLS enabled.",
    rationale: "Embedding tables often store multi-tenant content and are forgotten.",
    severity: "high",
    categories: ["supabase", "rls", "data_protection"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        data_type: string;
        udt_name: string;
        rowsecurity: boolean;
      }>(`
        SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.udt_name,
          cls.relrowsecurity AS rowsecurity
        FROM information_schema.columns c
        JOIN pg_class cls ON cls.relname = c.table_name
        JOIN pg_namespace n ON n.oid = cls.relnamespace AND n.nspname = c.table_schema
        WHERE c.udt_name IN ('vector', 'halfvec', 'sparsevec')
           OR c.column_name ILIKE '%embedding%'
        ORDER BY 1, 2
        LIMIT 200
      `);
      return { columns: rows };
    },
    evaluate: (input) => {
      if (input.columns.length === 0) {
        return evalResult("not_applicable", {
          summary: "No vector/embedding columns detected",
          expected: "RLS on multi-tenant vector tables",
          actual: "none",
          evidence: input,
          evidenceSummary: "N/A",
        });
      }
      const tables = new Map<string, boolean>();
      for (const col of input.columns) {
        const key = `${col.table_schema}.${col.table_name}`;
        tables.set(key, col.rowsecurity);
      }
      const missing = [...tables.entries()].filter(([, rls]) => !rls);
      if (missing.length) {
        return evalResult("fail", {
          summary: `${missing.length} vector-related tables without RLS`,
          expected: "RLS on multi-tenant vector tables",
          actual: missing.map(([t]) => t).join(", "),
          evidence: input,
          evidenceSummary: missing.map(([t]) => t).join(", "),
        });
      }
      return evalResult("pass", {
        summary: "Vector-related tables have RLS enabled",
        expected: "RLS on multi-tenant vector tables",
        actual: `${tables.size} tables`,
        evidence: input,
        evidenceSummary: `${tables.size} tables with RLS`,
      });
    },
    remediation: rem("Enable tenant-aware RLS on vector tables", [
      "ALTER TABLE ... ENABLE ROW LEVEL SECURITY",
      "Policy on organisation_id / user_id",
    ]),
    mappings: [
      map(
        "owasp-top10",
        "2021",
        "A01",
        "directly_supports",
        "Multi-tenant vector data access control",
        "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
        "high",
      ),
    ],
  }),
];
