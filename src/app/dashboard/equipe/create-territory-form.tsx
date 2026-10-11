"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type TerritoryOption = { id: string; label: string };

export default function CreateTerritoryForm({
  territories,
}: {
  territories: TerritoryOption[];
}) {
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
      const response = await fetch("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          code: formData.get("code"),
          parentId: formData.get("parent-id") || null,
        }),
      });
      const result = (await response.json()) as { name?: string; error?: string };

      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível criar o território.");
        return;
      }

      setMessage(`Território "${result.name}" criado.`);
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
    <form className="form" onSubmit={handleSubmit}>
      <label className="field" htmlFor="territory-name">
        Nome
        <input
          className="input"
          id="territory-name"
          maxLength={120}
          name="name"
          required
        />
      </label>

      <label className="field" htmlFor="territory-code">
        Código (opcional)
        <input
          className="input"
          id="territory-code"
          maxLength={32}
          name="code"
        />
      </label>

      <label className="field" htmlFor="parent-id">
        Território superior (opcional)
        <select
          className="input"
          defaultValue=""
          id="parent-id"
          name="parent-id"
        >
          <option value="">Nenhum (território raiz)</option>
          {territories.map((territory) => (
            <option key={territory.id} value={territory.id}>
              {territory.label}
            </option>
          ))}
        </select>
      </label>

      {message ? (
        <p aria-live="polite" className="success-notice" role="status">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p aria-live="polite" className="notice" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Salvando..." : "Criar território"}
      </button>
    </form>
  );
}
