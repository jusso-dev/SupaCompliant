import { identityControls } from "./identity/controls.js";
import { rlsControls } from "./rls/controls.js";
import { hardeningControls } from "./hardening/controls.js";
import { loggingControls } from "./logging/controls.js";
import { dataProtectionControls } from "./data-protection/controls.js";
import { resilienceControls } from "./resilience/controls.js";
import { supabaseControls } from "./supabase/controls.js";
import { manualControls } from "./manual/controls.js";
import { CONTROL_LIBRARY_VERSION, type AnyControl } from "./helpers.js";

export { CONTROL_LIBRARY_VERSION } from "./helpers.js";
export * from "./helpers.js";

export const allControls: AnyControl[] = [
  ...identityControls,
  ...rlsControls,
  ...hardeningControls,
  ...loggingControls,
  ...dataProtectionControls,
  ...resilienceControls,
  ...supabaseControls,
  ...manualControls,
];

export function getControlById(id: string): AnyControl | undefined {
  return allControls.find((c) => c.id === id);
}

export function listControls(filter?: {
  category?: string;
  target?: "supabase" | "postgresql";
}): AnyControl[] {
  return allControls.filter((c) => {
    if (filter?.category && !c.categories.includes(filter.category)) {
      return false;
    }
    if (filter?.target && !c.targets.includes(filter.target)) {
      return false;
    }
    return true;
  });
}

export function controlCount(): number {
  return allControls.length;
}

export {
  identityControls,
  rlsControls,
  hardeningControls,
  loggingControls,
  dataProtectionControls,
  resilienceControls,
  supabaseControls,
  manualControls,
};

/** Sanity: library version stamped into assessment manifests */
export const libraryMeta = {
  version: CONTROL_LIBRARY_VERSION,
  controlCount: allControls.length,
};
