import type { OrgRole } from "./enums.js";

export type Permission =
  | "org:manage"
  | "org:members"
  | "org:billing"
  | "project:write"
  | "connection:write"
  | "connection:test"
  | "assessment:run"
  | "assessment:approve"
  | "finding:write"
  | "comment:write"
  | "report:export"
  | "report:view"
  | "audit:view"
  | "settings:write"
  | "api_key:manage"
  | "webhook:manage";

const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: [
    "org:manage",
    "org:members",
    "org:billing",
    "project:write",
    "connection:write",
    "connection:test",
    "assessment:run",
    "assessment:approve",
    "finding:write",
    "comment:write",
    "report:export",
    "report:view",
    "audit:view",
    "settings:write",
    "api_key:manage",
    "webhook:manage",
  ],
  administrator: [
    "org:members",
    "project:write",
    "connection:write",
    "connection:test",
    "assessment:run",
    "assessment:approve",
    "finding:write",
    "comment:write",
    "report:export",
    "report:view",
    "audit:view",
    "settings:write",
    "api_key:manage",
    "webhook:manage",
  ],
  assessment_lead: [
    "project:write",
    "connection:write",
    "connection:test",
    "assessment:run",
    "assessment:approve",
    "finding:write",
    "comment:write",
    "report:export",
    "report:view",
    "audit:view",
  ],
  assessor: [
    "connection:test",
    "assessment:run",
    "finding:write",
    "comment:write",
    "report:export",
    "report:view",
  ],
  engineer: ["finding:write", "comment:write", "report:view", "report:export"],
  reviewer: [
    "assessment:approve",
    "comment:write",
    "report:view",
    "report:export",
  ],
  viewer: ["report:view"],
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: OrgRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export const PRIVILEGED_ROLES: readonly OrgRole[] = [
  "owner",
  "administrator",
  "assessment_lead",
] as const;

export function isPrivilegedRole(role: OrgRole): boolean {
  return (PRIVILEGED_ROLES as readonly string[]).includes(role);
}
