import { defineControl, evalResult, map, rem } from "../helpers.js";

const ISM = "https://www.cyber.gov.au/ism";
const OWASP = "https://owasp.org/Top10/A01_2021-Broken_Access_Control/";

export const rlsControls = [
  defineControl({
    id: "pg.rls.tables_without_rls",
    version: "1.0.0",
    title: "User tables without RLS enabled",
    description:
      "Finds base tables in non-system schemas that do not have row security enabled.",
    rationale:
      "Without RLS, PostgREST/Supabase API roles may read or write all rows.",
    severity: "critical",
    categories: ["rls", "access_control"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        schemaname: string;
        tablename: string;
        rowsecurity: boolean;
      }>(`
        SELECT n.nspname AS schemaname, c.relname AS tablename, c.relrowsecurity AS rowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'extensions', 'vault', 'pgsodium', 'pgsodium_masks', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'supabase_migrations', 'net', 'cron', 'dbdev')
          AND n.nspname NOT LIKE 'pg_%'
        ORDER BY 1, 2
      `);
      const exposed = rows.filter((r) => !r.rowsecurity);
      return { tables: rows, withoutRls: exposed };
    },
    evaluate: (input) => {
      if (input.withoutRls.length === 0) {
        return evalResult("pass", {
          summary: "All inspected user tables have RLS enabled",
          expected: "RLS enabled on multi-tenant/application tables",
          actual: "all enabled",
          evidence: { withoutRls: [], count: input.tables.length },
          evidenceSummary: `${input.tables.length} tables, 0 without RLS`,
        });
      }
      return evalResult("fail", {
        summary: `${input.withoutRls.length} tables without RLS`,
        expected: "RLS enabled on multi-tenant/application tables",
        actual: input.withoutRls
          .slice(0, 30)
          .map((t) => `${t.schemaname}.${t.tablename}`)
          .join(", "),
        evidence: { withoutRls: input.withoutRls.slice(0, 100) },
        evidenceSummary: `${input.withoutRls.length} without RLS`,
      });
    },
    remediation: rem(
      "Enable RLS and add policies",
      [
        "ALTER TABLE schema.table ENABLE ROW LEVEL SECURITY",
        "CREATE POLICY ... for SELECT/INSERT/UPDATE/DELETE",
        "FORCE ROW LEVEL SECURITY for table owners if needed",
      ],
      "ALTER TABLE schema.table ENABLE ROW LEVEL SECURITY;",
    ),
    mappings: [
      map(
        "ism",
        "2025",
        "Access Control",
        "directly_supports",
        "Technical enforcement of data access control",
        ISM,
        "high",
      ),
      map(
        "owasp-top10",
        "2021",
        "A01",
        "directly_supports",
        "Broken access control mitigation at data layer",
        OWASP,
        "high",
      ),
      map(
        "soc2",
        "2017",
        "CC6.1",
        "partially_supports",
        "Logical access security",
        "https://www.aicpa.org/soc2",
      ),
    ],
  }),

  defineControl({
    id: "pg.rls.enabled_without_policies",
    version: "1.0.0",
    title: "RLS enabled but no policies",
    description:
      "Tables with RLS on but zero policies deny all for non-owners — may be intentional lock-down or misconfiguration.",
    rationale:
      "Missing policies often surprise application roles; owners may still full-access without FORCE.",
    severity: "high",
    categories: ["rls"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        schemaname: string;
        tablename: string;
        polcount: string;
      }>(`
        SELECT n.nspname AS schemaname, c.relname AS tablename,
          (SELECT count(*)::text FROM pg_policy p WHERE p.polrelid = c.oid) AS polcount
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND c.relrowsecurity = true
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND n.nspname NOT LIKE 'pg_%'
        ORDER BY 1, 2
      `);
      const empty = rows.filter((r) => Number(r.polcount) === 0);
      return { empty };
    },
    evaluate: (input) => {
      if (input.empty.length === 0) {
        return evalResult("pass", {
          summary: "All RLS-enabled tables have at least one policy",
          expected: "≥1 policy per RLS table (or documented lock-down)",
          actual: "all have policies",
          evidence: input,
          evidenceSummary: "0 empty policy sets",
        });
      }
      return evalResult("warning", {
        summary: `${input.empty.length} RLS tables have zero policies`,
        expected: "≥1 policy per RLS table (or documented lock-down)",
        actual: input.empty
          .slice(0, 20)
          .map((t) => `${t.schemaname}.${t.tablename}`)
          .join(", "),
        evidence: input,
        evidenceSummary: `${input.empty.length} tables`,
      });
    },
    remediation: rem("Add policies or document intentional lock-down", [
      "CREATE POLICY for required commands",
      "Or FORCE RLS + no policies for hard deny",
    ]),
    mappings: [
      map(
        "owasp-asvs",
        "4.0.3",
        "V4.2",
        "partially_supports",
        "Operation-level access control",
        "https://owasp.org/www-project-application-security-verification-standard/",
      ),
    ],
  }),

  defineControl({
    id: "pg.rls.permissive_true_policies",
    version: "1.0.0",
    title: "Permissive policies with unconditional true",
    description:
      "Detects policies whose qual or with_check is effectively always true.",
    rationale: "USING (true) grants unrestricted row access for that command.",
    severity: "critical",
    categories: ["rls"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        schemaname: string;
        tablename: string;
        policyname: string;
        cmd: string;
        qual: string | null;
        with_check: string | null;
      }>(`
        SELECT n.nspname AS schemaname, c.relname AS tablename,
          p.polname AS policyname,
          CASE p.polcmd
            WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' ELSE p.polcmd::text
          END AS cmd,
          pg_get_expr(p.polqual, p.polrelid) AS qual,
          pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY 1, 2, 3
      `);
      const permissive = rows.filter((r) => {
        const q = (r.qual ?? "").replace(/\s+/g, " ").trim().toLowerCase();
        const w = (r.with_check ?? "").replace(/\s+/g, " ").trim().toLowerCase();
        return q === "true" || w === "true" || q === "(true)" || w === "(true)";
      });
      return { permissive, totalPolicies: rows.length };
    },
    evaluate: (input) => {
      if (input.permissive.length === 0) {
        return evalResult("pass", {
          summary: "No unconditional true policies detected",
          expected: "Policies constrain rows by tenant/user identity",
          actual: "none",
          evidence: { count: 0, totalPolicies: input.totalPolicies },
          evidenceSummary: "0 true policies",
        });
      }
      return evalResult("fail", {
        summary: `${input.permissive.length} policies use unconditional true`,
        expected: "Policies constrain rows by tenant/user identity",
        actual: input.permissive
          .slice(0, 20)
          .map((p) => `${p.schemaname}.${p.tablename}.${p.policyname}`)
          .join(", "),
        evidence: { permissive: input.permissive.slice(0, 50) },
        evidenceSummary: `${input.permissive.length} true policies`,
      });
    },
    remediation: rem("Replace USING (true) with tenant predicates", [
      "Use auth.uid() or organisation claim predicates",
      "Split policies per command as needed",
    ]),
    mappings: [
      map(
        "owasp-top10",
        "2021",
        "A01",
        "directly_supports",
        "Unconditional policies = broken access control",
        OWASP,
        "high",
      ),
      map(
        "ism",
        "2025",
        "Access Control",
        "directly_supports",
        "Effective access control enforcement",
        ISM,
        "high",
      ),
    ],
  }),

  defineControl({
    id: "pg.rls.policy_command_coverage",
    version: "1.0.0",
    title: "RLS policy command coverage",
    description:
      "Flags RLS tables missing SELECT or write policies when other policies exist.",
    rationale: "Partial command coverage leaves unexpected open or closed paths.",
    severity: "medium",
    categories: ["rls"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        schemaname: string;
        tablename: string;
        cmds: string;
      }>(`
        SELECT n.nspname AS schemaname, c.relname AS tablename,
          string_agg(DISTINCT p.polcmd::text, ',' ORDER BY p.polcmd::text) AS cmds
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_policy p ON p.polrelid = c.oid
        WHERE c.relrowsecurity = true
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY 1, 2
      `);
      return { tables: rows };
    },
    evaluate: (input) => {
      const partial = input.tables.filter((t) => {
        const cmds = new Set(t.cmds.split(","));
        if (cmds.has("*")) return false;
        // has some policies but no SELECT-like coverage
        return !cmds.has("r") && !cmds.has("*");
      });
      if (partial.length === 0) {
        return evalResult("pass", {
          summary: "No obvious SELECT policy gaps detected",
          expected: "Documented coverage for required commands",
          actual: "ok",
          evidence: { partial: [] },
          evidenceSummary: "0 partial coverage flags",
        });
      }
      return evalResult("warning", {
        summary: `${partial.length} tables may lack SELECT policies`,
        expected: "Documented coverage for required commands",
        actual: partial
          .slice(0, 20)
          .map((t) => `${t.schemaname}.${t.tablename} (${t.cmds})`)
          .join("; "),
        evidence: { partial: partial.slice(0, 50) },
        evidenceSummary: `${partial.length} tables`,
      });
    },
    remediation: rem("Add missing command policies", [
      "CREATE POLICY ... FOR SELECT USING (...)",
      "Review INSERT/UPDATE/DELETE separately",
    ]),
    mappings: [
      map(
        "owasp-asvs",
        "4.0.3",
        "V4.1",
        "partially_supports",
        "Access control completeness",
        "https://owasp.org/www-project-application-security-verification-standard/",
      ),
    ],
  }),

  defineControl({
    id: "pg.rls.security_definer_functions",
    version: "1.0.0",
    title: "SECURITY DEFINER functions without fixed search_path",
    description:
      "SECURITY DEFINER functions that do not set a fixed search_path can be exploited via object shadowing.",
    rationale: "Classic PostgreSQL privilege escalation pattern.",
    severity: "critical",
    categories: ["rls", "hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        nspname: string;
        proname: string;
        proconfig: string[] | null;
      }>(`
        SELECT n.nspname, p.proname, p.proconfig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef = true
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
        ORDER BY 1, 2
        LIMIT 300
      `);
      const risky = rows.filter((r) => {
        const cfg = r.proconfig ?? [];
        return !cfg.some((c) => c.startsWith("search_path="));
      });
      return { risky, total: rows.length };
    },
    evaluate: (input) => {
      if (input.risky.length === 0) {
        return evalResult("pass", {
          summary: "SECURITY DEFINER functions set search_path",
          expected: "SET search_path on all SECURITY DEFINER functions",
          actual: `${input.total} secdef, 0 missing search_path`,
          evidence: input,
          evidenceSummary: "0 risky secdef",
        });
      }
      return evalResult("fail", {
        summary: `${input.risky.length} SECURITY DEFINER functions lack search_path`,
        expected: "SET search_path on all SECURITY DEFINER functions",
        actual: input.risky
          .slice(0, 20)
          .map((f) => `${f.nspname}.${f.proname}`)
          .join(", "),
        evidence: { risky: input.risky.slice(0, 50), total: input.total },
        evidenceSummary: `${input.risky.length} risky`,
      });
    },
    remediation: rem(
      "Fix search_path on SECURITY DEFINER functions",
      [
        "ALTER FUNCTION ... SET search_path = pg_catalog, public",
        "Prefer SECURITY INVOKER when possible",
      ],
      "ALTER FUNCTION schema.fn() SET search_path = pg_catalog, public;",
    ),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "6.6",
        "directly_supports",
        "SECURITY DEFINER search_path",
        "https://www.cisecurity.org/benchmark/postgresql",
        "high",
      ),
      map(
        "owasp-top10",
        "2021",
        "A03",
        "evidence_contributes",
        "Injection via search_path hijack",
        "https://owasp.org/Top10/A03_2021-Injection/",
      ),
    ],
  }),

  defineControl({
    id: "pg.rls.force_rls",
    version: "1.0.0",
    title: "FORCE ROW LEVEL SECURITY usage",
    description:
      "Reports tables with RLS enabled but FORCE not set (owners bypass RLS).",
    rationale:
      "Table owners bypass RLS unless FORCE ROW LEVEL SECURITY is set.",
    severity: "medium",
    categories: ["rls"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        schemaname: string;
        tablename: string;
        force_rls: boolean;
      }>(`
        SELECT n.nspname AS schemaname, c.relname AS tablename,
          c.relforcerowsecurity AS force_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND c.relrowsecurity = true
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'storage', 'auth')
          AND n.nspname NOT LIKE 'pg_%'
      `);
      const withoutForce = rows.filter((r) => !r.force_rls);
      return { withoutForce, total: rows.length };
    },
    evaluate: (input) => {
      if (input.withoutForce.length === 0) {
        return evalResult("pass", {
          summary: "FORCE RLS set on all RLS tables inspected",
          expected: "FORCE RLS for sensitive multi-tenant tables",
          actual: "all forced",
          evidence: input,
          evidenceSummary: "all forced",
        });
      }
      return evalResult("warning", {
        summary: `${input.withoutForce.length}/${input.total} RLS tables without FORCE`,
        expected: "FORCE RLS for sensitive multi-tenant tables",
        actual: input.withoutForce
          .slice(0, 15)
          .map((t) => `${t.schemaname}.${t.tablename}`)
          .join(", "),
        evidence: { withoutForce: input.withoutForce.slice(0, 50) },
        evidenceSummary: `${input.withoutForce.length} without FORCE`,
      });
    },
    remediation: rem(
      "Enable FORCE RLS where owners must not bypass",
      ["ALTER TABLE ... FORCE ROW LEVEL SECURITY"],
      "ALTER TABLE schema.table FORCE ROW LEVEL SECURITY;",
    ),
    mappings: [
      map(
        "ism",
        "2025",
        "Access Control",
        "partially_supports",
        "Consistent enforcement including privileged owners",
        ISM,
      ),
    ],
  }),

  defineControl({
    id: "pg.rls.views_security_invoker",
    version: "1.0.0",
    title: "Views that may bypass RLS (security_barrier / invoker)",
    description:
      "Lists views in app schemas; flags older views without security_invoker where PG15+ available.",
    rationale:
      "Views owned by privileged roles can expose underlying table data depending on configuration.",
    severity: "medium",
    categories: ["rls"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        schemaname: string;
        viewname: string;
        viewowner: string;
      }>(`
        SELECT schemaname, viewname, viewowner
        FROM pg_views
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'extensions')
        ORDER BY 1, 2
        LIMIT 200
      `);
      return { views: rows, pgMajor: ctx.postgresMajor };
    },
    evaluate: (input) => {
      if (input.views.length === 0) {
        return evalResult("pass", {
          summary: "No application views found",
          expected: "Views use security_invoker / careful ownership",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 views",
        });
      }
      return evalResult("manual_review", {
        summary: `${input.views.length} views require access-path review`,
        expected: "Views use security_invoker / careful ownership",
        actual: `${input.views.length} views (PG ${input.pgMajor})`,
        evidence: { sample: input.views.slice(0, 30), pgMajor: input.pgMajor },
        evidenceSummary: `${input.views.length} views need review`,
      });
    },
    remediation: rem("Review view ownership and security_invoker", [
      "On PG15+: CREATE VIEW ... WITH (security_invoker=true)",
      "Avoid SECURITY DEFINER-like exposure via privileged view owners",
    ]),
    mappings: [
      map(
        "owasp-top10",
        "2021",
        "A01",
        "evidence_contributes",
        "View-based access control bypass risk",
        OWASP,
      ),
    ],
  }),

  defineControl({
    id: "pg.rls.auth_uid_policies",
    version: "1.0.0",
    title: "Policies referencing auth.uid() vs raw user metadata",
    description:
      "Counts policies using auth.uid() vs jwt user_metadata (mutable) patterns.",
    rationale:
      "Authorisation on mutable user_metadata is unsafe compared to stable subject claims.",
    severity: "high",
    categories: ["rls", "supabase"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        policyname: string;
        qual: string | null;
        with_check: string | null;
      }>(`
        SELECT p.polname AS policyname,
          pg_get_expr(p.polqual, p.polrelid) AS qual,
          pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
        FROM pg_policy p
      `);
      let uid = 0;
      let metadata = 0;
      for (const r of rows) {
        const text = `${r.qual ?? ""} ${r.with_check ?? ""}`.toLowerCase();
        if (text.includes("auth.uid()")) uid += 1;
        if (
          text.includes("user_metadata") ||
          text.includes("raw_user_meta_data")
        ) {
          metadata += 1;
        }
      }
      return { total: rows.length, uid, metadata };
    },
    evaluate: (input) => {
      if (input.metadata > 0) {
        return evalResult("fail", {
          summary: `${input.metadata} policies reference user_metadata`,
          expected: "Authorise on auth.uid() / stable JWT claims",
          actual: `${input.metadata} metadata refs, ${input.uid} auth.uid()`,
          evidence: input,
          evidenceSummary: `metadata=${input.metadata}`,
        });
      }
      return evalResult("pass", {
        summary: "No policies reference mutable user_metadata",
        expected: "Authorise on auth.uid() / stable JWT claims",
        actual: `${input.uid} auth.uid() policies of ${input.total}`,
        evidence: input,
        evidenceSummary: `uid=${input.uid}, metadata=0`,
      });
    },
    remediation: rem("Replace user_metadata checks with stable claims", [
      "Use auth.uid() or app_metadata set only by trusted server",
      "Store tenant membership in tables protected by RLS",
    ]),
    mappings: [
      map(
        "owasp-asvs",
        "4.0.3",
        "V4.2",
        "directly_supports",
        "Stable identity for authorisation decisions",
        "https://owasp.org/www-project-application-security-verification-standard/",
        "high",
      ),
    ],
  }),
];
