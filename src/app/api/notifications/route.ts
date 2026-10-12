import { NextResponse } from "next/server";
import { requireCrmAccess } from "@/lib/crm/require-crm-access";

export async function GET() {
  const authorization = await requireCrmAccess();
  if ("response" in authorization) return authorization.response;

  const { data, error } = await authorization.supabase
    .from("sales_order_notifications")
    .select(
      "id, order_id, notification_type, title, message, created_at, read_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Sales order notifications lookup failed.", {
      code: error.code,
    });
    return NextResponse.json(
      { error: "Não foi possível carregar as notificações." },
      { status: 503 },
    );
  }

  return NextResponse.json({ notifications: data });
}
