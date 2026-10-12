import Link from "next/link";
import { redirect } from "next/navigation";
import { hasCrmRole } from "@/lib/crm";
import { formatCurrency, SALES_ORDER_STATUS_LABELS } from "@/lib/orders";
import OrderForm, {
  type OrderCustomerOption,
  type OrderProductOption,
} from "./order-form";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError) {
    console.error("Sales orders page session validation failed.", {
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
    console.error("Sales orders page role lookup failed.", {
      code: rolesError.code,
    });
    throw new Error("Não foi possível validar as permissões.");
  }
  if (!roles.some(({ role }) => hasCrmRole(role))) redirect("/dashboard");

  const [ordersResult, customersResult, productsResult, profilesResult] =
    await Promise.all([
    supabase
      .from("sales_orders")
      .select(
        "id, customer_name_snapshot, customer_document_snapshot, owner_user_id, status, total, created_at, submitted_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("crm_records")
      .select("id, name, document")
      .neq("status", "lost")
      .order("name")
      .limit(1000),
    supabase
      .from("products")
      .select("id, sku, name, price, is_active")
      .eq("is_active", true)
      .order("name")
      .limit(1000),
    supabase.from("profiles").select("id, display_name"),
  ]);

  if (
    ordersResult.error ||
    customersResult.error ||
    productsResult.error ||
    profilesResult.error
  ) {
    const missingSchema =
      ordersResult.error?.code === "PGRST205" ||
      ordersResult.error?.code === "42P01";
    if (missingSchema) {
      return (
        <>
          <header className="app-topbar">
            <p className="topbar-context">Comercial / Pedidos</p>
            <Link className="text-link" href="/dashboard">
              Voltar ao painel
            </Link>
          </header>
          <section aria-labelledby="orders-title" className="workspace">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">SGRC · Gestão comercial</p>
                <h1 className="workspace-title" id="orders-title">
                  Pedidos
                </h1>
              </div>
            </div>
            <p className="notice" role="alert">
              A estrutura de pedidos ainda não está instalada neste banco.
              Aplique a migration{" "}
              <code>20261011234000_sales_orders.sql</code> e atualize esta
              página.
            </p>
          </section>
        </>
      );
    }
    console.error("Sales orders page data loading failed.", {
      orderCode: ordersResult.error?.code,
      customerCode: customersResult.error?.code,
      productCode: productsResult.error?.code,
      profileCode: profilesResult.error?.code,
    });
    throw new Error("Não foi possível carregar os pedidos.");
  }

  const profileLabels = new Map(
    profilesResult.data.map((profile) => [
      profile.id,
      profile.display_name || `Usuário ${profile.id.slice(0, 8)}`,
    ]),
  );
  const customers: OrderCustomerOption[] = customersResult.data.map(
    (customer) => ({
      id: customer.id,
      name: customer.name,
      document: customer.document,
    }),
  );
  const products: OrderProductOption[] = productsResult.data.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    isActive: product.is_active,
  }));

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Comercial / Pedidos</p>
        <Link className="text-link" href="/dashboard">
          Voltar ao painel
        </Link>
      </header>
      <section aria-labelledby="orders-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SGRC · Gestão comercial</p>
            <h1 className="workspace-title" id="orders-title">
              Pedidos
            </h1>
            <p className="workspace-description">
              Monte um rascunho com os preços atuais do catálogo e envie para
              aprovação.
            </p>
          </div>
        </div>

        <section
          aria-labelledby="new-order-title"
          className="module-section crm-section"
        >
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="new-order-title">
                Novo pedido
              </h2>
              <p>
                O pedido inicia como rascunho. Os preços são registrados no
                momento em que o rascunho é salvo.
              </p>
            </div>
          </div>
          <OrderForm customers={customers} products={products} />
        </section>

        <section
          aria-labelledby="orders-list-title"
          className="module-section crm-section"
        >
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="orders-list-title">
                Pedidos recentes
              </h2>
              <p>
                {ordersResult.data.length === 500
                  ? "Mostrando até 500 pedidos."
                  : `${ordersResult.data.length} pedido(s) visível(is).`}
              </p>
            </div>
          </div>
          {ordersResult.data.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Criado em</th>
                    <th scope="col">Total</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersResult.data.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          className="crm-record-link"
                          href={`/dashboard/pedidos/${order.id}`}
                        >
                          <strong>{order.customer_name_snapshot}</strong>
                          {order.customer_document_snapshot ? (
                            <small>{order.customer_document_snapshot}</small>
                          ) : null}
                        </Link>
                      </td>
                      <td>
                        {profileLabels.get(order.owner_user_id) ?? "—"}
                      </td>
                      <td>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "medium",
                        }).format(new Date(order.created_at))}
                      </td>
                      <td>{formatCurrency(order.total)}</td>
                      <td>
                        <span
                          className={`sales-order-status sales-order-status-${order.status}`}
                        >
                          {SALES_ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">
              Ainda não há pedidos. Crie um rascunho usando o formulário acima.
            </p>
          )}
        </section>
      </section>
    </>
  );
}
