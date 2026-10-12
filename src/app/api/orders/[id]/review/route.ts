import { NextRequest, NextResponse } from "next/server";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";
import { sendSalesOrderReviewEmail } from "@/lib/orders/send-review-email";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
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
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "O pedido solicitado é inválido." },
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
      { error: "A decisão do pedido é inválida." },
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
      { error: "O motivo da rejeição deve ser texto." },
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

  const { data: order, error: orderError } = await authorization.supabase
    .from("sales_orders")
    .select("owner_user_id, customer_name_snapshot")
    .eq("id", id)
    .maybeSingle();
  if (orderError) {
    console.error("Sales order review context lookup failed.", {
      code: orderError.code,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar os dados do pedido." },
      { status: 503 },
    );
  }
  if (!order) {
    return NextResponse.json(
      { error: "O pedido não foi encontrado ou você não tem permissão para revisá-lo." },
      { status: 404 },
    );
  }

  const { error } = await authorization.supabase.rpc("review_sales_order", {
    target_order_id: id,
    approve: input.approve,
    reason: reason || null,
  });
  if (error) {
    console.error("Sales order review failed.", { code: error.code });
    return NextResponse.json(
      { error: "Não foi possível decidir o pedido. Ele pode não estar aguardando aprovação ou você não tem permissão." },
      { status: 409 },
    );
  }

  let emailResult: { sent: boolean; error: string | null };
  try {
    emailResult = await sendSalesOrderReviewEmail({
      orderId: id,
      ownerUserId: order.owner_user_id,
      customerName: order.customer_name_snapshot,
      outcome: input.approve ? "approved" : "rejected",
      rejectionReason: reason,
    });
  } catch (emailError) {
    console.error("Sales order review email delivery failed.", {
      orderId: id,
      errorName:
        emailError instanceof Error ? emailError.name : "UnknownError",
    });
    emailResult = {
      sent: false,
      error:
        "A notificação interna foi criada, mas o e-mail não pôde ser enviado. Verifique a configuração do serviço.",
    };
  }

  return NextResponse.json({
    message: input.approve ? "Pedido aprovado." : "Pedido rejeitado.",
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  });
}
