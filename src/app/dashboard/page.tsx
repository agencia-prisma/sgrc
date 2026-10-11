import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("Supabase session validation failed in dashboard.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
      status: "status" in claimsError ? claimsError.status : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }

  if (!claimsData?.claims) {
    redirect("/login");
  }

  const { claims } = claimsData;
  const userId = claims.sub;
  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profileResult.error || rolesResult.error) {
    throw new Error("Não foi possível carregar o perfil de acesso do usuário.");
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  const displayName = profileResult.data?.display_name ?? email ?? "Usuário";

  return (
    <main className="page-shell">
      <section aria-labelledby="dashboard-title" className="dashboard">
        <div className="dashboard-card">
          <header className="dashboard-header">
            <div>
              <p className="brand">SGRC · Wax Brasil</p>
              <h1 className="title" id="dashboard-title">
                Acesso confirmado
              </h1>
            </div>
            <SignOutButton />
          </header>

          <p className="identity">
            {displayName}
            {email && displayName !== email ? ` · ${email}` : ""}
          </p>

          {rolesResult.data.length > 0 ? (
            <ul aria-label="Papéis atribuídos" className="role-list">
              {rolesResult.data.map(({ role }) => (
                <li className="role-badge" key={role}>
                  {role}
                </li>
              ))}
            </ul>
          ) : (
            <p className="notice" role="status">
              Sua conta foi autenticada, mas ainda não tem um papel atribuído.
              Peça ao administrador para concluir a configuração do acesso.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
