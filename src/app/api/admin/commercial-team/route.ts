import { NextRequest, NextResponse } from "next/server";
import { requireCommercialAdmin } from "@/lib/auth/require-commercial-admin";
import {
  createAdminClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "Convites estão desabilitados fora do ambiente de produção." },
      { status: 503 },
    );
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }

  const authorization = await requireCommercialAdmin();
  if ("response" in authorization) {
    return authorization.response;
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
  const memberType = input.memberType;
  if (
    input.managerUserId !== undefined &&
    input.managerUserId !== null &&
    typeof input.managerUserId !== "string"
  ) {
    return NextResponse.json(
      { error: "Selecione um gerente de vendas válido." },
      { status: 400 },
    );
  }
  const managerUserId =
    typeof input.managerUserId === "string" && input.managerUserId
      ? input.managerUserId
      : null;
  const territoryIds = input.territoryIds;

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

  if (memberType !== "representative" && memberType !== "promoter") {
    return NextResponse.json(
      { error: "Selecione um tipo de membro comercial válido." },
      { status: 400 },
    );
  }

  if (
    managerUserId !== null &&
    !UUID_PATTERN.test(managerUserId)
  ) {
    return NextResponse.json(
      { error: "Selecione um gerente de vendas válido." },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(territoryIds) ||
    territoryIds.length > 50 ||
    territoryIds.some(
      (id) => typeof id !== "string" || !UUID_PATTERN.test(id),
    ) ||
    new Set(territoryIds).size !== territoryIds.length
  ) {
    return NextResponse.json(
      { error: "A lista de territórios selecionada é inválida." },
      { status: 400 },
    );
  }

  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "O serviço de convites ainda não está configurado no servidor." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  if (managerUserId) {
    const { data: managerRole, error: managerError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", managerUserId)
      .eq("role", "sales_manager")
      .maybeSingle();

    if (managerError) {
      console.error("Commercial manager role lookup failed.", {
        code: managerError.code,
      });
      return NextResponse.json(
        { error: "Não foi possível validar o gerente selecionado." },
        { status: 503 },
      );
    }

    if (!managerRole) {
      return NextResponse.json(
        { error: "O gerente selecionado não possui o papel de gerente de vendas." },
        { status: 400 },
      );
    }
  }

  if (territoryIds.length > 0) {
    const { data: territories, error: territoriesError } = await admin
      .from("territories")
      .select("id")
      .in("id", territoryIds)
      .eq("is_active", true);

    if (territoriesError) {
      console.error("Commercial territory validation failed.", {
        code: territoriesError.code,
      });
      return NextResponse.json(
        { error: "Não foi possível validar os territórios selecionados." },
        { status: 503 },
      );
    }

    if (territories.length !== territoryIds.length) {
      return NextResponse.json(
        { error: "Um ou mais territórios não existem ou estão inativos." },
        { status: 400 },
      );
    }
  }

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
  let redirectTo: string;

  try {
    const redirectUrl = new URL("/auth/callback", appOrigin);
    redirectUrl.searchParams.set("next", "/auth/update-password");
    redirectTo = redirectUrl.toString();
  } catch {
    console.error("Configured application URL is invalid.");
    return NextResponse.json(
      { error: "A URL pública da aplicação não está configurada corretamente." },
      { status: 500 },
    );
  }

  const { data: invitation, error: invitationError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo,
    });

  if (invitationError || !invitation.user) {
    console.error("Commercial team invitation failed.", {
      name: invitationError?.name,
      code:
        invitationError && "code" in invitationError
          ? invitationError.code
          : undefined,
      status:
        invitationError && "status" in invitationError
          ? invitationError.status
          : undefined,
    });
    const isExistingUser =
      invitationError && "code" in invitationError
        ? invitationError.code === "email_exists" ||
          invitationError.code === "user_already_exists"
        : false;
    return NextResponse.json(
      {
        error: isExistingUser
          ? "Este e-mail já possui uma conta. O convite de nova conta não pode ser usado para associá-la; peça ao administrador para concluir essa associação."
          : "Não foi possível enviar o convite. Tente novamente mais tarde.",
      },
      { status: isExistingUser ? 409 : 502 },
    );
  }

  const { error: provisioningError } = await admin.rpc(
    "create_commercial_team_member",
    {
      target_user_id: invitation.user.id,
      target_member_type: memberType,
      target_display_name: displayName,
      target_manager_user_id: managerUserId,
      target_territory_ids: territoryIds,
      assigned_by_user_id: authorization.userId,
    },
  );

  if (provisioningError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(
      invitation.user.id,
    );
    console.error("Commercial team provisioning failed after invitation.", {
      code: provisioningError.code,
      cleanupCode: cleanupError?.status,
    });
    return NextResponse.json(
      {
        error: cleanupError
          ? "O convite foi enviado, mas o cadastro comercial falhou e a conta provisória não pôde ser removida. Não reenvie o convite; peça ao administrador para corrigir o cadastro."
          : "Não foi possível concluir o cadastro comercial. A conta provisória foi removida e o link enviado não é mais válido. Corrija o problema antes de enviar outro convite.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { message: "Convite enviado e membro comercial cadastrado." },
    { status: 201 },
  );
}
