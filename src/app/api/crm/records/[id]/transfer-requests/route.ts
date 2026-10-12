import { NextRequest, NextResponse } from "next/server";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "Transferências estão desabilitadas fora do ambiente de produção." },
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
      { error: "O cadastro informado é inválido." },
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
      { error: "Os dados da transferência são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.targetOwnerUserId !== "string" ||
    !UUID_PATTERN.test(input.targetOwnerUserId)
  ) {
    return NextResponse.json(
      { error: "Selecione um novo responsável válido." },
      { status: 400 },
    );
  }
  if (
    typeof input.reason !== "string" ||
    input.reason.trim().length < 1 ||
    input.reason.trim().length > 1000
  ) {
    return NextResponse.json(
      { error: "Informe a justificativa da transferência (até 1.000 caracteres)." },
      { status: 400 },
    );
  }

  const { data, error } = await authorization.supabase.rpc(
    "create_crm_customer_transfer_request",
    {
      target_customer_id: id,
      target_owner_user_id: input.targetOwnerUserId,
      transfer_reason: input.reason.trim(),
    },
  );
  if (error || !data) {
    console.error("Protected customer transfer request failed.", {
      code: error?.code,
    });
    return NextResponse.json(
      {
        error:
          "Não foi possível solicitar a transferência. Verifique a proteção ativa, o território do novo responsável e se já existe uma solicitação em aberto.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
