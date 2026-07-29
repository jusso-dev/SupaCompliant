import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TENANT_TABLES } from "./schema.js";
import { hasPermission, type Permission } from "@supacompliant/shared";
import type { OrgRole } from "@supacompliant/shared";

function loadMigrations(): string {
  // From packages/database → repo root supabase/migrations
  const migDir = join(process.cwd(), "../../supabase/migrations");
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql"));
  return files.map((f) => readFileSync(join(migDir, f), "utf8")).join("\n");
}

describe("RLS migration coverage", () => {
  const sql = loadMigrations();

  it("enables and forces RLS on every tenant table", () => {
    for (const table of TENANT_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`,
          "i",
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table}\\s+FORCE ROW LEVEL SECURITY`,
          "i",
        ),
      );
    }
  });

  it("revokes connection_secrets and jobs from authenticated", () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.connection_secrets FROM authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON public\.jobs FROM authenticated/i);
  });

  it("has is_org_member helper with fixed search_path", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_org_member/i);
    expect(sql).toMatch(/SET search_path = public/i);
  });

  it("membership select requires org membership", () => {
    expect(sql).toMatch(
      /CREATE POLICY memberships_select[\s\S]*is_org_member\(organisation_id\)/i,
    );
  });
});

describe("role permission matrix", () => {
  const matrix: Array<{ role: OrgRole; allow: Permission[]; deny: Permission[] }> =
    [
      {
        role: "viewer",
        allow: ["report:view"],
        deny: ["assessment:run", "connection:write", "org:manage"],
      },
      {
        role: "assessor",
        allow: ["assessment:run", "report:view"],
        deny: ["org:manage", "api_key:manage"],
      },
      {
        role: "owner",
        allow: ["org:manage", "assessment:run", "api_key:manage"],
        deny: [],
      },
    ];

  for (const row of matrix) {
    it(`${row.role} permissions`, () => {
      for (const p of row.allow) {
        expect(hasPermission(row.role, p)).toBe(true);
      }
      for (const p of row.deny) {
        expect(hasPermission(row.role, p)).toBe(false);
      }
    });
  }
});

/**
 * Pure logic model of cross-tenant isolation used by policies:
 * row visible iff actor membership org_id === row.organisation_id
 */
function canAccessRow(
  actorOrgIds: string[],
  rowOrganisationId: string,
): boolean {
  return actorOrgIds.includes(rowOrganisationId);
}

describe("cross-tenant access model", () => {
  it("denies other organisation rows", () => {
    expect(canAccessRow(["org-a"], "org-b")).toBe(false);
  });

  it("allows own organisation rows", () => {
    expect(canAccessRow(["org-a", "org-c"], "org-a")).toBe(true);
  });

  it("simulates attack: forged org_id in payload still filtered by membership", () => {
    const memberships = ["org-victim"];
    const attackerPayloadOrg = "org-attacker";
    // Even if attacker sends victim's resource id, policy uses membership not payload trust
    const resourceOrg = "org-victim";
    // Attacker only has org-attacker membership
    const attackerMemberships = [attackerPayloadOrg];
    expect(canAccessRow(attackerMemberships, resourceOrg)).toBe(false);
    expect(canAccessRow(memberships, resourceOrg)).toBe(true);
  });
});
