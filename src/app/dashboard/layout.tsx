import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import DashboardSidebar from "./dashboard-sidebar";
import { hasRequiredMfaRole } from "@/lib/auth/mfa";
import { hasCrmRole } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("Dashboard layout session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
      status: "status" in claimsError ? claimsError.status : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }

  if (!claimsData?.claims) {
    redirect("/login");
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claimsData.claims.sub);

  if (rolesError) {
    console.error("Dashboard layout role lookup failed.", {
      code: rolesError.code,
    });
    throw new Error("Não foi possível carregar as permissões de navegação.");
  }

  if (
    hasRequiredMfaRole(roles.map(({ role }) => role)) &&
    claimsData.claims.aal !== "aal2"
  ) {
    redirect("/auth/mfa");
  }

  const canManageTeam = roles.some(
    ({ role }) => role === "super_admin" || role === "director",
  );
  const canManageSystemUsers = roles.some(
    ({ role }) => role === "super_admin",
  );
  const canAccessCrm = roles.some(({ role }) => hasCrmRole(role));

  return (
    <main className="app-shell">
      <DashboardSidebar
        canAccessCrm={canAccessCrm}
        canManageSystemUsers={canManageSystemUsers}
        canManageTeam={canManageTeam}
      />
      <div className="app-main">{children}</div>
    </main>
  );
}
