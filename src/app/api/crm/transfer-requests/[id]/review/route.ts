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
      { error: "Aprovações estão desabilitadas fora do ambiente de produção." },
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
      { error: "A solicitação de transferência informada é inválida." },
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
      { error: "A decisão da transferência é inválida." },
      { status: 400 },
    );
  }
  const input = body as Record<string, unknown>;
  if (typeof input.approve !== "boolean") {
    return NextResponse.json(
      { error: "Selecione aprovar ou rejeitar." },
      { status: 400 },
    );
  }
  if (
    input.reason !== undefined &&
    input.reason !== null &&
    typeof input.reason !== "string"
  ) {
    return NextResponse.json(
      { error: "O motivo da decisão deve ser texto." },
      { status: 400 },
    );
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : null;
  if (!input.approve && (!reason || reason.length > 1000)) {
    return NextResponse.json(
      { error: "Informe um motivo de rejeição com até 1.000 caracteres." },
      { status: 400 },
    );
  }
  if (input.approve && reason && reason.length > 1000) {
    return NextResponse.json(
      { error: "O motivo deve ter no máximo 1.000 caracteres." },
      { status: 400 },
    );
  }

  const { data, error } = await authorization.supabase.rpc(
    "review_crm_customer_transfer_request",
    {
      target_request_id: id,
      approve: input.approve,
      decision_reason: reason || null,
    },
  );
  if (error) {
    console.error("Protected customer transfer review failed.", {
      code: error.code,
    });
    return NextResponse.json(
      {
        error:
          "Não foi possível decidir a transferência. Ela pode não estar aguardando sua aprovação ou você pode não ter permissão para esta etapa.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    status: data,
    message: input.approve
      ? data === "approved"
        ? "Transferência aprovada e carteira atualizada."
        : "Etapa aprovada. A solicitação segue para a diretoria."
      : "Transferência rejeitada.",
  });
}
