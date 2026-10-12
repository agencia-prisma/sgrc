import { NextRequest, NextResponse } from "next/server";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";
import { parseSalesOrderItems } from "@/lib/orders";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mutationsDisabled() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production";
}

export async function POST(request: NextRequest) {
  if (mutationsDisabled()) {
    return NextResponse.json(
      { error: "Pedidos estão desabilitados fora do ambiente de produção." },
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
      { error: "Os dados do pedido são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  if (typeof input.customerId !== "string" || !UUID_PATTERN.test(input.customerId)) {
    return NextResponse.json(
      { error: "Selecione um cliente válido." },
      { status: 400 },
    );
  }
  const parsedItems = parseSalesOrderItems(input.items);
  if ("error" in parsedItems) {
    return NextResponse.json({ error: parsedItems.error }, { status: 400 });
  }
  if (
    input.notes !== undefined &&
    input.notes !== null &&
    typeof input.notes !== "string"
  ) {
    return NextResponse.json(
      { error: "As observações devem ser texto." },
      { status: 400 },
    );
  }
  const notes = typeof input.notes === "string" ? input.notes.trim() : null;
  if (notes && notes.length > 2000) {
    return NextResponse.json(
      { error: "As observações devem ter no máximo 2.000 caracteres." },
      { status: 400 },
    );
  }

  const { data, error } = await authorization.supabase.rpc(
    "create_sales_order",
    {
      target_customer_id: input.customerId,
      target_items: parsedItems.items,
      target_notes: notes || null,
    },
  );
  if (error || !data) {
    console.error("Sales order creation failed.", { code: error?.code });
    return NextResponse.json(
      {
        error:
          error?.code === "23503"
            ? "O cliente ou um produto selecionado não está mais disponível."
            : "Não foi possível criar o rascunho. Confira o cliente e os produtos ativos.",
      },
      { status: error?.code === "23503" ? 400 : 400 },
    );
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
