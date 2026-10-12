"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatCurrency } from "@/lib/orders";

export type FinanceOrder = {
  id: string;
  customerName: string;
  customerDocument: string | null;
  total: number;
  createdAt: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  paidTotal: number;
  balance: number;
};

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function FinanceOrderCard({ order }: { order: FinanceOrder }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitEvent(
    event: FormEvent<HTMLFormElement>,
    eventType: "invoice" | "payment_received",
  ) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    const payload =
      eventType === "invoice"
        ? {
            eventType,
            invoiceNumber: data.get("invoiceNumber"),
            date: data.get("date"),
          }
        : {
            eventType,
            amount: Number(data.get("amount")),
            date: data.get("date"),
          };

    try {
      const response = await fetch(
        `/api/finance/orders/${order.id}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível salvar o lançamento.");
        return;
      }
      setMessage(result.message ?? "Lançamento registrado.");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao serviço financeiro.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="module-section finance-order">
      <div className="finance-order-heading">
        <div>
          <h2 className="section-title">{order.customerName}</h2>
          {order.customerDocument ? (
            <p className="finance-order-document">{order.customerDocument}</p>
          ) : null}
          <p>
            Pedido criado em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "medium",
            }).format(new Date(order.createdAt))}
          </p>
        </div>
        <strong className="finance-order-total">
          {formatCurrency(order.total)}
        </strong>
      </div>

      {order.invoiceNumber ? (
        <div className="finance-balance">
          <span>
            Nota fiscal {order.invoiceNumber} ·{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(`${order.invoiceDate}T00:00:00Z`))}
          </span>
          <span>
            Recebido: {formatCurrency(order.paidTotal)} · Saldo:{" "}
            <strong>{formatCurrency(order.balance)}</strong>
          </span>
        </div>
      ) : null}

      {order.invoiceNumber ? (
        <form
          className="form finance-event-form"
          onSubmit={(event) => void submitEvent(event, "payment_received")}
        >
          <label className="field">
            Valor recebido
            <input
              className="input"
              defaultValue={order.balance.toFixed(2)}
              max={order.balance}
              min="0.01"
              name="amount"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="field">
            Data do recebimento
            <input
              className="input"
              defaultValue={today()}
              max={today()}
              name="date"
              required
              type="date"
            />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Registrando..." : "Registrar recebimento"}
          </button>
        </form>
      ) : (
        <form
          className="form finance-event-form"
          onSubmit={(event) => void submitEvent(event, "invoice")}
        >
          <label className="field">
            Número da nota fiscal
            <input
              autoComplete="off"
              className="input"
              maxLength={120}
              name="invoiceNumber"
              required
            />
          </label>
          <label className="field">
            Data de faturamento
            <input
              className="input"
              defaultValue={today()}
              max={today()}
              name="date"
              required
              type="date"
            />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Registrando..." : "Registrar faturamento"}
          </button>
        </form>
      )}

      {message ? (
        <p aria-live="polite" className="success-notice" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="notice" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export default function FinanceOrdersManager({
  orders,
}: {
  orders: FinanceOrder[];
}) {
  if (orders.length === 0) {
    return (
      <p className="empty-state">
        Não há pedidos aprovados aguardando faturamento ou quitação.
      </p>
    );
  }

  return (
    <div className="finance-order-list">
      {orders.map((order) => (
        <FinanceOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
