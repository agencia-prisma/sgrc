import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasCrmRole } from "@/lib/crm";
import {
  formatCurrency,
  SALES_ORDER_STATUS_LABELS,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import OrderActions from "../order-actions";
import OrderForm, {
  type ExistingOrderItem,
  type OrderCustomerOption,
  type OrderProductOption,
} from "../order-form";

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError) {
    console.error("Sales order page session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }
  if (!claimsData?.claims) redirect("/login");

  const userId = claimsData.claims.sub;
  const [orderResult, rolesResult] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (orderResult.error || rolesResult.error) {
    console.error("Sales order details lookup failed.", {
      orderCode: orderResult.error?.code,
      rolesCode: rolesResult.error?.code,
    });
    throw new Error("Não foi possível carregar os dados do pedido.");
  }
  if (!orderResult.data) notFound();

  const order = orderResult.data;
  const isCommercialUser = rolesResult.data.some(({ role }) =>
    hasCrmRole(role),
  );
  if (!isCommercialUser) redirect("/dashboard");

  const isOwner = order.owner_user_id === userId;
  const canEdit =
    isOwner && (order.status === "draft" || order.status === "rejected");
  const canSubmit = isOwner && order.status === "draft";
  const hasElevatedReviewRole = rolesResult.data.some(
    ({ role }) => role === "super_admin" || role === "director",
  );

  const [itemsResult, customerResult, productsResult, teamResult, profilesResult] =
    await Promise.all([
      supabase
        .from("sales_order_items")
        .select(
          "id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, line_total",
        )
        .eq("order_id", id)
        .order("created_at"),
      supabase
        .from("crm_records")
        .select("id, name, document")
        .neq("status", "lost")
        .order("name")
        .limit(1000),
      supabase
        .from("products")
        .select("id, sku, name, price, is_active")
        .order("name")
        .limit(1000),
      supabase
        .from("commercial_team_members")
        .select("user_id")
        .eq("manager_user_id", userId),
      supabase.from("profiles").select("id, display_name"),
    ]);

  if (
    itemsResult.error ||
    customerResult.error ||
    productsResult.error ||
    teamResult.error ||
    profilesResult.error
  ) {
    console.error("Sales order details data loading failed.", {
      itemsCode: itemsResult.error?.code,
      customerCode: customerResult.error?.code,
      productCode: productsResult.error?.code,
      teamCode: teamResult.error?.code,
      profilesCode: profilesResult.error?.code,
    });
    throw new Error("Não foi possível carregar os detalhes do pedido.");
  }

  const isDirectManager = teamResult.data.some(
    ({ user_id: teamMemberId }) => teamMemberId === order.owner_user_id,
  );
  const canReview =
    order.status === "pending_approval" &&
    order.owner_user_id !== userId &&
    (hasElevatedReviewRole || isDirectManager);
  const profileLabels = new Map(
    profilesResult.data.map((profile) => [
      profile.id,
      profile.display_name || `Usuário ${profile.id.slice(0, 8)}`,
    ]),
  );
  const customers: OrderCustomerOption[] = customerResult.data.map(
    (customer) => ({
      id: customer.id,
      name: customer.name,
      document: customer.document,
    }),
  );
  if (!customers.some((customer) => customer.id === order.customer_id)) {
    customers.push({
      id: order.customer_id,
      name: `${order.customer_name_snapshot} (não disponível para edição)`,
      document: order.customer_document_snapshot,
      disabled: true,
    });
  }
  const products: OrderProductOption[] = productsResult.data.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    isActive: product.is_active,
  }));
  for (const item of itemsResult.data) {
    if (!products.some((product) => product.id === item.product_id)) {
      products.push({
        id: item.product_id,
        sku: item.sku_snapshot,
        name: item.name_snapshot,
        price: item.unit_price,
        isActive: false,
      });
    }
  }
  const initialItems: ExistingOrderItem[] = itemsResult.data.map((item) => ({
    productId: item.product_id,
    sku: item.sku_snapshot,
    name: item.name_snapshot,
    quantity: item.quantity,
  }));

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Comercial / Pedidos / Detalhe</p>
        <Link className="text-link" href="/dashboard/pedidos">
          Voltar aos pedidos
        </Link>
      </header>
      <section aria-labelledby="order-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SGRC · Gestão comercial</p>
            <h1 className="workspace-title" id="order-title">
              Pedido de {order.customer_name_snapshot}
            </h1>
            <p className="workspace-description">
              Criado em{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(order.created_at))}
              {" · "}Responsável:{" "}
              {profileLabels.get(order.owner_user_id) ?? "—"}
            </p>
          </div>
          <span
            className={`sales-order-status sales-order-status-${order.status}`}
          >
            {SALES_ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>

        {order.status === "rejected" && order.rejection_reason ? (
          <p className="notice" role="status">
            <strong>Motivo da rejeição:</strong> {order.rejection_reason}
          </p>
        ) : null}

        {canEdit ? (
          <section
            aria-labelledby="edit-order-title"
            className="module-section crm-section"
          >
            <div className="section-heading">
              <div>
                <h2 className="section-title" id="edit-order-title">
                  {order.status === "rejected"
                    ? "Corrigir e salvar como rascunho"
                    : "Editar rascunho"}
                </h2>
                <p>
                  Ao salvar, os itens e os preços atuais dos produtos ativos
                  substituirão a versão anterior.
                </p>
              </div>
            </div>
            <OrderForm
              customers={customers}
              initialCustomerId={order.customer_id}
              initialItems={initialItems}
              initialNotes={order.notes ?? ""}
              orderId={order.id}
              products={products}
            />
          </section>
        ) : (
          <section
            aria-labelledby="order-items-title"
            className="module-section crm-section"
          >
            <div className="section-heading">
              <div>
                <h2 className="section-title" id="order-items-title">
                  Itens do pedido
                </h2>
                {order.customer_document_snapshot ? (
                  <p>Documento: {order.customer_document_snapshot}</p>
                ) : null}
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Quantidade</th>
                    <th scope="col">Preço unitário</th>
                    <th scope="col">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsResult.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name_snapshot}</strong>
                        <small className="table-secondary">
                          {item.sku_snapshot}
                        </small>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td>{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3} scope="row">
                      Total do pedido
                    </th>
                    <th>{formatCurrency(order.total)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
            {order.notes ? (
              <div className="sales-order-notes">
                <h3>Observações</h3>
                <p>{order.notes}</p>
              </div>
            ) : null}
          </section>
        )}

        {canSubmit || canReview ? (
          <section
            aria-labelledby="order-actions-title"
            className="module-section crm-section"
          >
            <div className="section-heading">
              <div>
                <h2 className="section-title" id="order-actions-title">
                  {canReview ? "Revisão do pedido" : "Próxima etapa"}
                </h2>
                <p>
                  {canReview
                    ? "Revise os itens e aprove ou rejeite o pedido."
                    : "Envie o rascunho para iniciar o fluxo de aprovação."}
                </p>
              </div>
            </div>
            <OrderActions
              canReview={canReview}
              canSubmit={canSubmit}
              orderId={order.id}
            />
          </section>
        ) : null}
      </section>
    </>
  );
}
