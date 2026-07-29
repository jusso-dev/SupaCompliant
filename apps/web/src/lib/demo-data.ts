import type { ControlResultStatus, Severity } from "@supacompliant/shared";
import { computeTechnicalPosture } from "@supacompliant/shared";
import { allControls } from "@supacompliant/control-library";
import { frameworks } from "@supacompliant/framework-mappings";

export interface DemoExecution {
  controlId: string;
  controlVersion: string;
  title: string;
  status: ControlResultStatus;
  severity: Severity;
  summary: string;
  expected: string;
  actual: string;
  evidenceSummary: string;
  categories: string[];
  remediation: string;
}

export interface DemoRun {
  id: string;
  label: string;
  environment: string;
  status: string;
  completedAt: string;
  digest: string;
  postgresVersion: string;
  results: DemoExecution[];
}

function statusFor(controlId: string, runIndex: number): ControlResultStatus {
  // Deterministic demo trajectory: improve over runs, one regression in last
  const hash = [...controlId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = (hash + runIndex * 7) % 10;

  if (controlId.startsWith("org.e8.")) return "not_applicable";
  if (controlId.includes("backup") || controlId.includes("manual") || controlId.includes("evidence") || controlId.includes("mfa") || controlId.includes("rotation") || controlId.includes("classification") || controlId.includes("privileged_access_review") || controlId.includes("environment_separation") || controlId.includes("incident")) {
    return "manual_review";
  }

  // Run 0: many fails; later runs improve; final run regresses RLS true policies
  if (controlId === "pg.rls.permissive_true_policies" && runIndex === 5) {
    return "fail";
  }
  if (controlId === "pg.rls.tables_without_rls") {
    return runIndex < 2 ? "fail" : "pass";
  }
  if (controlId === "pg.hardening.version_supported") return "pass";
  if (controlId === "pg.identity.password_encryption") {
    return runIndex === 0 ? "fail" : "pass";
  }
  if (controlId === "pg.logging.pgaudit_installed") {
    return runIndex < 3 ? "fail" : "pass";
  }
  if (controlId === "sb.auth.users_table_rls") return "pass";
  if (base < 1 && runIndex < 2) return "fail";
  if (base < 2 && runIndex < 3) return "warning";
  if (base === 9) return "unknown";
  return "pass";
}

function buildRun(index: number): DemoRun {
  const date = new Date(Date.UTC(2026, 0, 5 + index * 12, 10, 0, 0));
  const results: DemoExecution[] = allControls.map((c) => {
    const status = statusFor(c.id, index);
    return {
      controlId: c.id,
      controlVersion: c.version,
      title: c.title,
      status,
      severity: c.severity,
      summary:
        status === "pass"
          ? c.title + " satisfied"
          : status === "fail"
            ? c.title + " failed technical check"
            : status === "manual_review"
              ? "Manual evidence required"
              : status === "not_applicable"
                ? "Outside database assessment scope"
                : status === "unknown"
                  ? "Insufficient privilege or evidence"
                  : c.title,
      expected: "See control definition",
      actual: status,
      evidenceSummary: `Demo evidence for ${c.id} (run ${index + 1})`,
      categories: c.categories,
      remediation: c.remediation.summary,
    };
  });

  return {
    id: `demo-run-${index + 1}`,
    label: `Assessment #${index + 1}`,
    environment: ["development", "staging", "production", "production", "production", "production"][index]!,
    status: index === 5 ? "completed" : "approved",
    completedAt: date.toISOString(),
    digest: `demo${index}${"a".repeat(60)}`.slice(0, 64),
    postgresVersion: "PostgreSQL 16.4 on aarch64-unknown-linux-gnu",
    results,
  };
}

export const demoOrg = {
  name: "Aurora Digital (Demo)",
  slug: "aurora-demo",
  members: [
    { name: "Alex Chen", role: "owner", email: "alex@aurora.demo" },
    { name: "Sam Okonkwo", role: "assessment_lead", email: "sam@aurora.demo" },
    { name: "Jordan Lee", role: "engineer", email: "jordan@aurora.demo" },
  ],
};

export const demoProject = {
  name: "Customer Platform",
  slug: "customer-platform",
  environments: ["development", "staging", "production"],
};

export const demoRuns: DemoRun[] = Array.from({ length: 6 }, (_, i) => buildRun(i));

export const latestRun = demoRuns[demoRuns.length - 1]!;
export const previousRun = demoRuns[demoRuns.length - 2]!;

export function latestPosture() {
  return computeTechnicalPosture(
    latestRun.results.map((r) => ({ status: r.status, severity: r.severity })),
  );
}

export function previousPosture() {
  return computeTechnicalPosture(
    previousRun.results.map((r) => ({ status: r.status, severity: r.severity })),
  );
}

export const demoFindings = latestRun.results
  .filter((r) => r.status === "fail")
  .slice(0, 8)
  .map((r, i) => ({
    id: `finding-${i + 1}`,
    title: r.title,
    severity: r.severity,
    status: i === 0 ? "in_progress" : i === 1 ? "acknowledged" : "open",
    controlId: r.controlId,
    owner: i % 2 === 0 ? "Jordan Lee" : "Sam Okonkwo",
    environment: "production",
    firstObserved: demoRuns[0]!.completedAt,
    lastObserved: latestRun.completedAt,
  }));

export const demoComments = [
  {
    id: "c1",
    author: "Sam Okonkwo",
    body: "Confirmed missing RLS on `public.documents` in the vulnerable sample. Tracking as finding #1.",
    at: "2026-03-10T09:12:00.000Z",
    controlId: "pg.rls.tables_without_rls",
  },
  {
    id: "c2",
    author: "Jordan Lee",
    body: "Patch ready in migration `0004_enable_rls.sql`. Requesting re-run after merge.",
    at: "2026-03-11T14:40:00.000Z",
    controlId: "pg.rls.tables_without_rls",
  },
  {
    id: "c3",
    author: "Alex Chen",
    body: "Regression on unconditional policy after hotfix — please do not mark resolved until verified.",
    at: "2026-03-20T08:05:00.000Z",
    controlId: "pg.rls.permissive_true_policies",
  },
];

export const demoFrameworks = frameworks;

export const controlCatalogue = allControls.map((c) => ({
  id: c.id,
  version: c.version,
  title: c.title,
  severity: c.severity,
  categories: c.categories,
  targets: c.targets,
  description: c.description,
  mappingCount: c.mappings.length,
}));
