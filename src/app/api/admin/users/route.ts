import { NextRequest, NextResponse } from "next/server";
import { isAppRole, type SystemAdminUser } from "@/lib/admin-users";
import { requireSystemAdmin } from "@/lib/auth/require-system-admin";
import {
  createAdminClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;

function getOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredOrigin) return request.nextUrl.origin;

  try {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported application URL protocol.");
    }
    return url.origin;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authorization = await requireSystemAdmin();
  if ("response" in authorization) return authorization.response;
  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "O gerenciamento de usuários não está configurado no servidor." },
      { status: 503 },
    );
  }

  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    return NextResponse.json(
      { error: "A página solicitada é inválida." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: usersResult, error: usersError } =
    await admin.auth.admin.listUsers({
      page: requestedPage,
      perPage: PAGE_SIZE,
    });

  if (usersError) {
    console.error("System user list lookup failed.", {
      name: usersError.name,
      status: "status" in usersError ? usersError.status : undefined,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os usuários." },
      { status: 503 },
    );
  }

  const userIds = usersResult.users.map(({ id }) => id);
  if (userIds.length === 0) {
    return NextResponse.json({
      users: [],
      page: requestedPage,
      hasMore: false,
    });
  }

  const [profilesResult, rolesResult] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", userIds),
    admin.from("user_roles").select("user_id, role").in("user_id", userIds),
  ]);

  if (profilesResult.error || rolesResult.error) {
    console.error("System user access list lookup failed.", {
      profileCode: profilesResult.error?.code,
      rolesCode: rolesResult.error?.code,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os papéis dos usuários." },
      { status: 503 },
    );
  }

  const profileNames = new Map(
    profilesResult.data.map((profile) => [profile.id, profile.display_name]),
  );
  const rolesByUser = new Map<string, SystemAdminUser["roles"]>();
  for (const { user_id: userId, role } of rolesResult.data) {
    const currentRoles = rolesByUser.get(userId) ?? [];
    currentRoles.push(role);
    rolesByUser.set(userId, currentRoles);
  }

  const users: SystemAdminUser[] = usersResult.users.map((user) => ({
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

  return NextResponse.json({
    users,
    page: requestedPage,
    hasMore: usersResult.users.length === PAGE_SIZE,
  });
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "Convites de usuários estão desabilitados fora da produção." },
      { status: 503 },
    );
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }

  const authorization = await requireSystemAdmin();
  if ("response" in authorization) return authorization.response;
  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "O envio de convites não está configurado no servidor." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "O conteúdo enviado não é um JSON válido." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Os dados do convite são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const displayName =
    typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Informe um endereço de e-mail válido." },
      { status: 400 },
    );
  }
  if (!displayName || displayName.length > 120) {
    return NextResponse.json(
      { error: "O nome deve ter entre 1 e 120 caracteres." },
      { status: 400 },
    );
  }
  if (!isAppRole(input.role)) {
    return NextResponse.json(
      { error: "Selecione um papel de acesso válido." },
      { status: 400 },
    );
  }

  const appOrigin = getOrigin(request);
  if (!appOrigin) {
    console.error("Configured application URL is invalid.");
    return NextResponse.json(
      { error: "A URL pública da aplicação não está configurada corretamente." },
      { status: 500 },
    );
  }

  const redirectTo = new URL("/auth/callback", appOrigin);
  redirectTo.searchParams.set("next", "/auth/update-password");
  const admin = createAdminClient();
  const { data: invitation, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo: redirectTo.toString(),
    });

  if (inviteError || !invitation.user) {
    console.error("System user invitation failed.", {
      name: inviteError?.name,
      code:
        inviteError && "code" in inviteError ? inviteError.code : undefined,
    });
    const isExistingUser =
      inviteError && "code" in inviteError
        ? inviteError.code === "email_exists" ||
          inviteError.code === "user_already_exists"
        : false;
    return NextResponse.json(
      {
        error: isExistingUser
          ? "Este e-mail já possui uma conta. Localize o usuário na lista e atribua o papel por lá."
          : "Não foi possível enviar o convite. Tente novamente mais tarde.",
      },
      { status: isExistingUser ? 409 : 502 },
    );
  }

  const { error: roleError } = await admin.rpc("admin_assign_user_role", {
    target_user_id: invitation.user.id,
    target_role: input.role,
    target_display_name: displayName,
    assigned_by_user_id: authorization.userId,
  });

  if (roleError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(
      invitation.user.id,
    );
    console.error("System user role assignment failed after invitation.", {
      code: roleError.code,
      cleanupStatus:
        cleanupError && "status" in cleanupError
          ? cleanupError.status
          : undefined,
    });
    return NextResponse.json(
      {
        error: cleanupError
          ? "O convite foi enviado, mas não foi possível atribuir o papel nem remover a conta provisória. Não reenvie; contate outro super administrador."
          : "Não foi possível atribuir o papel. A conta provisória foi removida; corrija o problema antes de enviar outro convite.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      message: "Convite enviado e papel de acesso atribuído.",
      user: {
        id: invitation.user.id,
        email: invitation.user.email ?? email,
        displayName,
        roles: [input.role],
        invitedAt: invitation.user.invited_at ?? new Date().toISOString(),
        lastSignInAt: invitation.user.last_sign_in_at ?? null,
        bannedUntil: null,
      } satisfies SystemAdminUser,
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "A gestão de acessos está desabilitada fora da produção." },
      { status: 503 },
    );
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }

  const authorization = await requireSystemAdmin();
  if ("response" in authorization) return authorization.response;
  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "A gestão de acessos não está configurada no servidor." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "O conteúdo enviado não é um JSON válido." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Os dados do acesso são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.userId !== "string" ||
    !UUID_PATTERN.test(input.userId) ||
    (input.operation !== "assign" && input.operation !== "remove") ||
    !isAppRole(input.role)
  ) {
    return NextResponse.json(
      { error: "Informe um usuário, uma ação e um papel válidos." },
      { status: 400 },
    );
  }

  if (
    input.operation === "remove" &&
    input.userId === authorization.userId &&
    input.role === "super_admin"
  ) {
    return NextResponse.json(
      { error: "Não é possível remover seu próprio papel de super administrador." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();
  if (input.operation === "assign") {
    const { error } = await admin.rpc("admin_assign_user_role", {
      target_user_id: input.userId,
      target_role: input.role,
      target_display_name: null,
      assigned_by_user_id: authorization.userId,
    });
    if (error) {
      console.error("System user role assignment failed.", {
        code: error.code,
      });
      return NextResponse.json(
        { error: "Não foi possível atribuir o papel ao usuário." },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: "Papel atribuído ao usuário." });
  }

  const { data: removed, error } = await admin.rpc("admin_remove_user_role", {
    target_user_id: input.userId,
    target_role: input.role,
  });
  if (error) {
    console.error("System user role removal failed.", { code: error.code });
    return NextResponse.json(
      {
        error:
          input.role === "super_admin"
            ? "Não é possível remover o último super administrador."
            : "Não foi possível remover o papel do usuário.",
      },
      { status: 409 },
    );
  }
  if (!removed) {
    return NextResponse.json(
      { error: "O usuário não possui esse papel de acesso." },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: "Papel removido do usuário." });
}
