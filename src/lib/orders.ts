import type { SalesOrderStatus } from "@/lib/supabase/database.types";

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  draft: "Rascunho",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SalesOrderLineInput = {
  product_id: string;
  quantity: number;
};

export function parseSalesOrderItems(value: unknown):
  | { items: SalesOrderLineInput[] }
  | { error: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    return { error: "Inclua entre 1 e 100 produtos no pedido." };
  }

  const items: SalesOrderLineInput[] = [];
  const productIds = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return { error: "Um dos itens do pedido é inválido." };
    }
    const item = entry as Record<string, unknown>;
    if (
      typeof item.productId !== "string" ||
      !UUID_PATTERN.test(item.productId) ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 1_000_000
    ) {
      return {
        error: "Cada produto precisa ter uma quantidade inteira entre 1 e 1.000.000.",
      };
    }
    if (productIds.has(item.productId)) {
      return {
        error: "Cada produto deve aparecer uma única vez no pedido.",
      };
    }
    productIds.add(item.productId);
    items.push({
      product_id: item.productId,
      quantity: item.quantity,
    });
  }

  return { items };
}

export function isSalesOrderStatus(value: string): value is SalesOrderStatus {
  return Object.hasOwn(SALES_ORDER_STATUS_LABELS, value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
