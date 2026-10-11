"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SelectOption = { id: string; label: string };

export default function InviteMemberForm({
  managers,
  territories,
}: {
  managers: SelectOption[];
  territories: SelectOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const territoryIds = Array.from(
      form.querySelector<HTMLSelectElement>("#territory-ids")?.selectedOptions ??
        [],
      (option) => option.value,
    );

    try {
      const response = await fetch("/api/admin/commercial-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          displayName: formData.get("display-name"),
          memberType: formData.get("member-type"),
          managerUserId: formData.get("manager-user-id") || null,
          territoryIds,
        }),
      });
      const result = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível concluir o convite.");
        return;
      }

      setMessage(result.message ?? "Convite enviado.");
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
      <label className="field" htmlFor="display-name">
        Nome completo
        <input
          autoComplete="name"
          className="input"
          id="display-name"
          maxLength={120}
          name="display-name"
          required
        />
      </label>

      <label className="field" htmlFor="member-email">
        E-mail
        <input
          autoComplete="email"
          className="input"
          id="member-email"
          name="email"
          required
          type="email"
        />
      </label>

      <label className="field" htmlFor="member-type">
        Tipo
        <select
          className="input"
          defaultValue="representative"
          id="member-type"
          name="member-type"
        >
          <option value="representative">Representante</option>
          <option value="promoter">Divulgador</option>
        </select>
      </label>

      <label className="field" htmlFor="manager-user-id">
        Gerente responsável
        <select
          className="input"
          defaultValue=""
          id="manager-user-id"
          name="manager-user-id"
        >
          <option value="">Sem gerente atribuído</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor="territory-ids">
        Territórios
        <select
          className="input multi-select"
          id="territory-ids"
          multiple
          name="territory-ids"
        >
          {territories.map((territory) => (
            <option key={territory.id} value={territory.id}>
              {territory.label}
            </option>
          ))}
        </select>
        <span className="field-help">
          Use Ctrl ou Command para selecionar mais de um.
        </span>
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
        {isSubmitting ? "Enviando convite..." : "Convidar membro"}
      </button>
    </form>
  );
}
