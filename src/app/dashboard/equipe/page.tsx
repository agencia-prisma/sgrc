import Link from "next/link";
import { redirect } from "next/navigation";
import CreateTerritoryForm from "./create-territory-form";
import InviteMemberForm from "./invite-member-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function CommercialTeamPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("Commercial team page session validation failed.", {
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
    console.error("Commercial team page role lookup failed.", {
      code: rolesError.code,
    });
    throw new Error("Não foi possível validar as permissões.");
  }

  if (!roles?.some(({ role }) => role === "super_admin" || role === "director")) {
    redirect("/dashboard");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "A gestão da equipe requer a variável secreta SUPABASE_SERVICE_ROLE_KEY no servidor.",
    );
  }

  const admin = createAdminClient();
  const [
    membersResult,
    territoriesResult,
    assignmentsResult,
    memberRolesResult,
    profilesResult,
    usersResult,
  ] = await Promise.all([
    admin
      .from("commercial_team_members")
      .select("user_id, member_type, manager_user_id, is_active")
      .order("created_at", { ascending: false }),
    admin
      .from("territories")
      .select("id, name, code, parent_id, is_active")
      .order("name"),
    admin
      .from("commercial_team_territory_assignments")
      .select("user_id, territory_id"),
    admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "sales_manager"),
    admin.from("profiles").select("id, display_name"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (
    membersResult.error ||
    territoriesResult.error ||
    assignmentsResult.error ||
    memberRolesResult.error ||
    profilesResult.error ||
    usersResult.error
  ) {
    console.error("Commercial team data loading failed.", {
      codes: [
        membersResult.error?.code,
        territoriesResult.error?.code,
        assignmentsResult.error?.code,
        memberRolesResult.error?.code,
        profilesResult.error?.code,
        usersResult.error?.code,
      ].filter(Boolean),
    });
    throw new Error("Não foi possível carregar os dados da equipe comercial.");
  }

  const profilesById = new Map(
    profilesResult.data.map((profile) => [profile.id, profile.display_name]),
  );
  const usersById = new Map(
    usersResult.data.users.map((user) => [user.id, user.email ?? ""]),
  );
  const territoriesById = new Map(
    territoriesResult.data.map((territory) => [territory.id, territory]),
  );
  const territoryLabels = new Map(
    territoriesResult.data.map((territory) => [
      territory.id,
      territory.code ? `${territory.name} (${territory.code})` : territory.name,
    ]),
  );
  const managers = memberRolesResult.data
    .map(({ user_id }) => ({
      id: user_id,
      label:
        profilesById.get(user_id) ||
        usersById.get(user_id) ||
        `Gerente ${user_id.slice(0, 8)}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  const memberOptions = membersResult.data.map((member) => ({
    id: member.user_id,
    displayName:
      profilesById.get(member.user_id) ||
      usersById.get(member.user_id) ||
      `Usuário ${member.user_id.slice(0, 8)}`,
    email: usersById.get(member.user_id) ?? "",
    type:
      member.member_type === "representative" ? "Representante" : "Divulgador",
    manager:
      member.manager_user_id === null
        ? "Sem gerente"
        : profilesById.get(member.manager_user_id) ||
          usersById.get(member.manager_user_id) ||
          `Gerente ${member.manager_user_id.slice(0, 8)}`,
    territories: assignmentsResult.data
      .filter((assignment) => assignment.user_id === member.user_id)
      .map(
        (assignment) =>
        territoryLabels.get(assignment.territory_id) ?? "Território",
      ),
    active: member.is_active,
  }));
  const territoryOptions = territoriesResult.data
    .filter((territory) => territory.is_active)
    .map((territory) => ({
      id: territory.id,
      label: territory.code
        ? `${territory.name} (${territory.code})`
        : territory.name,
    }));

  return (
    <main className="page-shell">
      <section aria-labelledby="team-title" className="dashboard commercial-page">
        <div className="dashboard-card">
          <p className="brand">SGRC · Wax Brasil</p>
          <h1 className="title" id="team-title">
            Equipe comercial
          </h1>
          <p className="description">
            Cadastre territórios e convide representantes ou divulgadores.
          </p>

          <div className="commercial-grid">
            <section aria-labelledby="territory-form-title" className="subcard">
              <h2 className="section-title" id="territory-form-title">
                Novo território
              </h2>
              <CreateTerritoryForm territories={territoryOptions} />
            </section>

            <section aria-labelledby="member-form-title" className="subcard">
              <h2 className="section-title" id="member-form-title">
                Convidar membro
              </h2>
              <InviteMemberForm
                managers={managers}
                territories={territoryOptions}
              />
            </section>
          </div>

          <section aria-labelledby="territories-title" className="data-section">
            <h2 className="section-title" id="territories-title">
              Territórios cadastrados
            </h2>
            {territoriesResult.data.length > 0 ? (
              <ul className="data-list">
                {territoriesResult.data.map((territory) => (
                  <li key={territory.id}>
                    <span>
                      {territory.parent_id
                        ? `${territory.name} · ${territoriesById.get(territory.parent_id)?.name ?? "Território superior"}`
                        : territory.name}
                      {territory.code ? ` (${territory.code})` : ""}
                    </span>
                    <span className="status-label">
                      {territory.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">Ainda não há territórios cadastrados.</p>
            )}
          </section>

          <section aria-labelledby="members-title" className="data-section">
            <h2 className="section-title" id="members-title">
              Membros cadastrados
            </h2>
            {memberOptions.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Nome</th>
                      <th scope="col">E-mail</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Gerente</th>
                      <th scope="col">Territórios</th>
                      <th scope="col">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberOptions.map((member) => (
                      <tr key={member.id}>
                        <td>{member.displayName}</td>
                        <td>{member.email || "—"}</td>
                        <td>{member.type}</td>
                        <td>{member.manager}</td>
                        <td>
                          {member.territories.length > 0
                            ? member.territories.join(", ")
                            : "—"}
                        </td>
                        <td>{member.active ? "Ativo" : "Inativo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">
                Ainda não há representantes ou divulgadores cadastrados.
              </p>
            )}
          </section>

          <Link className="text-link back-link" href="/dashboard">
            Voltar ao painel
          </Link>
        </div>
      </section>
    </main>
  );
}
