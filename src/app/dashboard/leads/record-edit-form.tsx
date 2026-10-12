"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CRM_STATUS_LABELS,
  CRM_TYPE_LABELS,
} from "@/lib/crm";
import type {
  CrmRecordStatus,
  CrmRecordType,
} from "@/lib/supabase/database.types";

type TerritoryOption = { id: string; label: string; isActive: boolean };
type OwnerOption = { id: string; label: string; isActive: boolean };

export default function RecordEditForm({
  id,
  record,
  territories,
  owners,
  ownershipProtected = false,
}: {
  id: string;
  record: {
    record_type: CrmRecordType;
    name: string;
    trade_name: string | null;
    document: string | null;
    email: string | null;
    phone: string | null;
    status: CrmRecordStatus;
    territory_id: string | null;
    owner_user_id: string;
    notes: string | null;
  };
  territories: TerritoryOption[];
  owners: OwnerOption[];
  ownershipProtected?: boolean;
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
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/crm/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          tradeName: formData.get("trade-name"),
          document: formData.get("document"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          status: formData.get("status"),
          territoryId: formData.get("territory-id") || null,
          ...(owners.length > 1 && !ownershipProtected
            ? { ownerUserId: formData.get("owner-user-id") }
            : {}),
          notes: formData.get("notes"),
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível atualizar o cadastro.");
        return;
      }
      setMessage(result.message ?? "Cadastro atualizado.");
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
      <label className="field" htmlFor="edit-record-name">
        {record.record_type === "company" ? "Razão social / nome" : "Nome completo"}
        <input
          className="input"
          defaultValue={record.name}
          id="edit-record-name"
          maxLength={160}
          name="name"
          required
        />
      </label>

      {record.record_type === "company" ? (
        <label className="field" htmlFor="edit-record-trade-name">
          Nome fantasia
          <input
            className="input"
            defaultValue={record.trade_name ?? ""}
            id="edit-record-trade-name"
            maxLength={160}
            name="trade-name"
          />
        </label>
      ) : null}

      <label className="field" htmlFor="edit-record-document">
        {record.record_type === "company" ? "CNPJ" : "CPF"}
        <input
          className="input"
          defaultValue={record.document ?? ""}
          id="edit-record-document"
          inputMode={record.record_type === "person" ? "numeric" : "text"}
          maxLength={18}
          name="document"
        />
      </label>

      <label className="field" htmlFor="edit-record-email">
        E-mail
        <input
          className="input"
          defaultValue={record.email ?? ""}
          id="edit-record-email"
          maxLength={254}
          name="email"
          type="email"
        />
      </label>

      <label className="field" htmlFor="edit-record-phone">
        Telefone / WhatsApp
        <input
          className="input"
          defaultValue={record.phone ?? ""}
          id="edit-record-phone"
          maxLength={32}
          name="phone"
          type="tel"
        />
      </label>

      <label className="field" htmlFor="edit-record-status">
        Etapa
        <select
          className="input"
          defaultValue={record.status}
          id="edit-record-status"
          name="status"
        >
          {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor="edit-record-territory">
        Território
        <select
          className="input"
          defaultValue={record.territory_id ?? ""}
          id="edit-record-territory"
          name="territory-id"
        >
          <option value="">Sem território</option>
          {territories.map((territory) => (
            <option
              key={territory.id}
              disabled={
                !territory.isActive &&
                territory.id !== record.territory_id
              }
              value={territory.id}
            >
              {territory.label}
              {!territory.isActive ? " (inativo)" : ""}
            </option>
          ))}
        </select>
      </label>

      {owners.length > 1 ? (
        <label className="field" htmlFor="edit-record-owner">
          Responsável
          <select
            className="input"
            defaultValue={record.owner_user_id}
            disabled={ownershipProtected}
            id="edit-record-owner"
            name="owner-user-id"
          >
            {owners.map((owner) => (
              <option
                key={owner.id}
                  disabled={!owner.isActive && owner.id !== record.owner_user_id}
                value={owner.id}
              >
                {owner.label}
                {!owner.isActive ? " (inativo)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {ownershipProtected ? (
        <p className="field-help crm-field-wide">
          A carteira está protegida. A alteração do responsável só pode ser
          feita após as aprovações de transferência.
        </p>
      ) : null}

      <label className="field crm-field-wide" htmlFor="edit-record-notes">
        Observações
        <textarea
          className="input crm-textarea"
          defaultValue={record.notes ?? ""}
          id="edit-record-notes"
          maxLength={4000}
          name="notes"
          rows={4}
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
        {isSubmitting ? "Salvando..." : "Salvar alterações"}
      </button>
      <p className="field-help crm-field-wide">
        Tipo: {CRM_TYPE_LABELS[record.record_type]}.
      </p>
    </form>
  );
}
