import { NextRequest, NextResponse } from "next/server";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      { error: "A notificação solicitada é inválida." },
      { status: 400 },
    );
  }

  const { data, error } = await authorization.supabase
    .from("sales_order_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Sales order notification read update failed.", {
      code: error.code,
    });
    return NextResponse.json(
      { error: "Não foi possível atualizar a notificação." },
      { status: 503 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "A notificação não foi encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: "Notificação marcada como lida." });
}
