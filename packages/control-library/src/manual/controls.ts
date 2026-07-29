import { defineControl, evalResult, map, rem } from "../helpers.js";

/** Controls that are intentionally manual / out of pure DB scope. */
export const manualControls = [
  defineControl({
    id: "org.e8.application_control_out_of_scope",
    version: "1.0.0",
    title: "Essential Eight application control (out of DB scope)",
    description:
      "Application control is not assessable via PostgreSQL connection.",
    rationale:
      "Honest scope boundary — prevents false Essential Eight maturity claims.",
    severity: "informational",
    categories: ["essential_eight", "scope"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ inScope: false }),
    evaluate: () =>
      evalResult("not_applicable", {
        summary:
          "Application control is outside database assessment scope unless separate evidence is attached",
        expected: "Host/EDR application control evidence from other systems",
        actual: "out of scope for DB assessment",
        evidence: { inScope: false },
        evidenceSummary: "out of scope",
      }),
    remediation: rem("Assess application control via endpoint tooling", [
      "Collect EDR / WDAC / AppLocker evidence separately",
    ]),
    mappings: [
      map(
        "essential-eight",
        "2023",
        "Application control",
        "manual_validation_required",
        "Not database-assessable; listed for transparency",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "high",
      ),
    ],
  }),

  defineControl({
    id: "org.e8.macro_hardening_out_of_scope",
    version: "1.0.0",
    title: "Office macro hardening (out of DB scope)",
    description: "Microsoft Office macro controls are not database controls.",
    rationale: "Transparent Essential Eight boundary.",
    severity: "informational",
    categories: ["essential_eight", "scope"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ inScope: false }),
    evaluate: () =>
      evalResult("not_applicable", {
        summary: "Office macro hardening outside database assessment scope",
        expected: "Endpoint configuration evidence",
        actual: "out of scope",
        evidence: { inScope: false },
        evidenceSummary: "out of scope",
      }),
    remediation: rem("Assess via endpoint management", [
      "Group Policy / Intune macro policies",
    ]),
    mappings: [
      map(
        "essential-eight",
        "2023",
        "Configure Microsoft Office macro settings",
        "manual_validation_required",
        "Not database-assessable",
        "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
        "high",
      ),
    ],
  }),

  defineControl({
    id: "org.privileged_access_review",
    version: "1.0.0",
    title: "Privileged access review attestation",
    description:
      "Periodic human review of database privileged roles and memberships.",
    rationale: "Technical inventory alone is not a completed access review.",
    severity: "medium",
    categories: ["identity", "governance"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ requiresEvidence: true }),
    evaluate: () =>
      evalResult("manual_review", {
        summary: "Attach last privileged access review record",
        expected: "Periodic review with sign-off",
        actual: "not provided",
        evidence: { requiresEvidence: true },
        evidenceSummary: "manual review required",
      }),
    remediation: rem("Run and document privileged access review", [
      "Use superuser/BYPASSRLS inventory from technical controls",
      "Sign-off by security owner",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Privileged Access",
        "manual_validation_required",
        "Review process evidence",
        "https://www.cyber.gov.au/ism",
        "high",
      ),
      map(
        "iso27001",
        "2022",
        "A.5.18",
        "manual_validation_required",
        "Access rights review",
        "https://www.iso.org/standard/27001",
      ),
      map(
        "soc2",
        "2017",
        "CC6.2",
        "manual_validation_required",
        "Access provisioning review",
        "https://www.aicpa.org/soc2",
      ),
    ],
  }),

  defineControl({
    id: "org.environment_separation_evidence",
    version: "1.0.0",
    title: "Environment separation evidence",
    description:
      "Confirm prod/non-prod separation and absence of shared prod credentials in lower envs.",
    rationale: "Technical probe of one DB cannot prove org-wide separation.",
    severity: "high",
    categories: ["governance"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ requiresEvidence: true }),
    evaluate: () =>
      evalResult("manual_review", {
        summary: "Attest environment separation and credential segregation",
        expected: "Isolated prod credentials and change paths",
        actual: "not provided",
        evidence: { requiresEvidence: true },
        evidenceSummary: "manual evidence required",
      }),
    remediation: rem("Separate environments and credentials", [
      "Distinct Supabase projects per environment",
      "No shared service_role across prod/dev",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Separation of Environments",
        "manual_validation_required",
        "Org-level environment separation",
        "https://www.cyber.gov.au/ism",
        "high",
      ),
    ],
  }),

  defineControl({
    id: "org.incident_investigation_support",
    version: "1.0.0",
    title: "Incident investigation support readiness",
    description:
      "Manual check that logs, backups, and access records support investigation.",
    rationale: "Supports ISM incident investigation themes without overclaiming.",
    severity: "medium",
    categories: ["governance", "logging"],
    targets: ["postgresql", "supabase"],
    requiredCapabilities: ["manual_evidence"],
    collect: async () => ({ requiresEvidence: true }),
    evaluate: () =>
      evalResult("manual_review", {
        summary: "Document investigation runbook and evidence sources",
        expected: "Runbook + reachable audit sources",
        actual: "not provided",
        evidence: { requiresEvidence: true },
        evidenceSummary: "manual evidence required",
      }),
    remediation: rem("Maintain DB incident runbook", [
      "Link SIEM queries",
      "Define evidence retention",
    ]),
    mappings: [
      map(
        "ism",
        "2025",
        "Incident Investigation",
        "manual_validation_required",
        "Investigation support evidence",
        "https://www.cyber.gov.au/ism",
      ),
      map(
        "nist-csf",
        "2.0",
        "RS.AN",
        "manual_validation_required",
        "Incident analysis capability",
        "https://www.nist.gov/cyberframework",
      ),
    ],
  }),
];
