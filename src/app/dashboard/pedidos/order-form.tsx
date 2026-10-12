"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/orders";

export type OrderProductOption = {
  id: string;
  sku: string;
  name: string;
  price: number;
  isActive: boolean;
};

export type OrderCustomerOption = {
  id: string;
  name: string;
  document: string | null;
  disabled?: boolean;
};

export type ExistingOrderItem = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
};

type OrderLineDraft = {
  key: number;
  productId: string;
  quantity: string;
};

export default function OrderForm({
  orderId,
  customers,
  products,
  initialItems = [],
  initialCustomerId = "",
  initialNotes = "",
}: {
  orderId?: string;
  customers: OrderCustomerOption[];
  products: OrderProductOption[];
  initialItems?: ExistingOrderItem[];
  initialCustomerId?: string;
  initialNotes?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [lines, setLines] = useState<OrderLineDraft[]>(
    initialItems.map((item, index) => ({
      key: index,
      productId: item.productId,
      quantity: String(item.quantity),
    })),
  );
  const [nextKey, setNextKey] = useState(initialItems.length);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productById = new Map(products.map((product) => [product.id, product]));
  const hasActiveProducts = products.some((product) => product.isActive);
  const total = lines.reduce((sum, line) => {
    const product = productById.get(line.productId);
    const quantity = Number(line.quantity);
    return product && Number.isInteger(quantity) && quantity > 0
      ? sum + product.price * quantity
      : sum;
  }, 0);

  function addLine() {
    setLines((current) => [
      ...current,
      { key: nextKey, productId: "", quantity: "1" },
    ]);
    setNextKey((current) => current + 1);
  }

  function updateLine(key: number, update: Partial<OrderLineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...update } : line)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!customerId) {
      setErrorMessage("Selecione um cliente para o pedido.");
      return;
    }
    if (lines.length === 0) {
      setErrorMessage("Adicione pelo menos um produto ao pedido.");
      return;
    }
    const items = lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
    }));
    if (
      items.some(
        (item) =>
          !item.productId ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 1_000_000,
      )
    ) {
      setErrorMessage(
        "Selecione um produto e informe quantidades inteiras maiores que zero.",
      );
      return;
    }
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      setErrorMessage("Cada produto deve aparecer uma única vez no pedido.");
      return;
    }
    if (
      items.some(
        (item) => !productById.get(item.productId)?.isActive,
      )
    ) {
      setErrorMessage(
        "Remova ou substitua os produtos inativos antes de salvar o pedido.",
      );
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      customerId,
      items,
      notes: formData.get("notes"),
    };
    try {
      const response = await fetch(
        orderId ? `/api/orders/${orderId}` : "/api/orders",
        {
          method: orderId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        id?: string;
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível salvar o rascunho.");
        return;
      }
      if (result.id) {
        router.push(`/dashboard/pedidos/${result.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setErrorMessage(
        "Não foi possível conectar ao serviço. Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form sales-order-form" onSubmit={handleSubmit}>
      <label className="field sales-order-wide" htmlFor="order-customer">
        Cliente
        <select
          className="input"
          id="order-customer"
          onChange={(event) => setCustomerId(event.target.value)}
          value={customerId}
        >
          <option value="">Selecione um cliente</option>
          {customers.map((customer) => (
            <option
              disabled={customer.disabled}
              key={customer.id}
              value={customer.id}
            >
              {customer.name}
              {customer.document ? ` · ${customer.document}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="sales-order-lines sales-order-wide">
        <div className="sales-order-lines-heading">
          <h3>Produtos</h3>
          <button
            className="secondary-button"
            disabled={!hasActiveProducts || lines.length >= 100}
            onClick={addLine}
            type="button"
          >
            Adicionar produto
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="empty-state">Adicione os produtos que deseja pedir.</p>
        ) : (
          <div className="sales-order-line-list">
            {lines.map((line) => {
              const selectedProduct = productById.get(line.productId);
              return (
                <div className="sales-order-line" key={line.key}>
                  <label className="field">
                    Produto
                    <select
                      className="input"
                      onChange={(event) =>
                        updateLine(line.key, { productId: event.target.value })
                      }
                      value={line.productId}
                    >
                      <option value="">Selecione um produto</option>
                      {products.map((product) => (
                        <option
                          disabled={!product.isActive}
                          key={product.id}
                          value={product.id}
                        >
                          {product.sku} · {product.name}
                          {!product.isActive ? " (inativo)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Quantidade
                    <input
                      className="input"
                      inputMode="numeric"
                      max={1_000_000}
                      min={1}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                      type="number"
                      value={line.quantity}
                    />
                  </label>
                  <span className="sales-order-line-total">
                    {selectedProduct
                      ? formatCurrency(
                          selectedProduct.price * Number(line.quantity || 0),
                        )
                      : "—"}
                  </span>
                  <button
                    aria-label="Remover produto"
                    className="secondary-button sales-order-remove"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.key !== line.key),
                      )
                    }
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="sales-order-total">
          <span>Total estimado</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>

      <label className="field sales-order-wide" htmlFor="order-notes">
        Observações (opcional)
        <textarea
          className="input crm-textarea"
          defaultValue={initialNotes}
          id="order-notes"
          maxLength={2000}
          name="notes"
          rows={3}
        />
      </label>

      {errorMessage ? (
        <p className="notice sales-order-wide" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {!hasActiveProducts ? (
        <p className="notice sales-order-wide" role="status">
          Não há produtos ativos no catálogo. Cadastre ou reative produtos
          antes de criar ou editar o pedido.
        </p>
      ) : null}
      {customers.length === 0 ? (
        <p className="notice sales-order-wide" role="status">
          Não há clientes disponíveis para este perfil. Cadastre ou atribua um
          cliente no módulo Leads e clientes.
        </p>
      ) : null}
      <button
        className="button sales-order-wide"
        disabled={
          isSubmitting || !hasActiveProducts || customers.length === 0
        }
        type="submit"
      >
        {isSubmitting
          ? "Salvando..."
          : orderId
            ? "Salvar rascunho"
            : "Criar rascunho"}
      </button>
    </form>
  );
}
