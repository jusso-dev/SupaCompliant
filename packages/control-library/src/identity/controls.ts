import { defineControl, evalResult, map, rem } from "../helpers.js";

const ISM = "https://www.cyber.gov.au/ism";
const CIS_PG = "https://www.cisecurity.org/benchmark/postgresql";
const NIST53 = "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final";

export const identityControls = [
  defineControl({
    id: "pg.identity.superuser_inventory",
    version: "1.0.0",
    title: "Superuser role inventory",
    description:
      "Lists roles with superuser privilege. Superusers bypass all access controls including RLS.",
    rationale:
      "Excessive superuser accounts expand blast radius and undermine least privilege.",
    severity: "high",
    categories: ["identity", "privileged_access"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        rolname: string;
        rolcanlogin: boolean;
        rolbypassrls: boolean;
      }>(`
        SELECT rolname, rolcanlogin, rolbypassrls
        FROM pg_roles
        WHERE rolsuper = true
        ORDER BY rolname
      `);
      return { superusers: rows };
    },
    evaluate: (input) => {
      const loginSupers = input.superusers.filter((r) => r.rolcanlogin);
      const expected =
        "Minimal superuser roles; prefer non-login ownership roles where possible";
      if (loginSupers.length > 3) {
        return evalResult("fail", {
          summary: `${loginSupers.length} login-enabled superuser roles found`,
          expected,
          actual: loginSupers.map((r) => r.rolname).join(", "),
          evidence: input,
          evidenceSummary: `Login superusers: ${loginSupers.length}`,
        });
      }
      if (loginSupers.length > 1) {
        return evalResult("warning", {
          summary: `${loginSupers.length} login-enabled superuser roles — review necessity`,
          expected,
          actual: loginSupers.map((r) => r.rolname).join(", "),
          evidence: input,
          evidenceSummary: `Login superusers: ${loginSupers.length}`,
        });
      }
      return evalResult("pass", {
        summary: "Superuser inventory within expected bounds",
        expected,
        actual: `${input.superusers.length} superuser role(s), ${loginSupers.length} login-enabled`,
        evidence: input,
        evidenceSummary: `Superusers: ${input.superusers.map((r) => r.rolname).join(", ")}`,
      });
    },
    remediation: rem(
      "Reduce login-enabled superuser roles to operational minimum",
      [
        "Inventory who needs superuser and why",
        "Convert routine operations to least-privilege roles",
        "Disable login on ownership-only superuser roles where supported",
      ],
    ),
    mappings: [
      map(
        "ism",
        "2025",
        "Privileged Access",
        "partially_supports",
        "Superuser inventory supports privileged access management evidence",
        ISM,
        "high",
      ),
      map(
        "essential-eight",
        "2023",
        "Restrict administrative privileges",
        "evidence_contributes",
        "Database superuser roles are a form of privileged access",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "medium",
      ),
      map(
        "cis-postgresql",
        "1.2.0",
        "1.1 Ensure superuser reduced",
        "partially_supports",
        "Aligns with CIS guidance on limiting superuser",
        CIS_PG,
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.bypassrls_roles",
    version: "1.0.0",
    title: "BYPASSRLS role inventory",
    description:
      "Identifies roles that bypass Row Level Security regardless of policies.",
    rationale:
      "BYPASSRLS is equivalent to unrestricted row access for policy-protected tables.",
    severity: "critical",
    categories: ["identity", "rls"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        rolname: string;
        rolcanlogin: boolean;
        rolsuper: boolean;
      }>(`
        SELECT rolname, rolcanlogin, rolsuper
        FROM pg_roles
        WHERE rolbypassrls = true
        ORDER BY rolname
      `);
      return { bypassRoles: rows };
    },
    evaluate: (input) => {
      const unexpected = input.bypassRoles.filter(
        (r) =>
          !["postgres", "supabase_admin", "dashboard_user"].includes(r.rolname),
      );
      if (unexpected.some((r) => r.rolcanlogin && !r.rolsuper)) {
        return evalResult("fail", {
          summary: "Login-enabled non-superuser BYPASSRLS roles present",
          expected: "BYPASSRLS limited to tightly controlled admin roles",
          actual: unexpected.map((r) => r.rolname).join(", "),
          evidence: input,
          evidenceSummary: `${unexpected.length} non-standard BYPASSRLS roles`,
        });
      }
      return evalResult("pass", {
        summary: "BYPASSRLS roles within expected administrative set",
        expected: "BYPASSRLS limited to tightly controlled admin roles",
        actual: input.bypassRoles.map((r) => r.rolname).join(", ") || "none",
        evidence: input,
        evidenceSummary: `BYPASSRLS count: ${input.bypassRoles.length}`,
      });
    },
    remediation: rem("Remove unnecessary BYPASSRLS privileges", [
      "ALTER ROLE ... NOBYPASSRLS for non-admin roles",
      "Prefer SET ROLE elevation under audited break-glass procedures",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Access Control",
        "directly_supports",
        "BYPASSRLS defeats row-level access control",
        ISM,
        "high",
      ),
      map(
        "owasp-asvs",
        "4.0.3",
        "V4.1",
        "partially_supports",
        "Access control verification for data layer",
        "https://owasp.org/www-project-application-security-verification-standard/",
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.login_roles",
    version: "1.0.0",
    title: "Login-enabled role inventory",
    description: "Enumerates roles that can authenticate (rolcanlogin).",
    rationale: "Unexpected login roles expand the authentication attack surface.",
    severity: "medium",
    categories: ["identity"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        rolname: string;
        rolsuper: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
      }>(`
        SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
        FROM pg_roles
        WHERE rolcanlogin = true
          AND rolname NOT LIKE 'pg_%'
        ORDER BY rolname
      `);
      return { loginRoles: rows };
    },
    evaluate: (input) => {
      const privileged = input.loginRoles.filter(
        (r) => r.rolsuper || r.rolcreaterole || r.rolcreatedb,
      );
      return evalResult("pass", {
        summary: `${input.loginRoles.length} login roles (${privileged.length} privileged flags)`,
        expected: "Login roles known and justified",
        actual: `${input.loginRoles.length} login roles`,
        evidence: input,
        evidenceSummary: `Login roles: ${input.loginRoles.length}; privileged flags: ${privileged.length}`,
        recommendations: [
          "Review list with identity owners",
          "Disable unused login roles",
        ],
      });
    },
    remediation: rem("Disable unused login roles", [
      "ALTER ROLE name NOLOGIN for service-only roles",
      "Rotate credentials for remaining login roles",
    ]),
    mappings: [
      map(
        "cis-controls",
        "8.0",
        "5.1",
        "evidence_contributes",
        "Account inventory for database identities",
        "https://www.cisecurity.org/controls/v8",
      ),
      map(
        "nist-800-53",
        "Rev. 5",
        "AC-2",
        "partially_supports",
        "Account management evidence",
        NIST53,
        "medium",
        "NIST SP 800-53 Rev. 5",
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.password_encryption",
    version: "1.0.0",
    title: "Password encryption algorithm",
    description: "Checks password_encryption setting prefers scram-sha-256.",
    rationale: "MD5 password storage is weak against offline attacks.",
    severity: "high",
    categories: ["identity", "cryptography"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ setting: string }>(`
        SELECT setting FROM pg_settings WHERE name = 'password_encryption'
      `);
      return { passwordEncryption: rows[0]?.setting ?? "unknown" };
    },
    evaluate: (input) => {
      if (input.passwordEncryption === "scram-sha-256") {
        return evalResult("pass", {
          summary: "password_encryption is scram-sha-256",
          expected: "scram-sha-256",
          actual: input.passwordEncryption,
          evidence: input,
          evidenceSummary: "scram-sha-256",
        });
      }
      if (input.passwordEncryption === "unknown") {
        return evalResult("unknown", {
          summary: "Could not read password_encryption",
          expected: "scram-sha-256",
          actual: "unknown",
          evidence: input,
          evidenceSummary: "Setting not readable",
        });
      }
      return evalResult("fail", {
        summary: `Weak password_encryption: ${input.passwordEncryption}`,
        expected: "scram-sha-256",
        actual: input.passwordEncryption,
        evidence: input,
        evidenceSummary: input.passwordEncryption,
      });
    },
    remediation: rem("Set password_encryption to scram-sha-256", [
      "ALTER SYSTEM SET password_encryption = 'scram-sha-256'",
      "Re-hash existing role passwords on next rotation",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "6.2",
        "directly_supports",
        "CIS recommends SCRAM",
        CIS_PG,
        "high",
      ),
      map(
        "ism",
        "2025",
        "Authentication",
        "partially_supports",
        "Strong credential protection",
        ISM,
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.public_schema_create",
    version: "1.0.0",
    title: "PUBLIC create privilege on schemas",
    description:
      "Detects schemas where PUBLIC retains CREATE privilege (object injection risk).",
    rationale:
      "CREATE on public allows unprivileged users to place objects that may hijack name resolution.",
    severity: "high",
    categories: ["identity", "hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        nspname: string;
        has_create: boolean;
      }>(`
        SELECT n.nspname,
          has_schema_privilege('public', n.nspname, 'CREATE') AS has_create
        FROM pg_namespace n
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND n.nspname NOT LIKE 'pg_temp%'
          AND n.nspname NOT LIKE 'pg_toast_temp%'
        ORDER BY 1
      `);
      return { schemas: rows.filter((r) => r.has_create) };
    },
    evaluate: (input) => {
      if (input.schemas.length === 0) {
        return evalResult("pass", {
          summary: "No schemas grant CREATE to PUBLIC",
          expected: "REVOKE CREATE ON SCHEMA ... FROM PUBLIC",
          actual: "none",
          evidence: input,
          evidenceSummary: "No PUBLIC CREATE",
        });
      }
      return evalResult("fail", {
        summary: `PUBLIC CREATE on: ${input.schemas.map((s) => s.nspname).join(", ")}`,
        expected: "No PUBLIC CREATE on application schemas",
        actual: input.schemas.map((s) => s.nspname).join(", "),
        evidence: input,
        evidenceSummary: `${input.schemas.length} schemas`,
      });
    },
    remediation: rem(
      "Revoke CREATE from PUBLIC",
      ["REVOKE CREATE ON SCHEMA public FROM PUBLIC"],
      "REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
    ),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "5.1",
        "directly_supports",
        "Public schema privileges",
        CIS_PG,
        "high",
      ),
      map(
        "owasp-top10",
        "2021",
        "A01",
        "evidence_contributes",
        "Broken access control at database layer",
        "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.public_connect",
    version: "1.0.0",
    title: "PUBLIC CONNECT on current database",
    description: "Checks whether PUBLIC can CONNECT to the current database.",
    rationale: "Broad CONNECT grants increase exposure of listening databases.",
    severity: "medium",
    categories: ["identity"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ has_connect: boolean }>(`
        SELECT has_database_privilege('public', current_database(), 'CONNECT') AS has_connect
      `);
      return { hasConnect: Boolean(rows[0]?.has_connect) };
    },
    evaluate: (input) => {
      if (!input.hasConnect) {
        return evalResult("pass", {
          summary: "PUBLIC cannot CONNECT to current database",
          expected: "CONNECT limited to known roles",
          actual: "no PUBLIC CONNECT",
          evidence: input,
          evidenceSummary: "PUBLIC CONNECT revoked",
        });
      }
      return evalResult("warning", {
        summary: "PUBLIC has CONNECT on current database",
        expected: "CONNECT limited to known roles",
        actual: "PUBLIC CONNECT granted",
        evidence: input,
        evidenceSummary: "PUBLIC CONNECT present (may be intentional on Supabase)",
      });
    },
    remediation: rem("Revoke unnecessary CONNECT", [
      "REVOKE CONNECT ON DATABASE dbname FROM PUBLIC",
      "Grant CONNECT only to application roles",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "5.2",
        "partially_supports",
        "Database connect privileges",
        CIS_PG,
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.createrole_roles",
    version: "1.0.0",
    title: "CREATEROLE privilege inventory",
    description: "Lists non-superuser roles with CREATEROLE.",
    rationale: "CREATEROLE can escalate privileges via role membership grants.",
    severity: "high",
    categories: ["identity", "privileged_access"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ rolname: string; rolcanlogin: boolean }>(`
        SELECT rolname, rolcanlogin FROM pg_roles
        WHERE rolcreaterole = true AND rolsuper = false
        ORDER BY 1
      `);
      return { roles: rows };
    },
    evaluate: (input) => {
      if (input.roles.length === 0) {
        return evalResult("pass", {
          summary: "No non-superuser CREATEROLE roles",
          expected: "CREATEROLE tightly controlled",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 CREATEROLE non-superusers",
        });
      }
      return evalResult("warning", {
        summary: `${input.roles.length} CREATEROLE roles require review`,
        expected: "CREATEROLE tightly controlled",
        actual: input.roles.map((r) => r.rolname).join(", "),
        evidence: input,
        evidenceSummary: input.roles.map((r) => r.rolname).join(", "),
      });
    },
    remediation: rem("Remove unnecessary CREATEROLE", [
      "ALTER ROLE name NOCREATEROLE",
    ]),
    mappings: [
      map(
        "essential-eight",
        "2023",
        "Restrict administrative privileges",
        "evidence_contributes",
        "Role creation is administrative privilege",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.nested_privileged_membership",
    version: "1.0.0",
    title: "Nested membership into privileged roles",
    description:
      "Detects non-superuser roles that inherit membership in superuser or bypassrls roles.",
    rationale: "Indirect privilege inheritance is easy to miss in reviews.",
    severity: "high",
    categories: ["identity", "privileged_access"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        member: string;
        privileged_role: string;
      }>(`
        SELECT m.rolname AS member, r.rolname AS privileged_role
        FROM pg_auth_members am
        JOIN pg_roles r ON r.oid = am.roleid
        JOIN pg_roles m ON m.oid = am.member
        WHERE (r.rolsuper OR r.rolbypassrls)
          AND m.rolsuper = false
          AND m.rolname NOT LIKE 'pg_%'
        ORDER BY 1, 2
      `);
      return { memberships: rows };
    },
    evaluate: (input) => {
      if (input.memberships.length === 0) {
        return evalResult("pass", {
          summary: "No unexpected nested privileged memberships",
          expected: "No non-superuser members of superuser/BYPASSRLS roles",
          actual: "none",
          evidence: input,
          evidenceSummary: "0 nested privileged memberships",
        });
      }
      return evalResult("fail", {
        summary: `${input.memberships.length} nested privileged memberships`,
        expected: "No non-superuser members of superuser/BYPASSRLS roles",
        actual: input.memberships
          .map((m) => `${m.member}→${m.privileged_role}`)
          .join("; "),
        evidence: input,
        evidenceSummary: `${input.memberships.length} memberships`,
      });
    },
    remediation: rem("Revoke nested privileged memberships", [
      "REVOKE privileged_role FROM member_role",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Privileged Access",
        "directly_supports",
        "Detects hidden privileged access paths",
        ISM,
        "high",
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.function_execute_public",
    version: "1.0.0",
    title: "Functions executable by PUBLIC",
    description:
      "Finds user functions where PUBLIC retains EXECUTE privilege.",
    rationale: "Broad EXECUTE on security-definer or sensitive functions is risky.",
    severity: "medium",
    categories: ["identity", "hardening"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        nspname: string;
        proname: string;
        prosecdef: boolean;
      }>(`
        SELECT n.nspname, p.proname, p.prosecdef
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND has_function_privilege('public', p.oid, 'EXECUTE')
        ORDER BY 1, 2
        LIMIT 200
      `);
      return { functions: rows };
    },
    evaluate: (input) => {
      const secdef = input.functions.filter((f) => f.prosecdef);
      if (secdef.length > 0) {
        return evalResult("fail", {
          summary: `${secdef.length} SECURITY DEFINER functions executable by PUBLIC`,
          expected: "REVOKE EXECUTE FROM PUBLIC on sensitive functions",
          actual: secdef
            .slice(0, 20)
            .map((f) => `${f.nspname}.${f.proname}`)
            .join(", "),
          evidence: input,
          evidenceSummary: `${secdef.length} secdef + PUBLIC EXECUTE`,
        });
      }
      if (input.functions.length > 50) {
        return evalResult("warning", {
          summary: `${input.functions.length} functions executable by PUBLIC`,
          expected: "Least privilege EXECUTE grants",
          actual: `${input.functions.length} functions`,
          evidence: input,
          evidenceSummary: `${input.functions.length} PUBLIC EXECUTE`,
        });
      }
      return evalResult("pass", {
        summary: "No SECURITY DEFINER functions open to PUBLIC EXECUTE",
        expected: "Least privilege EXECUTE grants",
        actual: `${input.functions.length} PUBLIC EXECUTE (none secdef)`,
        evidence: input,
        evidenceSummary: `${input.functions.length} functions`,
      });
    },
    remediation: rem("Revoke PUBLIC EXECUTE on sensitive functions", [
      "REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC",
      "GRANT EXECUTE to specific roles only",
    ]),
    mappings: [
      map(
        "cis-postgresql",
        "1.2.0",
        "6.7",
        "partially_supports",
        "Function privileges",
        CIS_PG,
      ),
      map(
        "owasp-asvs",
        "4.0.3",
        "V5.3",
        "evidence_contributes",
        "Output encoding / dangerous function exposure",
        "https://owasp.org/www-project-application-security-verification-standard/",
      ),
    ],
  }),

  defineControl({
    id: "pg.identity.database_owners",
    version: "1.0.0",
    title: "Database ownership",
    description: "Reports current database owner.",
    rationale: "Inappropriate ownership can allow privilege escalation paths.",
    severity: "low",
    categories: ["identity"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{ datname: string; owner: string }>(`
        SELECT d.datname, r.rolname AS owner
        FROM pg_database d
        JOIN pg_roles r ON r.oid = d.datdba
        WHERE d.datname = current_database()
      `);
      return { owner: rows[0]?.owner ?? "unknown", datname: rows[0]?.datname };
    },
    evaluate: (input) =>
      evalResult("pass", {
        summary: `Database owned by ${input.owner}`,
        expected: "Ownership by controlled admin role",
        actual: String(input.owner),
        evidence: input,
        evidenceSummary: `Owner: ${input.owner}`,
        recommendations: ["Confirm ownership aligns with operational model"],
      }),
    remediation: rem("Reassign database owner if inappropriate", [
      "ALTER DATABASE name OWNER TO admin_role",
    ]),
    mappings: [
      map(
        "iso27001",
        "2022",
        "A.5.15",
        "evidence_contributes",
        "Access control ownership accountability",
        "https://www.iso.org/standard/27001",
      ),
    ],
  }),
];
