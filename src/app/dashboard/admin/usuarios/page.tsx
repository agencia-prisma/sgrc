import { redirect } from "next/navigation";
import {
  APP_ROLE_LABELS,
  type SystemAdminUser,
} from "@/lib/admin-users";
import { createAdminClient, hasSupabaseServiceRoleKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import UsersManager from "./users-manager";

const PAGE_SIZE = 50;

export default async function SystemUsersPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError) {
    console.error("System users page session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }
  if (!claimsData?.claims) redirect("/login");

  const userId = claimsData.claims.sub;
  const { data: adminRole, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (roleError) {
    console.error("System users page role lookup failed.", {
      code: roleError.code,
    });
    throw new Error("Não foi possível validar as permissões.");
  }
  if (!adminRole) redirect("/dashboard");

  if (!hasSupabaseServiceRoleKey()) {
    return (
      <>
        <header className="app-topbar">
          <p className="topbar-context">Administração / Usuários</p>
        </header>
        <section aria-labelledby="system-users-title" className="workspace">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">SGRC · Administração do sistema</p>
              <h1 className="workspace-title" id="system-users-title">
                Usuários, papéis e acessos
              </h1>
            </div>
          </div>
          <p className="notice" role="alert">
            O gerenciamento de usuários requer a chave de serviço do Supabase
            configurada exclusivamente no servidor.
          </p>
        </section>
      </>
    );
  }

  const admin = createAdminClient();
  const { data: authUsersResult, error: authUsersError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: PAGE_SIZE });
  if (authUsersError) {
    console.error("System users initial list failed.", {
      name: authUsersError.name,
      status:
        "status" in authUsersError ? authUsersError.status : undefined,
    });
    throw new Error("Não foi possível carregar os usuários.");
  }

  const userIds = authUsersResult.users.map(({ id }) => id);
  const [profilesResult, rolesResult] =
    userIds.length > 0
      ? await Promise.all([
          admin.from("profiles").select("id, display_name").in("id", userIds),
          admin.from("user_roles").select("user_id, role").in("user_id", userIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (profilesResult.error || rolesResult.error) {
    console.error("System users initial access list failed.", {
      profileCode: profilesResult.error?.code,
      rolesCode: rolesResult.error?.code,
    });
    throw new Error("Não foi possível carregar os papéis dos usuários.");
  }

  const profileNames = new Map(
    profilesResult.data.map((profile) => [profile.id, profile.display_name]),
  );
  const rolesByUser = new Map<string, SystemAdminUser["roles"]>();
  for (const { user_id: roleUserId, role } of rolesResult.data) {
    rolesByUser.set(roleUserId, [
      ...(rolesByUser.get(roleUserId) ?? []),
      role,
    ]);
  }

  const users: SystemAdminUser[] = authUsersResult.users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    displayName:
      profileNames.get(user.id) ??
      (typeof user.user_metadata.display_name === "string"
        ? user.user_metadata.display_name
        : null),
    roles: rolesByUser.get(user.id) ?? [],
    invitedAt: user.invited_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    bannedUntil: user.banned_until ?? null,
  }));

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Administração / Usuários</p>
      </header>
      <section aria-labelledby="system-users-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SGRC · Administração do sistema</p>
            <h1 className="workspace-title" id="system-users-title">
              Usuários, papéis e acessos
            </h1>
            <p className="workspace-description">
              Convide usuários, acompanhe as contas e controle os papéis que
              liberam cada módulo.
            </p>
          </div>
        </div>
        <UsersManager
          currentUserId={userId}
          initialHasMore={authUsersResult.users.length === PAGE_SIZE}
          initialUsers={users}
          roleLabels={APP_ROLE_LABELS}
        />
      </section>
    </>
  );
}
