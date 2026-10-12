import { redirect } from "next/navigation";
import Link from "next/link";
import { hasCrmRole } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";
import DashboardIcon from "./dashboard-icon";
import SignOutButton from "./sign-out-button";

const roleLabels: Record<string, string> = {
  super_admin: "Administrador do sistema",
  director: "Diretoria",
  sales_manager: "Gerente de vendas",
  representative: "Representante",
  promoter: "Divulgador",
  finance: "Financeiro",
  operations_marketing: "Operações e marketing",
  legal_compliance: "Jurídico e compliance",
  auditor: "Auditoria",
};

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
  const greetingBase = (
    profileResult.data?.display_name?.trim() ||
    email?.split("@")[0]?.split(/[._-]/)[0] ||
    "Usuário"
  ).split(/\s+/)[0];
  const firstName =
    greetingBase.charAt(0).toLocaleUpperCase("pt-BR") + greetingBase.slice(1);
  const roleNames = rolesResult.data.map(
    ({ role }) => roleLabels[role] ?? role,
  );
  const canManageTeam = rolesResult.data.some(
    ({ role }) => role === "super_admin" || role === "director",
  );
  const canAccessCrm = rolesResult.data.some(({ role }) => hasCrmRole(role));

  return (
    <>
      <header className="app-topbar">
          <p className="topbar-context">Central de gestão</p>
          <div className="account-menu">
            <div className="account-copy">
              <strong>{displayName}</strong>
              <span>{roleNames.length > 0 ? roleNames.join(" · ") : "Acesso pendente"}</span>
            </div>
            <SignOutButton />
          </div>
      </header>

        <section aria-labelledby="dashboard-title" className="workspace">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">SGRC · Wax Brasil</p>
              <h1 className="workspace-title" id="dashboard-title">
                Olá, {firstName}
              </h1>
              <p className="workspace-description">
                Acesse os módulos de gestão disponíveis para o seu perfil.
              </p>
            </div>
            <span className="workspace-status">
              <span aria-hidden="true" />
              Sessão autenticada
            </span>
          </div>

          {rolesResult.data.length === 0 ? (
            <p className="notice role-warning" role="status">
              Sua conta foi autenticada, mas ainda não tem um papel atribuído.
              Peça ao administrador para concluir a configuração do acesso.
            </p>
          ) : null}

          <section aria-labelledby="modules-title" className="module-section">
            <div className="section-heading">
              <div>
                <h2 className="section-title" id="modules-title">
                  Módulos do sistema
                </h2>
                <p>As áreas serão liberadas conforme o sistema evoluir.</p>
              </div>
            </div>

            <div className="module-grid">
              {canManageTeam ? (
                <Link className="module-card module-card-ready" href="/dashboard/equipe">
                  <span className="module-icon module-icon-purple">
                    <DashboardIcon name="team" />
                  </span>
                  <span className="module-card-copy">
                    <strong>Equipe e territórios</strong>
                    <span>Gerencie a estrutura da equipe comercial.</span>
                  </span>
                  <span aria-hidden="true" className="module-arrow">→</span>
                  <span className="module-status status-ready">Disponível</span>
                </Link>
              ) : null}

              {canAccessCrm ? (
                <Link className="module-card module-card-ready" href="/dashboard/leads">
                  <span className="module-icon module-icon-blue">
                    <DashboardIcon name="clients" />
                  </span>
                  <span className="module-card-copy">
                    <strong>Leads e clientes</strong>
                    <span>Gerencie empresas, pessoas e oportunidades.</span>
                  </span>
                  <span aria-hidden="true" className="module-arrow">→</span>
                  <span className="module-status status-ready">Disponível</span>
                </Link>
              ) : null}

              <div aria-disabled="true" className="module-card module-card-soon">
                <span className="module-icon module-icon-blue">
                  <DashboardIcon name="clients" />
                </span>
                <span className="module-card-copy">
                  <strong>Leads e clientes</strong>
                  <span>Relacionamento, carteira e oportunidades.</span>
                </span>
                <span className="module-status">Em desenvolvimento</span>
              </div>

              <div aria-disabled="true" className="module-card module-card-soon">
                <span className="module-icon module-icon-green">
                  <DashboardIcon name="orders" />
                </span>
                <span className="module-card-copy">
                  <strong>Pedidos e aprovações</strong>
                  <span>Fluxos comerciais e acompanhamento de pedidos.</span>
                </span>
                <span className="module-status">Em desenvolvimento</span>
              </div>

              <div aria-disabled="true" className="module-card module-card-soon">
                <span className="module-icon module-icon-amber">
                  <DashboardIcon name="reports" />
                </span>
                <span className="module-card-copy">
                  <strong>Metas e resultados</strong>
                  <span>Indicadores e relatórios serão adicionados depois.</span>
                </span>
                <span className="module-status">Em desenvolvimento</span>
              </div>
            </div>
          </section>
        </section>
    </>
  );
}
