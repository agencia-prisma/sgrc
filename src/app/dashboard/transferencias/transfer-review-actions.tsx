"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TransferReviewActions({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function review(approve: boolean) {
    const reason = approve
      ? null
      : window.prompt("Informe o motivo obrigatório da rejeição.")?.trim();
    if (!approve && !reason) {
      setErrorMessage("Informe o motivo para rejeitar a transferência.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/crm/transfer-requests/${requestId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approve, reason }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(
          result.error ?? "Não foi possível decidir a transferência.",
        );
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage(
        "Não foi possível conectar ao serviço. Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="crm-transfer-actions">
        <button
          className="button"
          disabled={isSubmitting}
          onClick={() => void review(true)}
          type="button"
        >
          Aprovar etapa
        </button>
        <button
          className="button secondary-button"
          disabled={isSubmitting}
          onClick={() => void review(false)}
          type="button"
        >
          Rejeitar
        </button>
      </div>
      {errorMessage ? (
        <p aria-live="polite" className="notice" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
