import { allControls } from "@supacompliant/control-library";
import { latestRun } from "@/lib/demo-data";
import type { ControlResultStatus } from "@supacompliant/shared";

export type E8Strategy = {
  id: string;
  name: string;
  inDatabaseScope: boolean;
  notes: string;
};

/** ASD Essential Eight strategies — database contribution only. */
export const E8_STRATEGIES: E8Strategy[] = [
  {
    id: "application-control",
    name: "Application control",
    inDatabaseScope: false,
    notes: "Endpoint/OS control. Out of database assessment scope.",
  },
  {
    id: "patch-applications",
    name: "Patch applications",
    inDatabaseScope: true,
    notes: "DB engine version + extension inventory contribute evidence only.",
  },
  {
    id: "configure-microsoft-office-macro-settings",
    name: "Configure Microsoft Office macro settings",
    inDatabaseScope: false,
    notes: "Endpoint control. Out of database assessment scope.",
  },
  {
    id: "user-application-hardening",
    name: "User application hardening",
    inDatabaseScope: false,
    notes: "Endpoint/browser hardening. Out of database assessment scope.",
  },
  {
    id: "restrict-administrative-privileges",
    name: "Restrict administrative privileges",
    inDatabaseScope: true,
    notes: "Superuser, BYPASSRLS, CREATEROLE, service_role handling.",
  },
  {
    id: "multi-factor-authentication",
    name: "Multi-factor authentication",
    inDatabaseScope: true,
    notes: "Manual evidence required — cannot claim MFA maturity from SQL alone.",
  },
  {
    id: "regular-backups",
    name: "Regular backups",
    inDatabaseScope: true,
    notes: "Backup/PITR evidence is manual review — never auto-pass.",
  },
  {
    id: "patch-operating-systems",
    name: "Patch operating systems",
    inDatabaseScope: false,
    notes: "Host OS patching is outside pure database assessment.",
  },
];

export type StrategyContribution = {
  strategy: E8Strategy;
  technicalControls: Array<{
    controlId: string;
    title: string;
    status: ControlResultStatus;
    relationship: string;
  }>;
  technicalPass: number;
  technicalFail: number;
  manualReview: number;
  notApplicable: number;
  notAssessed: number;
  unknownOrError: number;
};

export function buildEssentialEightContribution(): {
  strategies: StrategyContribution[];
  disclaimer: string;
} {
  const resultById = new Map(
    latestRun.results.map((r) => [r.controlId, r] as const),
  );

  const strategies = E8_STRATEGIES.map((strategy) => {
    const mapped = allControls.flatMap((c) =>
      c.mappings
        .filter(
          (m) =>
            m.frameworkId === "essential-eight" &&
            m.controlIdentifier.toLowerCase().includes(
              strategy.name.toLowerCase().slice(0, 12).toLowerCase(),
            ) ||
            (m.frameworkId === "essential-eight" &&
              strategy.id.includes("restrict") &&
              m.controlIdentifier.toLowerCase().includes("admin")) ||
            (m.frameworkId === "essential-eight" &&
              strategy.id.includes("patch-app") &&
              m.controlIdentifier.toLowerCase().includes("patch")) ||
            (m.frameworkId === "essential-eight" &&
              strategy.id.includes("multi-factor") &&
              m.controlIdentifier.toLowerCase().includes("factor")) ||
            (m.frameworkId === "essential-eight" &&
              strategy.id.includes("backup") &&
              m.controlIdentifier.toLowerCase().includes("backup")) ||
            (m.frameworkId === "essential-eight" &&
              strategy.id.includes("application-control") &&
              m.controlIdentifier.toLowerCase().includes("application control")) ||
            (m.frameworkId === "essential-eight" &&
              strategy.id.includes("macro") &&
              m.controlIdentifier.toLowerCase().includes("macro")),
        )
        .map((m) => ({ control: c, relationship: m.relationship })),
    );

    // Fallback: match by mapping controlIdentifier equality to known set
    const byName = allControls.flatMap((c) =>
      c.mappings
        .filter((m) => m.frameworkId === "essential-eight")
        .filter((m) => {
          const id = m.controlIdentifier.toLowerCase();
          if (strategy.id === "restrict-administrative-privileges")
            return id.includes("restrict administrative");
          if (strategy.id === "patch-applications")
            return id.includes("patch applications");
          if (strategy.id === "multi-factor-authentication")
            return id.includes("multi-factor") || id.includes("multi factor");
          if (strategy.id === "regular-backups") return id.includes("backup");
          if (strategy.id === "application-control")
            return id.includes("application control");
          if (strategy.id === "configure-microsoft-office-macro-settings")
            return id.includes("macro");
          if (strategy.id === "user-application-hardening")
            return id.includes("user application");
          if (strategy.id === "patch-operating-systems")
            return id.includes("operating system") || id.includes("patch operating");
          return false;
        })
        .map((m) => ({ control: c, relationship: m.relationship })),
    );

    const list = byName.length ? byName : mapped;
    const technicalControls = list.map(({ control, relationship }) => {
      const res = resultById.get(control.id);
      return {
        controlId: control.id,
        title: control.title,
        status: (res?.status ?? "not_assessed") as ControlResultStatus,
        relationship,
      };
    });

    const counts = {
      technicalPass: 0,
      technicalFail: 0,
      manualReview: 0,
      notApplicable: 0,
      notAssessed: 0,
      unknownOrError: 0,
    };
    for (const t of technicalControls) {
      if (t.status === "pass") counts.technicalPass += 1;
      else if (t.status === "fail" || t.status === "warning")
        counts.technicalFail += 1;
      else if (t.status === "manual_review") counts.manualReview += 1;
      else if (t.status === "not_applicable") counts.notApplicable += 1;
      else if (t.status === "not_assessed") counts.notAssessed += 1;
      else counts.unknownOrError += 1;
    }

    return {
      strategy,
      technicalControls,
      ...counts,
    };
  });

  return {
    strategies,
    disclaimer:
      "This view shows database-adjacent technical contribution only. SupaCompliant never fabricates an Essential Eight maturity level from database evidence alone. Organisational and endpoint evidence is required for a complete assessment.",
  };
}
