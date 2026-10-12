"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CRM_INTERACTION_LABELS } from "@/lib/crm";

export default function AddInteractionForm({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setMessage(null);
    setIsSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch(
        `/api/crm/records/${recordId}/interactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interactionType: formData.get("interaction-type"),
            summary: formData.get("summary"),
            details: formData.get("details"),
          }),
        },
      );
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível registrar o contato.");
        return;
      }
      setMessage(result.message ?? "Contato registrado.");
      form.reset();
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
    <form className="form crm-interaction-form" onSubmit={handleSubmit}>
      <label className="field" htmlFor="interaction-type">
        Tipo de contato
        <select
          className="input"
          defaultValue="call"
          id="interaction-type"
          name="interaction-type"
        >
          {Object.entries(CRM_INTERACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="interaction-summary">
        Resumo
        <input
          className="input"
          id="interaction-summary"
          maxLength={160}
          name="summary"
          required
        />
      </label>
      <label className="field crm-field-wide" htmlFor="interaction-details">
        Detalhes
        <textarea
          className="input crm-textarea"
          id="interaction-details"
          maxLength={4000}
          name="details"
          rows={3}
        />
      </label>
      {message ? (
        <p aria-live="polite" className="success-notice crm-field-wide" role="status">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p aria-live="polite" className="notice crm-field-wide" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button className="button crm-field-wide" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Registrando..." : "Registrar contato"}
      </button>
    </form>
  );
}
