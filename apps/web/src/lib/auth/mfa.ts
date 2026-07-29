import type { OrgRole } from "@supacompliant/shared";
import { isPrivilegedRole } from "@supacompliant/shared";

/**
 * MFA / AAL gate for privileged roles.
 * When org requires MFA and role is privileged, session must be AAL2+.
 */
export function privilegedMfaSatisfied(opts: {
  role: OrgRole;
  requireMfaPrivileged: boolean;
  /** Authenticator assurance level from session, e.g. "aal1" | "aal2" */
  aal?: string | null;
}): { ok: boolean; reason?: string } {
  if (!opts.requireMfaPrivileged) return { ok: true };
  if (!isPrivilegedRole(opts.role)) return { ok: true };
  const aal = (opts.aal ?? "aal1").toLowerCase();
  if (aal === "aal2" || aal === "aal3") return { ok: true };
  return {
    ok: false,
    reason:
      "Organisation policy requires multi-factor authentication for privileged roles (owner, administrator, assessment lead).",
  };
}
