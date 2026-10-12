import Link from "next/link";
import { redirect } from "next/navigation";
import TransferReviewActions from "./transfer-review-actions";
import { hasCrmRole } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS = {
  pending_manager: "Aguardando gerente",
  pending_director: "Aguardando diretoria",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

export default async function TransfersPage() {
  const supabase = await createClient();
  const [{ data: claimsData, error: claimsError }, { data: requests, error }] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase
        .from("crm_customer_transfer_requests")
        .select(
          "id, customer_id, requested_by, source_owner_user_id, target_owner_user_id, required_manager_user_id, status, reason, manager_decision, manager_decided_by, manager_decision_reason, created_at",
        )
        .in("status", ["pending_manager", "pending_director"])
        .order("created_at"),
    ]);
  if (claimsError) {
    console.error("Transfer queue session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }
  if (!claimsData?.claims) redirect("/login");
  if (error) {
    const migrationMissing =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message.includes("crm_customer_transfer_requests");
    console.error("Transfer queue loading failed.", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (migrationMissing) {
      return (
        <>
          <header className="app-topbar">
            <p className="topbar-context">
              Comercial / Transferências de carteira
            </p>
            <Link className="text-link" href="/dashboard/leads">
              Voltar à carteira
            </Link>
          </header>
          <section aria-labelledby="transfers-title" className="workspace">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">SGRC · Proteção da carteira</p>
                <h1 className="workspace-title" id="transfers-title">
                  Transferências para aprovar
                </h1>
              </div>
            </div>
            <p className="notice" role="alert">
              A estrutura de transferências ainda não está instalada no banco
              conectado. Aplique a migration{" "}
              <code>20261012192100_protected_customer_portfolio.sql</code> e
              atualize esta página.
            </p>
          </section>
        </>
      );
    }
    throw new Error("Não foi possível carregar as solicitações de transferência.");
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claimsData.claims.sub);
  if (rolesError) {
    console.error("Transfer queue role lookup failed.", {
      code: rolesError.code,
    });
    throw new Error("Não foi possível validar as permissões.");
  }
  if (!roles.some(({ role }) => hasCrmRole(role))) redirect("/dashboard");
  const hasReviewRole = roles.some(
    ({ role }) =>
      role === "sales_manager" ||
      role === "director" ||
      role === "super_admin",
  );
  if (!hasReviewRole) redirect("/dashboard");
  const canReviewDirector =
    claimsData.claims.aal === "aal2" &&
    roles.some(
      ({ role }) => role === "director" || role === "super_admin",
    );
  const reviewableRequests = requests.filter((request) => {
    if (request.status === "pending_manager") {
      return (
        request.required_manager_user_id === claimsData.claims.sub &&
        request.requested_by !== claimsData.claims.sub
      );
    }
    return (
      request.status === "pending_director" &&
      canReviewDirector &&
      request.requested_by !== claimsData.claims.sub &&
      request.manager_decided_by !== claimsData.claims.sub
    );
  });

  const customerIds = [...new Set(reviewableRequests.map((request) => request.customer_id))];
  const personIds = [
    ...new Set(
      reviewableRequests.flatMap((request) => [
        request.source_owner_user_id,
        request.target_owner_user_id,
        request.requested_by,
      ]),
    ),
  ];
  const [recordsResult, profilesResult] = await Promise.all([
    customerIds.length > 0
      ? supabase
          .from("crm_records")
          .select("id, name, trade_name")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    personIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recordsResult.error || profilesResult.error) {
    console.error("Transfer queue context loading failed.", {
      recordCode: recordsResult.error?.code,
      profileCode: profilesResult.error?.code,
    });
    throw new Error("Não foi possível carregar os dados das solicitações.");
  }
  const recordLabels = new Map(
    recordsResult.data.map((record) => [
      record.id,
      record.trade_name ? `${record.name} (${record.trade_name})` : record.name,
    ]),
  );
  const profileLabels = new Map(
    profilesResult.data.map((profile) => [
      profile.id,
      profile.display_name || `Usuário ${profile.id.slice(0, 8)}`,
    ]),
  );

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Comercial / Transferências de carteira</p>
        <Link className="text-link" href="/dashboard/leads">
          Voltar à carteira
        </Link>
      </header>
      <section aria-labelledby="transfers-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SGRC · Proteção da carteira</p>
            <h1 className="workspace-title" id="transfers-title">
              Transferências para aprovar
            </h1>
            <p className="workspace-description">
              Cada solicitação passa pelo gerente responsável e depois por um
              diretor independente.
            </p>
          </div>
        </div>

        {reviewableRequests.length > 0 ? (
          <div className="crm-transfer-list">
            {reviewableRequests.map((request) => (
              <article className="crm-transfer-card" key={request.id}>
                <div className="crm-timeline-heading">
                  <Link href={`/dashboard/leads/${request.customer_id}`}>
                    <strong>
                      {recordLabels.get(request.customer_id) ?? "Cadastro"}
                    </strong>
                  </Link>
                  <span className="crm-protection-badge">
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>
                <p>{request.reason}</p>
                <p className="field-help">
                  {profileLabels.get(request.source_owner_user_id) ?? "Responsável"}
                  {" → "}
                  {profileLabels.get(request.target_owner_user_id) ?? "Novo responsável"}
                  {" · Solicitada por "}
                  {profileLabels.get(request.requested_by) ?? "Usuário"}
                </p>
                {request.status === "pending_director" &&
                request.manager_decision === "approved" ? (
                  <p className="field-help">
                    Validada pelo gerente{" "}
                    {profileLabels.get(request.manager_decided_by ?? "") ?? ""}
                  </p>
                ) : null}
                <TransferReviewActions requestId={request.id} />
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            Não há solicitações aguardando sua aprovação.
          </p>
        )}
      </section>
    </>
  );
}
