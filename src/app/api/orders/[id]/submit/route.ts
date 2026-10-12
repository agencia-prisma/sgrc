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

  const { error } = await authorization.supabase.rpc("submit_sales_order", {
    target_order_id: id,
  });
  if (error) {
    console.error("Sales order submission failed.", { code: error.code });
    return NextResponse.json(
      { error: "Não foi possível enviar o pedido. Verifique se ainda está como rascunho e possui itens." },
      { status: 409 },
    );
  }
  return NextResponse.json({ message: "Pedido enviado para aprovação." });
}
