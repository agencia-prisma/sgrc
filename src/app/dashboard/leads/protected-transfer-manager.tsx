"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  CrmTransferStatus,
} from "@/lib/supabase/database.types";

type TransferRequest = {
  id: string;
  requested_by: string;
  source_owner_user_id: string;
  target_owner_user_id: string;
  required_manager_user_id: string;
  status: CrmTransferStatus;
  reason: string;
  manager_decision: string | null;
  manager_decided_by: string | null;
  manager_decision_reason: string | null;
  director_decision: string | null;
  director_decided_by: string | null;
  director_decision_reason: string | null;
  created_at: string;
};

type OwnerOption = { id: string; label: string };

const STATUS_LABELS: Record<CrmTransferStatus, string> = {
  pending_manager: "Aguardando gerente",
  pending_director: "Aguardando diretoria",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

export default function ProtectedTransferManager({
  customerId,
  protectedUntil,
  protectedOwnerUserId,
  currentUserId,
  canRequest,
  canReviewDirector,
  owners,
  requests,
  profileLabels,
}: {
  customerId: string;
  protectedUntil: string;
  protectedOwnerUserId: string;
  currentUserId: string;
  canRequest: boolean;
  canReviewDirector: boolean;
  owners: OwnerOption[];
  requests: TransferRequest[];
  profileLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRequest = requests.find(
    (request) =>
      request.status === "pending_manager" ||
      request.status === "pending_director",
  );
  const managerCanReview =
    pendingRequest?.status === "pending_manager" &&
    pendingRequest.required_manager_user_id === currentUserId &&
    pendingRequest.requested_by !== currentUserId;
  const directorCanReview =
    pendingRequest?.status === "pending_director" &&
    canReviewDirector &&
    pendingRequest.requested_by !== currentUserId &&
    pendingRequest.manager_decided_by !== currentUserId;
  const transferTargets = owners.filter(
    (owner) => owner.id !== protectedOwnerUserId,
  );

  async function send(
    url: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setErrorMessage(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível concluir a operação.");
        return false;
      }
      setMessage(result.message ?? "Operação concluída.");
      router.refresh();
      return true;
    } catch {
      setErrorMessage(
        "Não foi possível conectar ao serviço. Tente novamente em instantes.",
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await send(`/api/crm/records/${customerId}/transfer-requests`, {
      targetOwnerUserId: formData.get("target-owner"),
      reason: formData.get("reason"),
    });
  }

  async function handleReview(approve: boolean) {
    if (!pendingRequest) return;
    const reason = approve
      ? null
      : window.prompt("Informe o motivo obrigatório da rejeição.")?.trim();
    if (!approve && !reason) {
      setErrorMessage("Informe o motivo para rejeitar a transferência.");
      return;
    }
    await send(`/api/crm/transfer-requests/${pendingRequest.id}/review`, {
      approve,
      reason,
    });
  }

  return (
    <div className="crm-protection-content">
      <p>
        A carteira está protegida até{" "}
        <strong>
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
            new Date(`${protectedUntil}T12:00:00`),
          )}
        </strong>
        . Uma transferência exige validação do gerente e, depois, da diretoria.
      </p>

      {pendingRequest ? (
        <div className="crm-transfer-request">
          <p>
            <strong>{STATUS_LABELS[pendingRequest.status]}</strong>
            {" · "}
            Solicitada para{" "}
            {profileLabels[pendingRequest.target_owner_user_id] ?? "novo responsável"}
          </p>
          <p>{pendingRequest.reason}</p>
          <p className="field-help">
            Origem:{" "}
            {profileLabels[pendingRequest.source_owner_user_id] ?? "Responsável"}
            {" · Solicitada por "}
            {profileLabels[pendingRequest.requested_by] ?? "Usuário"}
          </p>
          {pendingRequest.manager_decision_reason ? (
            <p>Observação do gerente: {pendingRequest.manager_decision_reason}</p>
          ) : null}
          {pendingRequest.director_decision_reason ? (
            <p>Observação da diretoria: {pendingRequest.director_decision_reason}</p>
          ) : null}
          {managerCanReview || directorCanReview ? (
            <div className="crm-transfer-actions">
              <button
                className="button"
                disabled={isSubmitting}
                onClick={() => void handleReview(true)}
                type="button"
              >
                Aprovar etapa
              </button>
              <button
                className="button secondary-button"
                disabled={isSubmitting}
                onClick={() => void handleReview(false)}
                type="button"
              >
                Rejeitar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!pendingRequest && canRequest ? (
        transferTargets.length > 0 ? (
          <form className="form crm-form" onSubmit={handleRequest}>
            <label className="field" htmlFor={`transfer-owner-${customerId}`}>
              Novo responsável
              <select
                className="input"
                defaultValue=""
                id={`transfer-owner-${customerId}`}
                name="target-owner"
                required
              >
                <option disabled value="">
                  Selecione um representante elegível
                </option>
                {transferTargets.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.label}
                    </option>
                  ))}
              </select>
            </label>
            <label
              className="field crm-field-wide"
              htmlFor={`transfer-reason-${customerId}`}
            >
              Justificativa
              <textarea
                className="input crm-textarea"
                id={`transfer-reason-${customerId}`}
                maxLength={1000}
                name="reason"
                required
                rows={3}
              />
            </label>
            <button className="button crm-field-wide" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enviando..." : "Solicitar transferência"}
            </button>
          </form>
        ) : (
          <p className="field-help">
            Não há outro representante ativo elegível para receber este
            cadastro no território atual.
          </p>
        )
      ) : null}

      {requests.length > 0 ? (
        <details className="crm-transfer-history">
          <summary>Histórico de solicitações ({requests.length})</summary>
          <ol className="crm-timeline">
            {requests.map((request) => (
              <li key={request.id}>
                <div className="crm-timeline-heading">
                  <strong>{STATUS_LABELS[request.status]}</strong>
                  <time dateTime={request.created_at}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                    }).format(new Date(request.created_at))}
                  </time>
                </div>
                <p>{request.reason}</p>
                <small>
                  {profileLabels[request.source_owner_user_id] ?? "Responsável"}
                  {" → "}
                  {profileLabels[request.target_owner_user_id] ?? "Novo responsável"}
                </small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

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
    </div>
  );
}
