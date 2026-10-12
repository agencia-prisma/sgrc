import Link from "next/link";
import { redirect } from "next/navigation";
import NewRecordForm from "./new-record-form";
import RecordFilters, {
  isCrmStatusFilter,
  isCrmTypeFilter,
} from "./record-filters";
import {
  CRM_STATUS_LABELS,
  CRM_TYPE_LABELS,
  hasCrmRole,
} from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

type LeadsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
  }>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const supabase = await createClient();
  const [{ data: claimsData, error: claimsError }, filters] = await Promise.all([
    supabase.auth.getClaims(),
    searchParams,
  ]);
  if (claimsError) {
    console.error("CRM page session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }
  if (!claimsData?.claims) redirect("/login");

  const userId = claimsData.claims.sub;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) {
    console.error("CRM page role lookup failed.", { code: rolesError.code });
    throw new Error("Não foi possível validar as permissões.");
  }
  if (!roles.some(({ role }) => hasCrmRole(role))) {
    redirect("/dashboard");
  }

  const queryText = filters.q?.trim().slice(0, 100) ?? "";
  const statusFilter =
    filters.status && isCrmStatusFilter(filters.status)
      ? filters.status
      : "";
  const typeFilter =
    filters.type && isCrmTypeFilter(filters.type) ? filters.type : "";

  let recordsQuery = supabase
    .from("crm_records")
    .select(
      "id, record_type, name, trade_name, document, email, phone, status, territory_id, owner_user_id, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (statusFilter) {
    recordsQuery = recordsQuery.eq("status", statusFilter);
  }
  if (typeFilter) {
    recordsQuery = recordsQuery.eq("record_type", typeFilter);
  }
  if (queryText) {
    const escapedQuery = queryText.replace(/[\\%_]/g, "\\$&");
    recordsQuery = recordsQuery.ilike("name", `%${escapedQuery}%`);
  }

  const [recordsResult, territoriesResult, membersResult, profilesResult] =
    await Promise.all([
      recordsQuery,
      supabase
        .from("territories")
        .select("id, name, code, is_active")
        .order("name"),
      supabase
        .from("commercial_team_members")
        .select("user_id, manager_user_id, is_active")
        .eq("is_active", true)
        .order("created_at"),
      supabase.from("profiles").select("id, display_name"),
    ]);
  if (
    recordsResult.error ||
    territoriesResult.error ||
    membersResult.error ||
    profilesResult.error
  ) {
    console.error("CRM page data loading failed.", {
      recordsCode: recordsResult.error?.code,
      territoriesCode: territoriesResult.error?.code,
      membersCode: membersResult.error?.code,
      profilesCode: profilesResult.error?.code,
    });
    const crmSchemaNotInstalled =
      recordsResult.error?.code === "PGRST205" ||
      recordsResult.error?.code === "42P01";

    if (crmSchemaNotInstalled) {
      return (
        <>
          <header className="app-topbar">
            <p className="topbar-context">Comercial / Leads e clientes</p>
            <Link className="text-link" href="/dashboard">
              Voltar ao painel
            </Link>
          </header>
          <section aria-labelledby="crm-title" className="workspace">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">SGRC · Gestão comercial</p>
                <h1 className="workspace-title" id="crm-title">
                  Leads e clientes
                </h1>
              </div>
            </div>
            <p className="notice" role="alert">
              A estrutura do módulo ainda não está instalada neste banco.
              Aplique a migration{" "}
              <code>20261011230000_crm_leads_and_customers.sql</code> no projeto
              Supabase vinculado e atualize esta página.
            </p>
          </section>
        </>
      );
    }

    throw new Error("Não foi possível carregar os cadastros comerciais.");
  }

  const profileLabels = new Map(
    profilesResult.data.map((profile) => [
      profile.id,
      profile.display_name || `Usuário ${profile.id.slice(0, 8)}`,
    ]),
  );
  const territories = territoriesResult.data
    .filter((territory) => territory.is_active)
    .map((territory) => ({
      id: territory.id,
      label: territory.code
        ? `${territory.name} (${territory.code})`
        : territory.name,
    }));
  const territoryLabels = new Map(
    territoriesResult.data.map((territory) => [
      territory.id,
      territory.code ? `${territory.name} (${territory.code})` : territory.name,
    ]),
  );
  const ownerIds = new Set([userId]);
  for (const member of membersResult.data) {
    const isVisibleOwner =
      roles.some(({ role }) => role === "super_admin" || role === "director") ||
      (roles.some(({ role }) => role === "sales_manager") &&
        member.manager_user_id === userId);
    if (isVisibleOwner) ownerIds.add(member.user_id);
  }
  const owners = [...ownerIds].map((id) => ({
    id,
    label:
      profileLabels.get(id) ||
      (id === userId ? "Eu" : `Usuário ${id.slice(0, 8)}`),
  }));

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Comercial / Leads e clientes</p>
        <Link className="text-link" href="/dashboard">
          Voltar ao painel
        </Link>
      </header>

      <section aria-labelledby="crm-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SGRC · Gestão comercial</p>
            <h1 className="workspace-title" id="crm-title">
              Leads e clientes
            </h1>
            <p className="workspace-description">
              Organize empresas e pessoas, acompanhe contatos e avance cada
              oportunidade.
            </p>
          </div>
        </div>

        <section aria-labelledby="new-crm-title" className="module-section crm-section">
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="new-crm-title">
                Novo cadastro
              </h2>
              <p>Os campos de documento são validados e não podem se repetir.</p>
            </div>
          </div>
          <NewRecordForm
            currentUserId={userId}
            owners={owners}
            territories={territories}
          />
        </section>

        <section
          aria-labelledby="crm-records-title"
          className="module-section crm-section"
        >
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="crm-records-title">
                Carteira comercial
              </h2>
              <p>
                {recordsResult.data.length === 500
                  ? "Mostrando até 500 cadastros. Use os filtros para refinar."
                  : `${recordsResult.data.length} cadastro(s) encontrado(s).`}
              </p>
            </div>
          </div>
          <RecordFilters
            recordType={typeFilter}
            search={queryText}
            status={statusFilter}
          />
          {recordsResult.data.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table crm-table">
                <thead>
                  <tr>
                    <th scope="col">Cadastro</th>
                    <th scope="col">Documento</th>
                    <th scope="col">Contato</th>
                    <th scope="col">Território</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsResult.data.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <Link
                          className="crm-record-link"
                          href={`/dashboard/leads/${record.id}`}
                        >
                          <strong>{record.name}</strong>
                          {record.trade_name ? (
                            <span>{record.trade_name}</span>
                          ) : null}
                          <small>{CRM_TYPE_LABELS[record.record_type]}</small>
                        </Link>
                      </td>
                      <td>{record.document || "—"}</td>
                      <td>
                        {record.email || record.phone ? (
                          <span className="crm-contact-cell">
                            {record.email ? <span>{record.email}</span> : null}
                            {record.phone ? <span>{record.phone}</span> : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {record.territory_id
                          ? territoryLabels.get(record.territory_id) ?? "—"
                          : "—"}
                      </td>
                      <td>{profileLabels.get(record.owner_user_id) ?? "—"}</td>
                      <td>
                        <span className={`crm-status crm-status-${record.status}`}>
                          {CRM_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">
              {queryText || statusFilter || typeFilter
                ? "Nenhum cadastro corresponde aos filtros."
                : "Ainda não há leads ou clientes. Use o formulário acima para cadastrar o primeiro."}
            </p>
          )}
        </section>
      </section>
    </>
  );
}
