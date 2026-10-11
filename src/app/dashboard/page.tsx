import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

function DashboardIcon({ name }: { name: "home" | "team" | "clients" | "orders" | "reports" }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </>
    ),
    team: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    clients: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    orders: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" />
      </>
    ),
    reports: (
      <>
        <path d="M4 19V5M4 19h17" />
        <path d="m7 15 4-4 3 2 6-7" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="18"
    >
      {paths[name]}
    </svg>
  );
}

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

  return (
    <main className="app-shell">
      <aside aria-label="Navegação principal" className="app-sidebar">
        <Link aria-label="SGRC, página inicial" className="sidebar-brand" href="/dashboard">
          <span aria-hidden="true" className="brand-mark">S</span>
          <span>
            <strong>SGRC</strong>
            <small>Gestão comercial</small>
          </span>
        </Link>

        <nav className="sidebar-nav">
          <p className="nav-group-label">Início</p>
          <Link aria-current="page" className="nav-item is-active" href="/dashboard">
            <DashboardIcon name="home" />
            <span>Visão geral</span>
          </Link>

          <p className="nav-group-label">Comercial</p>
          {canManageTeam ? (
            <Link className="nav-item" href="/dashboard/equipe">
              <DashboardIcon name="team" />
              <span>Equipe e territórios</span>
            </Link>
          ) : null}
          <span aria-disabled="true" className="nav-item is-unavailable">
            <DashboardIcon name="clients" />
            <span>Leads e clientes</span>
            <small>Em breve</small>
          </span>
          <span aria-disabled="true" className="nav-item is-unavailable">
            <DashboardIcon name="orders" />
            <span>Pedidos</span>
            <small>Em breve</small>
          </span>

          <p className="nav-group-label">Acompanhamento</p>
          <span aria-disabled="true" className="nav-item is-unavailable">
            <DashboardIcon name="reports" />
            <span>Metas e resultados</span>
            <small>Em breve</small>
          </span>
        </nav>

        <div className="sidebar-footer">
          <span>SGRC</span>
          <span>Gestão em construção</span>
        </div>
      </aside>

      <div className="app-main">
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
      </div>
    </main>
  );
}
