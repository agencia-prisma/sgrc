"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({
  orderId,
  canSubmit,
  canReview,
}: {
  orderId: string;
  canSubmit: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendAction(
    action: "submit" | "review",
    payload?: { approve: boolean; reason?: string },
  ) {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        emailSent?: boolean;
        emailError?: string | null;
      };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível atualizar o pedido.");
        return;
      }
      setStatusMessage(
        result.emailSent === false
          ? `${result.message ?? "Decisão registrada."} ${result.emailError ?? "O e-mail não foi enviado; a notificação interna está disponível."}`
          : result.message ?? "Ação concluída.",
      );
      router.refresh();
    } catch {
      setErrorMessage(
        "Não foi possível conectar ao serviço. Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason) {
      setErrorMessage("Informe o motivo da rejeição.");
      return;
    }
    void sendAction("review", { approve: false, reason });
  }

  return (
    <div className="sales-order-actions">
      {canSubmit ? (
        <button
          className="button"
          disabled={isSubmitting}
          onClick={() => void sendAction("submit")}
          type="button"
        >
          Enviar para aprovação
        </button>
      ) : null}
      {canReview ? (
        <div className="sales-order-review">
          <button
            className="button"
            disabled={isSubmitting}
            onClick={() => void sendAction("review", { approve: true })}
            type="button"
          >
            Aprovar pedido
          </button>
          <form className="form" onSubmit={handleReject}>
            <label className="field" htmlFor="order-rejection-reason">
              Motivo da rejeição
              <textarea
                className="input crm-textarea"
                id="order-rejection-reason"
                maxLength={1000}
                name="reason"
                required
                rows={2}
              />
            </label>
            <button
              className="secondary-button"
              disabled={isSubmitting}
              type="submit"
            >
              Rejeitar pedido
            </button>
          </form>
        </div>
      ) : null}
      {errorMessage ? (
        <p aria-live="polite" className="notice" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {statusMessage ? (
        <p aria-live="polite" className="success-notice" role="status">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
