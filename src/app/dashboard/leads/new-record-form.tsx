"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CrmRecordType } from "@/lib/supabase/database.types";

type SelectOption = { id: string; label: string };

export default function NewRecordForm({
  owners,
  territories,
  currentUserId,
}: {
  owners: SelectOption[];
  territories: SelectOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [recordType, setRecordType] = useState<CrmRecordType>("company");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/crm/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType,
          name: formData.get("name"),
          tradeName: formData.get("trade-name"),
          document: formData.get("document"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          territoryId: formData.get("territory-id") || null,
          ownerUserId: formData.get("owner-user-id") || currentUserId,
          notes: formData.get("notes"),
        }),
      });
      const result = (await response.json()) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !result.id) {
        setErrorMessage(result.error ?? "Não foi possível criar o cadastro.");
        return;
      }
      router.push(`/dashboard/leads/${result.id}`);
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
    <form className="form crm-form" onSubmit={handleSubmit}>
      <label className="field" htmlFor="crm-record-type">
        Tipo de cadastro
        <select
          className="input"
          id="crm-record-type"
          onChange={(event) =>
            setRecordType(event.target.value as CrmRecordType)
          }
          value={recordType}
        >
          <option value="company">Empresa / loja</option>
          <option value="person">Pessoa física</option>
        </select>
      </label>

      <label className="field" htmlFor="crm-record-name">
        {recordType === "company" ? "Razão social / nome" : "Nome completo"}
        <input
          autoComplete="name"
          className="input"
          id="crm-record-name"
          maxLength={160}
          name="name"
          required
        />
      </label>

      {recordType === "company" ? (
        <label className="field" htmlFor="crm-trade-name">
          Nome fantasia
          <input
            className="input"
            id="crm-trade-name"
            maxLength={160}
            name="trade-name"
          />
        </label>
      ) : null}

      <label className="field" htmlFor="crm-document">
        {recordType === "company" ? "CNPJ" : "CPF"}
        <input
          className="input"
          id="crm-document"
          inputMode={recordType === "person" ? "numeric" : "text"}
          maxLength={18}
          name="document"
          placeholder={
            recordType === "company"
              ? "CNPJ numérico ou alfanumérico"
              : "Somente números"
          }
        />
      </label>

      <label className="field" htmlFor="crm-email">
        E-mail
        <input
          autoComplete="email"
          className="input"
          id="crm-email"
          maxLength={254}
          name="email"
          type="email"
        />
      </label>

      <label className="field" htmlFor="crm-phone">
        Telefone / WhatsApp
        <input
          autoComplete="tel"
          className="input"
          id="crm-phone"
          maxLength={32}
          name="phone"
          type="tel"
        />
      </label>

      <label className="field" htmlFor="crm-territory-id">
        Território
        <select
          className="input"
          defaultValue=""
          id="crm-territory-id"
          name="territory-id"
        >
          <option value="">Sem território</option>
          {territories.map((territory) => (
            <option key={territory.id} value={territory.id}>
              {territory.label}
            </option>
          ))}
        </select>
      </label>

      {owners.length > 1 ? (
        <label className="field" htmlFor="crm-owner-user-id">
          Responsável
          <select
            className="input"
            defaultValue={currentUserId}
            id="crm-owner-user-id"
            name="owner-user-id"
          >
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field crm-field-wide" htmlFor="crm-notes">
        Observações iniciais
        <textarea
          className="input crm-textarea"
          id="crm-notes"
          maxLength={4000}
          name="notes"
          rows={3}
        />
      </label>

      {errorMessage ? (
        <p aria-live="polite" className="notice crm-field-wide" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button className="button crm-field-wide" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Salvando..." : "Cadastrar"}
      </button>
    </form>
  );
}
