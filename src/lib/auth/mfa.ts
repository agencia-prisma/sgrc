import type { AppRole } from "@/lib/supabase/database.types";

export const MFA_REQUIRED_ROLES = [
  "super_admin",
  "director",
  "sales_manager",
  "finance",
] satisfies AppRole[];

export function hasRequiredMfaRole(roles: readonly AppRole[]) {
  return roles.some((role) =>
    MFA_REQUIRED_ROLES.some((requiredRole) => requiredRole === role),
  );
}
