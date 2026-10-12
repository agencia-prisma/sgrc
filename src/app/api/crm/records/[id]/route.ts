import { NextRequest, NextResponse } from "next/server";
import {
  isCrmRecordStatus,
  isValidBrazilianDocument,
  normalizeBrazilianDocument,
} from "@/lib/crm";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "Alterações estão desabilitadas fora do ambiente de produção." },
      { status: 503 },
    );
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }
  const authorization = await requireCrmAccess();
  if ("response" in authorization) return authorization.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "O cadastro solicitado é inválido." },
      { status: 400 },
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
      { error: "Os dados do cadastro são inválidos." },
      { status: 400 },
    );
  }
  const input = body as Record<string, unknown>;
  const { data: current, error: currentError } = await authorization.supabase
    .from("crm_records")
    .select("id, record_type, territory_id, owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (currentError) {
    console.error("CRM record lookup failed.", { code: currentError.code });
    return NextResponse.json(
      { error: "Não foi possível carregar o cadastro." },
      { status: 503 },
    );
  }
  if (!current) {
    return NextResponse.json(
      { error: "Cadastro não encontrado." },
      { status: 404 },
    );
  }

  const updates: {
    name?: string;
    trade_name?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    territory_id?: string | null;
    owner_user_id?: string;
    status?: "new" | "contacted" | "qualified" | "converted" | "lost";
  } = {};
  if ("name" in input) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 160) {
      return NextResponse.json(
        { error: "O nome deve ter entre 1 e 160 caracteres." },
        { status: 400 },
      );
    }
    updates.name = input.name.trim();
  }
  if ("tradeName" in input) {
    if (
      input.tradeName !== null &&
      typeof input.tradeName !== "string"
    ) {
      return NextResponse.json(
        { error: "O nome fantasia é inválido." },
        { status: 400 },
      );
    }
    const tradeName =
      typeof input.tradeName === "string" ? input.tradeName.trim() : "";
    if (
      tradeName.length > 160 ||
      (tradeName && current.record_type !== "company")
    ) {
      return NextResponse.json(
        { error: "O nome fantasia deve ter no máximo 160 caracteres." },
        { status: 400 },
      );
    }
    updates.trade_name = tradeName || null;
  }
  if ("document" in input) {
    if (input.document !== null && typeof input.document !== "string") {
      return NextResponse.json(
        { error: "O documento é inválido." },
        { status: 400 },
      );
    }
    const document =
      typeof input.document === "string"
        ? normalizeBrazilianDocument(input.document)
        : "";
    if (document && !isValidBrazilianDocument(document, current.record_type)) {
      return NextResponse.json(
        {
          error:
            current.record_type === "company"
              ? "Informe um CNPJ válido."
              : "Informe um CPF válido.",
        },
        { status: 400 },
      );
    }
    updates.document = document || null;
  }
  if ("email" in input) {
    if (input.email !== null && typeof input.email !== "string") {
      return NextResponse.json(
        { error: "O e-mail é inválido." },
        { status: 400 },
      );
    }
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
      return NextResponse.json(
        { error: "Informe um endereço de e-mail válido." },
        { status: 400 },
      );
    }
    updates.email = email || null;
  }
  if ("phone" in input) {
    if (input.phone !== null && typeof input.phone !== "string") {
      return NextResponse.json(
        { error: "O telefone é inválido." },
        { status: 400 },
      );
    }
    const phone = typeof input.phone === "string" ? input.phone.trim() : "";
    if (phone.length > 32) {
      return NextResponse.json(
        { error: "O telefone deve ter no máximo 32 caracteres." },
        { status: 400 },
      );
    }
    updates.phone = phone || null;
  }
  if ("notes" in input) {
    if (input.notes !== null && typeof input.notes !== "string") {
      return NextResponse.json(
        { error: "As observações são inválidas." },
        { status: 400 },
      );
    }
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (notes.length > 4000) {
      return NextResponse.json(
        { error: "As observações devem ter no máximo 4.000 caracteres." },
        { status: 400 },
      );
    }
    updates.notes = notes || null;
  }
  if ("status" in input) {
    if (!isCrmRecordStatus(input.status)) {
      return NextResponse.json(
        { error: "Selecione uma etapa válida." },
        { status: 400 },
      );
    }
    updates.status = input.status;
  }
  if ("ownerUserId" in input) {
    if (
      typeof input.ownerUserId !== "string" ||
      !UUID_PATTERN.test(input.ownerUserId)
    ) {
      return NextResponse.json(
        { error: "Selecione um responsável válido." },
        { status: 400 },
      );
    }
    updates.owner_user_id = input.ownerUserId;
  }
  if ("territoryId" in input) {
    if (
      input.territoryId !== null &&
      (typeof input.territoryId !== "string" ||
        !UUID_PATTERN.test(input.territoryId))
    ) {
      return NextResponse.json(
        { error: "Selecione um território válido." },
        { status: 400 },
      );
    }
    updates.territory_id =
      typeof input.territoryId === "string" && input.territoryId
        ? input.territoryId
        : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Nenhuma alteração válida foi enviada." },
      { status: 400 },
    );
  }

  const ownerUserId = updates.owner_user_id ?? current.owner_user_id;
  const territoryId =
    "territory_id" in updates
      ? updates.territory_id ?? null
      : current.territory_id;
  const assignmentChanged =
    ownerUserId !== current.owner_user_id ||
    territoryId !== current.territory_id;

  if (ownerUserId !== current.owner_user_id && ownerUserId !== authorization.userId) {
    const { data: owner, error: ownerError } =
      await authorization.supabase
        .from("commercial_team_members")
        .select("user_id")
        .eq("user_id", ownerUserId)
        .eq("is_active", true)
        .maybeSingle();
    if (ownerError) {
      console.error("CRM record owner validation failed.", {
        code: ownerError.code,
      });
      return NextResponse.json(
        { error: "Não foi possível validar o responsável selecionado." },
        { status: 503 },
      );
    }
    if (!owner) {
      return NextResponse.json(
        { error: "O responsável selecionado não está ativo na equipe comercial." },
        { status: 400 },
      );
    }
  }

  if (assignmentChanged && territoryId) {
    const { data: territory, error: territoryError } =
      await authorization.supabase
        .from("territories")
        .select("id")
        .eq("id", territoryId)
        .eq("is_active", true)
        .maybeSingle();
    if (territoryError) {
      console.error("CRM territory validation failed.", {
        code: territoryError.code,
      });
      return NextResponse.json(
        { error: "Não foi possível validar o território selecionado." },
        { status: 503 },
      );
    }
    if (!territory) {
      return NextResponse.json(
        { error: "O território selecionado não existe ou está inativo." },
        { status: 400 },
      );
    }
    const { data: assignment, error: assignmentError } =
      await authorization.supabase
        .from("commercial_team_territory_assignments")
        .select("user_id")
        .eq("user_id", ownerUserId)
        .eq("territory_id", territoryId)
        .maybeSingle();
    if (assignmentError) {
      console.error("CRM territory assignment validation failed.", {
        code: assignmentError.code,
      });
      return NextResponse.json(
        { error: "Não foi possível validar a atribuição do território." },
        { status: 503 },
      );
    }
    if (!assignment) {
      return NextResponse.json(
        { error: "O território não está atribuído ao responsável do cadastro." },
        { status: 400 },
      );
    }
  }
  if (assignmentChanged) {
    const { data: canManage, error: accessError } =
      await authorization.supabase.rpc("can_manage_crm_record", {
        target_owner_user_id: ownerUserId,
        target_territory_id: territoryId,
      });
    if (accessError) {
      console.error("CRM record reassignment validation failed.", {
        code: accessError.code,
      });
      return NextResponse.json(
        { error: "Não foi possível validar o responsável e o território." },
        { status: 503 },
      );
    }
    if (!canManage) {
      return NextResponse.json(
        {
          error:
            "Você não pode atribuir o cadastro a esse responsável ou território.",
        },
        { status: 403 },
      );
    }
  }

  const { error } = await authorization.supabase
    .from("crm_records")
    .update(updates)
    .eq("id", id);
  if (error) {
    console.error("CRM record update failed.", { code: error.code });
    const duplicateDocument = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicateDocument
          ? "Já existe um cadastro com esse CPF ou CNPJ."
          : "Não foi possível atualizar o cadastro. Confira os dados e tente novamente.",
      },
      { status: duplicateDocument ? 409 : 400 },
    );
  }
  return NextResponse.json({ message: "Cadastro atualizado." });
}
