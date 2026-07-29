import { describe, expect, it } from "vitest";
import { allControls, controlCount, getControlById } from "./index.js";

describe("control library", () => {
  it("has at least 50 controls", () => {
    expect(controlCount()).toBeGreaterThanOrEqual(50);
  });

  it("has unique control ids", () => {
    const ids = allControls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every control has version, mappings, remediation", () => {
    for (const c of allControls) {
      expect(c.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.mappings.length).toBeGreaterThan(0);
      expect(c.remediation.summary.length).toBeGreaterThan(0);
      expect(c.requiredCapabilities.length).toBeGreaterThan(0);
    }
  });

  it("never evaluates collection-empty password_encryption as pass when unknown", () => {
    const c = getControlById("pg.identity.password_encryption");
    expect(c).toBeDefined();
    const result = c!.evaluate({ passwordEncryption: "md5" });
    expect(result.status).toBe("fail");
    const unknown = c!.evaluate({ passwordEncryption: "unknown" });
    expect(unknown.status).toBe("unknown");
  });

  it("superuser inventory fails when many login supers", () => {
    const c = getControlById("pg.identity.superuser_inventory");
    const result = c!.evaluate({
      superusers: Array.from({ length: 5 }, (_, i) => ({
        rolname: `s${i}`,
        rolcanlogin: true,
        rolbypassrls: true,
      })),
    });
    expect(result.status).toBe("fail");
  });

  it("permissive true policies fail", () => {
    const c = getControlById("pg.rls.permissive_true_policies");
    const result = c!.evaluate({
      totalPolicies: 1,
      permissive: [
        {
          schemaname: "public",
          tablename: "t",
          policyname: "open",
          cmd: "ALL",
          qual: "true",
          with_check: null,
        },
      ],
    });
    expect(result.status).toBe("fail");
  });

  it("E8 application control is not_applicable not pass", () => {
    const c = getControlById("org.e8.application_control_out_of_scope");
    const result = c!.evaluate({ inScope: false });
    expect(result.status).toBe("not_applicable");
  });

  it("backup evidence is manual_review never pass", () => {
    const c = getControlById("pg.resilience.backup_pitr_evidence");
    const result = c!.evaluate({ requiresEvidence: true });
    expect(result.status).toBe("manual_review");
  });

  it("supported version passes for PG16", () => {
    const c = getControlById("pg.hardening.version_supported");
    const result = c!.evaluate({
      version: "PostgreSQL 16.4",
      major: 16,
    });
    expect(result.status).toBe("pass");
  });

  it("management API absence is not_assessed not pass", () => {
    const c = getControlById("sb.management_api_capability");
    const result = c!.evaluate({ hasManagement: false, canCall: false });
    expect(result.status).toBe("not_assessed");
  });

  it("log drain is always manual_review", () => {
    const c = getControlById("sb.log_drain_evidence");
    expect(c!.evaluate({ hasManagement: true }).status).toBe("manual_review");
  });
});

