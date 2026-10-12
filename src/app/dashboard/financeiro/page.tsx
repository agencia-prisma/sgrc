import { redirect } from "next/navigation";
import { hasRequiredMfaRole } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import FinanceOrdersManager, {
  type FinanceOrder,
} from "./finance-orders-manager";

export default async function FinancePage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("Finance page session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }
  if (!claimsData?.claims) redirect("/login");

  const userId = claimsData.claims.sub;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) {
    console.error("Finance page role lookup failed.", { code: rolesError.code });
    throw new Error("Não foi possível validar as permissões.");
  }
  const hasFinanceAccess = roles.some(
    ({ role }) => role === "finance" || role === "super_admin",
  );
  if (!hasFinanceAccess) redirect("/dashboard");
  if (hasRequiredMfaRole(roles.map(({ role }) => role)) &&
    claimsData.claims.aal !== "aal2") {
    redirect("/auth/mfa");
  }

  const ordersResult = await supabase
    .from("sales_orders")
    .select(
      "id, customer_name_snapshot, customer_document_snapshot, total, created_at",
    )
    .eq("status", "approved")
    .gt("total", 0)
    .order("created_at", { ascending: false })
    .limit(500);
  if (ordersResult.error) {
    console.error("Finance page approved-order lookup failed.", {
      code: ordersResult.error.code,
    });
    throw new Error("Não foi possível carregar os pedidos aprovados.");
  }

  const orderIds = ordersResult.data.map(({ id }) => id);
  const eventsResult =
    orderIds.length > 0
      ? await supabase
          .from("sales_order_financial_events")
          .select(
            "id, sales_order_id, event_type, invoice_number, amount, occurred_on",
          )
          .in("sales_order_id", orderIds)
          .order("occurred_on")
      : { data: [], error: null };

  if (eventsResult.error) {
    console.error("Finance page event lookup failed.", {
      code: eventsResult.error.code,
    });
    throw new Error("Não foi possível carregar o histórico financeiro.");
  }

  const eventsByOrder = new Map<
    string,
    (typeof eventsResult.data)[number][]
  >();
  for (const event of eventsResult.data) {
    eventsByOrder.set(event.sales_order_id, [
      ...(eventsByOrder.get(event.sales_order_id) ?? []),
      event,
    ]);
  }

  const orders: FinanceOrder[] = ordersResult.data.flatMap((order) => {
    const events = eventsByOrder.get(order.id) ?? [];
    const invoice = events.find(({ event_type }) => event_type === "invoice");
    const paidTotal = events.reduce(
      (sum, event) =>
        event.event_type === "payment_received"
          ? sum + (event.amount ?? 0)
          : sum,
      0,
    );
    const balance = Math.max(0, order.total - paidTotal);
    if (balance === 0) return [];

    return [{
      id: order.id,
      customerName: order.customer_name_snapshot,
      customerDocument: order.customer_document_snapshot,
      total: order.total,
      createdAt: order.created_at,
      invoiceNumber: invoice?.invoice_number ?? null,
      invoiceDate: invoice?.occurred_on ?? null,
      paidTotal,
      balance,
    }];
  });

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Financeiro / Faturamento e recebimentos</p>
      </header>
      <section aria-labelledby="finance-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SGRC · Financeiro</p>
            <h1 className="workspace-title" id="finance-title">
              Faturamento e recebimentos
            </h1>
            <p className="workspace-description">
              Registre notas fiscais e recebimentos de pedidos aprovados. A
              carteira só é protegida após a quitação integral de um pedido
              faturado.
            </p>
          </div>
        </div>
        <p className="notice" role="note">
          Os lançamentos manuais ficam registrados com autor e data. A origem
          dos eventos já distingue registros manuais de futuras atualizações
          integradas ao ERP.
        </p>
        <FinanceOrdersManager orders={orders} />
      </section>
    </>
  );
}
