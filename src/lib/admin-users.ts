import type { AppRole } from "@/lib/supabase/database.types";

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super administrador",
  director: "Diretoria",
  sales_manager: "Gerente de vendas",
  representative: "Representante",
  promoter: "Divulgador",
  finance: "Financeiro",
  operations_marketing: "Operações e marketing",
  legal_compliance: "Jurídico e compliance",
  auditor: "Auditoria",
};

export const APP_ROLES: AppRole[] = [
  "super_admin",
  "director",
  "sales_manager",
  "representative",
  "promoter",
  "finance",
  "operations_marketing",
  "legal_compliance",
  "auditor",
];

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    Object.hasOwn(APP_ROLE_LABELS, value)
  );
}

export type SystemAdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  roles: AppRole[];
  invitedAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
};
