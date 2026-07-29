import { defineControl, evalResult, map, rem } from "../helpers.js";

const SENSITIVE_NAME =
  /(password|passwd|secret|token|api_?key|private_?key|ssn|tax_file|credit_?card|card_number|cvv)/i;

export const dataProtectionControls = [
  defineControl({
    id: "pg.data.sensitive_column_names",
    version: "1.0.0",
    title: "Sensitive-looking column names",
    description:
      "Metadata scan for column names suggesting secrets or personal data. No row data exported.",
    rationale: "Helps prioritise encryption, masking, and access review.",
    severity: "medium",
    categories: ["data_protection"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      const rows = await ctx.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        data_type: string;
      }>(`
        SELECT table_schema, table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_schema NOT LIKE 'pg_%'
        ORDER BY 1, 2, 3
        LIMIT 5000
      `);
      const hits = rows.filter((r) => SENSITIVE_NAME.test(r.column_name));
      return { hits: hits.slice(0, 200), hitCount: hits.length };
    },
    evaluate: (input) => {
      if (input.hitCount === 0) {
        return evalResult("pass", {
          summary: "No sensitive-looking column names matched heuristics",
          expected: "Sensitive fields classified and protected",
          actual: "0 name matches",
          evidence: input,
          evidenceSummary: "0 hits",
        });
      }
      return evalResult("warning", {
        summary: `${input.hitCount} columns match sensitive name heuristics`,
        expected: "Sensitive fields classified and protected",
        actual: input.hits
          .slice(0, 20)
          .map((h) => `${h.table_schema}.${h.table_name}.${h.column_name}`)
          .join(", "),
        evidence: input,
        evidenceSummary: `${input.hitCount} hits (metadata only)`,
      });
    },
    remediation: rem("Classify and protect sensitive columns", [
      "Apply encryption/Vault for secrets",
      "Restrict SELECT privileges",
      "Avoid storing secrets in application tables when possible",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Data Handling",
        "evidence_contributes",
        "Identification of sensitive data stores",
        "https://www.cyber.gov.au/ism",
      ),
      map(
        "pci-dss",
        "4.0",
        "3.2",
        "evidence_contributes",
        "Where PAN/sensitive auth data may exist",
        "https://www.pcisecuritystandards.org/",
        "low",
      ),
      map(
        "iso27001",
        "2022",
        "A.8.11",
        "evidence_contributes",
        "Data masking / classification support",
        "https://www.iso.org/standard/27001",
      ),
    ],
  }),

  defineControl({
    id: "pg.data.vault_extension",
    version: "1.0.0",
    title: "Vault or secrets extension present",
    description: "Checks for supabase vault / pgsodium-style secret storage extensions.",
    rationale: "Secrets in Vault reduce plaintext credential sprawl in tables.",
    severity: "low",
    categories: ["data_protection"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => ({
      hasVault: ctx.extensions.includes("supabase_vault") || ctx.extensions.includes("pgsodium"),
      extensions: ctx.extensions.filter((e) =>
        ["supabase_vault", "pgsodium", "pgcrypto"].includes(e),
      ),
    }),
    evaluate: (input) => {
      if (input.hasVault) {
        return evalResult("pass", {
          summary: "Vault/pgsodium-related extension present",
          expected: "Secrets mechanism available for application secrets",
          actual: input.extensions.join(", "),
          evidence: input,
          evidenceSummary: input.extensions.join(", "),
        });
      }
      return evalResult("manual_review", {
        summary: "No Vault extension detected — confirm alternate secret store",
        expected: "Secrets mechanism available for application secrets",
        actual: "no vault/pgsodium",
        evidence: input,
        evidenceSummary: "no vault extension",
      });
    },
    remediation: rem("Adopt Vault or external secret manager", [
      "Use Supabase Vault for DB-side secrets",
      "Or external KMS / secret manager for app secrets",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Cryptographic Protection",
        "evidence_contributes",
        "Secret storage mechanism",
        "https://www.cyber.gov.au/ism",
      ),
    ],
  }),

  defineControl({
    id: "pg.data.pgcrypto_available",
    version: "1.0.0",
    title: "pgcrypto extension availability",
    description: "Checks if pgcrypto is available for application-level crypto helpers.",
    rationale: "Useful for hashing and encryption functions when designed correctly.",
    severity: "informational",
    categories: ["data_protection"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => ({ installed: ctx.extensions.includes("pgcrypto") }),
    evaluate: (input) =>
      evalResult(input.installed ? "pass" : "manual_review", {
        summary: input.installed
          ? "pgcrypto installed"
          : "pgcrypto not installed — confirm crypto approach",
        expected: "Documented crypto approach for sensitive fields",
        actual: input.installed ? "installed" : "missing",
        evidence: input,
        evidenceSummary: input.installed ? "pgcrypto" : "no pgcrypto",
      }),
    remediation: rem("Install pgcrypto if required by design", [
      "CREATE EXTENSION pgcrypto",
    ]),
    mappings: [
      map(
        "nist-800-171",
        "Rev. 2",
        "3.13.11",
        "evidence_contributes",
        "Cryptographic protection of CUI where applicable",
        "https://csrc.nist.gov/publications/detail/sp/800-171/rev-2/final",
        "low",
        "NIST SP 800-171 Rev. 2",
      ),
    ],
  }),

  defineControl({
    id: "pg.data.storage_buckets_public",
    version: "1.0.0",
    title: "Public Storage buckets (Supabase)",
    description: "Detects storage.buckets marked public when storage schema exists.",
    rationale: "Public buckets can expose objects without per-object authz.",
    severity: "high",
    categories: ["data_protection", "supabase"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ id: string; name: string; public: boolean }>(`
          SELECT id::text, name, public FROM storage.buckets ORDER BY name
        `);
        return { buckets: rows, readable: true };
      } catch {
        return { buckets: [], readable: false };
      }
    },
    evaluate: (input) => {
      if (!input.readable) {
        return evalResult("unknown", {
          summary: "Cannot read storage.buckets",
          expected: "No unexpected public buckets",
          actual: "unreadable",
          evidence: input,
          evidenceSummary: "unreadable",
        });
      }
      const pub = input.buckets.filter((b) => b.public);
      if (pub.length === 0) {
        return evalResult("pass", {
          summary: "No public storage buckets",
          expected: "No unexpected public buckets",
          actual: `${input.buckets.length} buckets, 0 public`,
          evidence: input,
          evidenceSummary: "0 public",
        });
      }
      return evalResult("fail", {
        summary: `${pub.length} public storage buckets`,
        expected: "No unexpected public buckets",
        actual: pub.map((b) => b.name).join(", "),
        evidence: { public: pub, all: input.buckets },
        evidenceSummary: pub.map((b) => b.name).join(", "),
      });
    },
    remediation: rem("Make buckets private and use signed URLs / policies", [
      "Update bucket public=false",
      "Define storage RLS policies",
    ]),
    mappings: [
      map(
        "owasp-top10",
        "2021",
        "A01",
        "directly_supports",
        "Public object storage access control",
        "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
        "high",
      ),
      map(
        "owasp-api",
        "2023",
        "API1",
        "partially_supports",
        "Broken object level authorisation for stored objects",
        "https://owasp.org/API-Security/",
      ),
    ],
  }),

  defineControl({
    id: "pg.data.storage_objects_rls",
    version: "1.0.0",
    title: "Storage objects table RLS",
    description: "Checks RLS on storage.objects when present.",
    rationale: "Without RLS, storage metadata/objects may be broadly accessible via API roles.",
    severity: "critical",
    categories: ["data_protection", "rls", "supabase"],
    targets: ["supabase"],
    requiredCapabilities: ["basic_catalogue"],
    collect: async (ctx) => {
      try {
        const rows = await ctx.query<{ relrowsecurity: boolean; relname: string }>(`
          SELECT c.relname, c.relrowsecurity
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'storage' AND c.relname = 'objects'
        `);
        return {
          exists: rows.length > 0,
          rls: Boolean(rows[0]?.relrowsecurity),
        };
      } catch {
        return { exists: false, rls: false };
      }
    },
    evaluate: (input) => {
      if (!input.exists) {
        return evalResult("not_applicable", {
          summary: "storage.objects not present",
          expected: "RLS enabled on storage.objects",
          actual: "missing table",
          evidence: input,
          evidenceSummary: "N/A",
        });
      }
      if (input.rls) {
        return evalResult("pass", {
          summary: "RLS enabled on storage.objects",
          expected: "RLS enabled on storage.objects",
          actual: "enabled",
          evidence: input,
          evidenceSummary: "RLS on",
        });
      }
      return evalResult("fail", {
        summary: "RLS disabled on storage.objects",
        expected: "RLS enabled on storage.objects",
        actual: "disabled",
        evidence: input,
        evidenceSummary: "RLS off",
      });
    },
    remediation: rem("Enable RLS and policies on storage.objects", [
      "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY",
    ]),
    mappings: [
      map(
        "owasp-asvs",
        "4.0.3",
        "V4.1",
        "directly_supports",
        "Object-level access control for files",
        "https://owasp.org/www-project-application-security-verification-standard/",
        "high",
      ),
    ],
  }),

  defineControl({
    id: "pg.data.personal_data_classification",
    version: "1.0.0",
    title: "Personal data classification metadata",
    description:
      "Manual control — organisation must attest data classification for database contents.",
    rationale: "Technical scanners cannot fully classify personal information.",
    severity: "medium",
    categories: ["data_protection"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ requiresEvidence: true }),
    evaluate: () =>
      evalResult("manual_review", {
        summary: "Attach data classification register for this environment",
        expected: "Classified personal/sensitive data inventory",
        actual: "not provided via technical check",
        evidence: { requiresEvidence: true },
        evidenceSummary: "manual classification required",
      }),
    remediation: rem("Maintain data classification for DB contents", [
      "Document PII/sensitive tables",
      "Link retention schedule",
    ]),
    mappings: [
      map(
        "pspf",
        "2022",
        "INFOSEC-9",
        "manual_validation_required",
        "Information management / protective marking alignment",
        "https://www.protectivesecurity.gov.au/",
        "medium",
      ),
      map(
        "iso27001",
        "2022",
        "A.5.12",
        "manual_validation_required",
        "Classification of information",
        "https://www.iso.org/standard/27001",
      ),
    ],
  }),
];
