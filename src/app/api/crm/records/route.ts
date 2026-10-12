import { NextRequest, NextResponse } from "next/server";
import {
  isCrmRecordType,
  isValidBrazilianDocument,
  normalizeBrazilianDocument,
} from "@/lib/crm";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mutationDisabled() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production";
}

function isSameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (mutationDisabled()) {
    return NextResponse.json(
      { error: "Cadastros estão desabilitados fora do ambiente de produção." },
      { status: 503 },
    );
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }

  const authorization = await requireCrmAccess();
  if ("response" in authorization) return authorization.response;

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
  for (const field of [
    "tradeName",
    "document",
    "email",
    "phone",
    "notes",
  ]) {
    if (
      input[field] !== undefined &&
      input[field] !== null &&
      typeof input[field] !== "string"
    ) {
      return NextResponse.json(
        { error: "Um ou mais campos de texto são inválidos." },
        { status: 400 },
      );
    }
  }
  const recordType = input.recordType;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const tradeName =
    typeof input.tradeName === "string" && input.tradeName.trim()
      ? input.tradeName.trim()
      : null;
  const document =
    typeof input.document === "string"
      ? normalizeBrazilianDocument(input.document)
      : "";
  const email =
    typeof input.email === "string" && input.email.trim()
      ? input.email.trim().toLowerCase()
      : null;
  const phone =
    typeof input.phone === "string" && input.phone.trim()
      ? input.phone.trim()
      : null;
  const notes =
    typeof input.notes === "string" && input.notes.trim()
      ? input.notes.trim()
      : null;
  const ownerUserId =
    typeof input.ownerUserId === "string" ? input.ownerUserId : "";
  if (
    input.territoryId !== undefined &&
    input.territoryId !== null &&
    typeof input.territoryId !== "string"
  ) {
    return NextResponse.json(
      { error: "Selecione um território válido." },
      { status: 400 },
    );
  }
  const territoryId =
    typeof input.territoryId === "string" && input.territoryId
      ? input.territoryId
      : null;

  if (!isCrmRecordType(recordType)) {
    return NextResponse.json(
      { error: "Selecione empresa/loja ou pessoa física." },
      { status: 400 },
    );
  }
  if (!name || name.length > 160) {
    return NextResponse.json(
      { error: "O nome deve ter entre 1 e 160 caracteres." },
      { status: 400 },
    );
  }
  if (tradeName && (recordType !== "company" || tradeName.length > 160)) {
    return NextResponse.json(
      { error: "O nome fantasia deve ter no máximo 160 caracteres." },
      { status: 400 },
    );
  }
  if (document && !isValidBrazilianDocument(document, recordType)) {
    return NextResponse.json(
      {
        error:
          recordType === "company"
            ? "Informe um CNPJ válido."
            : "Informe um CPF válido.",
      },
      { status: 400 },
    );
  }
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return NextResponse.json(
      { error: "Informe um endereço de e-mail válido." },
      { status: 400 },
    );
  }
  if (phone && phone.length > 32) {
    return NextResponse.json(
      { error: "O telefone deve ter no máximo 32 caracteres." },
      { status: 400 },
    );
  }
  if (notes && notes.length > 4000) {
    return NextResponse.json(
      { error: "As observações devem ter no máximo 4.000 caracteres." },
      { status: 400 },
    );
  }
  if (!UUID_PATTERN.test(ownerUserId)) {
    return NextResponse.json(
      { error: "Selecione um responsável válido." },
      { status: 400 },
    );
  }
  if (territoryId && !UUID_PATTERN.test(territoryId)) {
    return NextResponse.json(
      { error: "Selecione um território válido." },
      { status: 400 },
    );
  }

  if (territoryId) {
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
        { error: "O território não está atribuído ao responsável selecionado." },
        { status: 400 },
      );
    }
  }

  if (ownerUserId !== authorization.userId) {
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

  const { data: canManage, error: accessError } =
    await authorization.supabase.rpc("can_manage_crm_record", {
      target_owner_user_id: ownerUserId,
      target_territory_id: territoryId,
    });
  if (accessError) {
    console.error("CRM record access validation failed.", {
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
          "Você só pode cadastrar registros próprios ou da equipe que gerencia e em territórios atribuídos a esse responsável.",
      },
      { status: 403 },
    );
  }

  const { data, error } = await authorization.supabase
    .from("crm_records")
    .insert({
      record_type: recordType,
      name,
      trade_name: recordType === "company" ? tradeName : null,
      document: document || null,
      email,
      phone,
      notes,
      owner_user_id: ownerUserId,
      territory_id: territoryId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("CRM record creation failed.", { code: error.code });
    const duplicateDocument = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicateDocument
          ? "Já existe um cadastro com esse CPF ou CNPJ."
          : "Não foi possível criar o cadastro. Confira os dados e tente novamente.",
      },
      { status: duplicateDocument ? 409 : 400 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
