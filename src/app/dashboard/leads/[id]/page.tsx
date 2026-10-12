import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AddInteractionForm from "../add-interaction-form";
import RecordEditForm from "../record-edit-form";
import {
  CRM_INTERACTION_LABELS,
  CRM_STATUS_LABELS,
  CRM_TYPE_LABELS,
  hasCrmRole,
} from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

export default async function CrmRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, supabase] = await Promise.all([params, createClient()]);
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError) {
    console.error("CRM detail session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }
  if (!claimsData?.claims) redirect("/login");

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claimsData.claims.sub);
  if (rolesError) {
    console.error("CRM detail role lookup failed.", { code: rolesError.code });
    throw new Error("Não foi possível validar as permissões.");
  }
  if (!roles.some(({ role }) => hasCrmRole(role))) redirect("/dashboard");

  const { data: record, error: recordError } = await supabase
    .from("crm_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (recordError) {
    console.error("CRM record loading failed.", { code: recordError.code });
    throw new Error("Não foi possível carregar o cadastro.");
  }
  if (!record) notFound();

  const [territoriesResult, interactionsResult, membersResult] = await Promise.all([
    supabase
      .from("territories")
      .select("id, name, code, is_active")
      .order("name"),
    supabase
      .from("crm_interactions")
      .select("id, interaction_type, summary, details, occurred_at, created_by")
      .eq("record_id", id)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("commercial_team_members")
      .select("user_id, is_active")
      .eq("is_active", true)
      .order("created_at"),
  ]);
  if (
    territoriesResult.error ||
    interactionsResult.error ||
    membersResult.error
  ) {
    console.error("CRM detail data loading failed.", {
      codes: [
        territoriesResult.error?.code,
        interactionsResult.error?.code,
        membersResult.error?.code,
      ].filter(Boolean),
    });
    throw new Error("Não foi possível carregar o histórico do cadastro.");
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name");
  if (profilesError) {
    console.error("CRM user label lookup failed.", { code: profilesError.code });
    throw new Error("Não foi possível carregar os responsáveis do cadastro.");
  }
  const profileLabels = new Map(
    profiles.map((profile) => [
      profile.id,
      profile.display_name || `Usuário ${profile.id.slice(0, 8)}`,
    ]),
  );
  const territoryLabels = new Map(
    territoriesResult.data.map((territory) => [
      territory.id,
      territory.code
        ? `${territory.name} (${territory.code})`
        : territory.name,
    ]),
  );
  const territoryOptions = territoriesResult.data.map((territory) => ({
    id: territory.id,
    label: territory.code
      ? `${territory.name} (${territory.code})`
      : territory.name,
    isActive: territory.is_active,
  }));
  const ownerIds = new Set([
    claimsData.claims.sub,
    record.owner_user_id,
    ...membersResult.data.map((member) => member.user_id),
  ]);
  const owners = [...ownerIds].map((id) => ({
    id,
    label:
      profileLabels.get(id) ||
      (id === claimsData.claims.sub ? "Eu" : `Usuário ${id.slice(0, 8)}`),
    isActive:
      id === claimsData.claims.sub ||
      membersResult.data.some((member) => member.user_id === id),
  }));

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Comercial / Leads e clientes</p>
        <Link className="text-link" href="/dashboard/leads">
          Voltar à carteira
        </Link>
      </header>
      <section aria-labelledby="crm-record-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">{CRM_TYPE_LABELS[record.record_type]}</p>
            <h1 className="workspace-title" id="crm-record-title">
              {record.name}
            </h1>
            {record.trade_name ? (
              <p className="workspace-description">{record.trade_name}</p>
            ) : null}
          </div>
          <span className={`crm-status crm-status-${record.status}`}>
            {CRM_STATUS_LABELS[record.status]}
          </span>
        </div>

        <section aria-labelledby="crm-edit-title" className="module-section crm-section">
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="crm-edit-title">
                Dados do cadastro
              </h2>
              <p>
                Responsável: {profileLabels.get(record.owner_user_id) ?? "—"}
                {record.territory_id
                  ? ` · Território: ${territoryLabels.get(record.territory_id) ?? "—"}`
                  : ""}
              </p>
            </div>
          </div>
          <RecordEditForm
            id={record.id}
            record={record}
            owners={owners}
            territories={territoryOptions}
          />
        </section>

        <section
          aria-labelledby="crm-interactions-title"
          className="module-section crm-section"
        >
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="crm-interactions-title">
                Histórico de contatos
              </h2>
              <p>
                {interactionsResult.data.length === 200
                  ? "Mostrando os 200 contatos mais recentes."
                  : `${interactionsResult.data.length} contato(s) registrado(s).`}
              </p>
            </div>
          </div>
          <AddInteractionForm recordId={record.id} />
          {interactionsResult.data.length > 0 ? (
            <ol className="crm-timeline">
              {interactionsResult.data.map((interaction) => (
                <li key={interaction.id}>
                  <div className="crm-timeline-heading">
                    <strong>
                      {CRM_INTERACTION_LABELS[interaction.interaction_type]} ·{" "}
                      {interaction.summary}
                    </strong>
                    <time dateTime={interaction.occurred_at}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(interaction.occurred_at))}
                    </time>
                  </div>
                  {interaction.details ? <p>{interaction.details}</p> : null}
                  <small>
                    Registrado por{" "}
                    {profileLabels.get(interaction.created_by) ?? "Usuário"}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-state">
              Ainda não há contatos registrados para este cadastro.
            </p>
          )}
        </section>
      </section>
    </>
  );
}
