import { NextRequest, NextResponse } from "next/server";
import { isCrmInteractionType } from "@/lib/crm";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
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
      { error: "Os dados do contato são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const interactionType = input.interactionType;
  const summary =
    typeof input.summary === "string" ? input.summary.trim() : "";
  if (
    input.details !== undefined &&
    input.details !== null &&
    typeof input.details !== "string"
  ) {
    return NextResponse.json(
      { error: "Os detalhes do contato devem ser texto." },
      { status: 400 },
    );
  }
  const details =
    typeof input.details === "string" && input.details.trim()
      ? input.details.trim()
      : null;
  if (!isCrmInteractionType(interactionType)) {
    return NextResponse.json(
      { error: "Selecione um tipo de contato válido." },
      { status: 400 },
    );
  }
  if (!summary || summary.length > 160) {
    return NextResponse.json(
      { error: "O resumo deve ter entre 1 e 160 caracteres." },
      { status: 400 },
    );
  }
  if (details && details.length > 4000) {
    return NextResponse.json(
      { error: "Os detalhes devem ter no máximo 4.000 caracteres." },
      { status: 400 },
    );
  }
  const { data: record, error: recordError } = await authorization.supabase
    .from("crm_records")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (recordError) {
    console.error("CRM interaction record lookup failed.", {
      code: recordError.code,
    });
    return NextResponse.json(
      { error: "Não foi possível validar o cadastro." },
      { status: 503 },
    );
  }
  if (!record) {
    return NextResponse.json(
      { error: "Cadastro não encontrado." },
      { status: 404 },
    );
  }

  const { error } = await authorization.supabase.from("crm_interactions").insert({
    record_id: id,
    interaction_type: interactionType,
    summary,
    details,
  });
  if (error) {
    console.error("CRM interaction creation failed.", { code: error.code });
    return NextResponse.json(
      { error: "Não foi possível registrar o contato. Tente novamente." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { message: "Contato registrado." },
    { status: 201 },
  );
}
