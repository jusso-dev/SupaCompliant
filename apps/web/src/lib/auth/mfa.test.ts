import { describe, expect, it } from "vitest";
import { privilegedMfaSatisfied } from "./mfa";

describe("privilegedMfaSatisfied", () => {
  it("allows when org does not require MFA", () => {
    expect(
      privilegedMfaSatisfied({
        role: "owner",
        requireMfaPrivileged: false,
        aal: "aal1",
      }).ok,
    ).toBe(true);
  });

  it("allows viewers without MFA when policy on", () => {
    expect(
      privilegedMfaSatisfied({
        role: "viewer",
        requireMfaPrivileged: true,
        aal: "aal1",
      }).ok,
    ).toBe(true);
  });

  it("blocks owner on aal1 when policy on", () => {
    const r = privilegedMfaSatisfied({
      role: "owner",
      requireMfaPrivileged: true,
      aal: "aal1",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("allows owner on aal2 when policy on", () => {
    expect(
      privilegedMfaSatisfied({
        role: "owner",
        requireMfaPrivileged: true,
        aal: "aal2",
      }).ok,
    ).toBe(true);
  });
});
