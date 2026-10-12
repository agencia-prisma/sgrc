import "server-only";

import type { SalesOrderStatus } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewOutcome = Extract<SalesOrderStatus, "approved" | "rejected">;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function updateEmailStatus(
  admin: ReturnType<typeof createAdminClient>,
  notificationId: string,
  status: "sent" | "failed",
) {
  const { error } = await admin
    .from("sales_order_notifications")
    .update({ email_status: status })
    .eq("id", notificationId);

  if (error) {
    console.error("Sales order email status update failed.", {
      code: error.code,
      notificationId,
    });
  }
}

export async function sendSalesOrderReviewEmail({
  orderId,
  ownerUserId,
  customerName,
  outcome,
  rejectionReason,
}: {
  orderId: string;
  ownerUserId: string;
  customerName: string;
  outcome: ReviewOutcome;
  rejectionReason: string | null;
}) {
  const admin = createAdminClient();
  const { data: notification, error: notificationError } = await admin
    .from("sales_order_notifications")
    .select("id, email_status")
    .eq("order_id", orderId)
    .eq("notification_type", outcome)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (notificationError || !notification) {
    console.error("Sales order email notification lookup failed.", {
      code: notificationError?.code,
      orderId,
      outcome,
    });
    return {
      sent: false,
      error: "A notificação interna foi criada, mas não foi possível preparar o e-mail.",
    };
  }

  if (notification.email_status === "sent") {
    return { sent: true, error: null };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!apiKey || !from || !appUrl) {
    await updateEmailStatus(admin, notification.id, "failed");
    console.error("Sales order email configuration is incomplete.", {
      hasApiKey: Boolean(apiKey),
      hasFromAddress: Boolean(from),
      hasAppUrl: Boolean(appUrl),
    });
    return {
      sent: false,
      error: "E-mail não configurado. Configure o Resend e a URL pública da aplicação.",
    };
  }

  let orderUrl: string;
  try {
    const baseUrl = new URL(appUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
      throw new Error("Unsupported application URL protocol.");
    }
    orderUrl = new URL(`/dashboard/pedidos/${orderId}`, baseUrl).toString();
  } catch {
    await updateEmailStatus(admin, notification.id, "failed");
    console.error("Sales order email application URL is invalid.");
    return {
      sent: false,
      error: "E-mail não enviado: a URL pública da aplicação está inválida.",
    };
  }

  const { data: authUserResult, error: authUserError } =
    await admin.auth.admin.getUserById(ownerUserId);
  const recipientEmail = authUserResult.user?.email;
  if (authUserError || !recipientEmail) {
    await updateEmailStatus(admin, notification.id, "failed");
    console.error("Sales order email recipient lookup failed.", {
      code: authUserError?.code,
      ownerUserId,
    });
    return {
      sent: false,
      error: "A notificação interna foi criada, mas não há um e-mail válido para o responsável.",
    };
  }

  const approved = outcome === "approved";
  const subject = approved
    ? `Pedido aprovado: ${customerName}`
    : `Pedido rejeitado: ${customerName}`;
  const outcomeText = approved
    ? "Seu pedido foi aprovado."
    : `Seu pedido foi rejeitado. Motivo: ${rejectionReason ?? "Não informado."}`;
  const html = [
    `<p>${escapeHtml(outcomeText)}</p>`,
    `<p>Cliente: ${escapeHtml(customerName)}</p>`,
    `<p><a href="${escapeHtml(orderUrl)}">Abrir pedido no SGRC</a></p>`,
  ].join("");

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `sales-order-review-${notification.id}`,
      },
      body: JSON.stringify({
        from,
        to: [recipientEmail],
        subject,
        html,
        text: `${outcomeText}\n\nCliente: ${customerName}\n\nAbrir pedido: ${orderUrl}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    await updateEmailStatus(admin, notification.id, "failed");
    console.error("Sales order email request failed.", {
      notificationId: notification.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      sent: false,
      error: "A notificação interna foi criada, mas o serviço de e-mail não respondeu.",
    };
  }

  if (!response.ok) {
    await updateEmailStatus(admin, notification.id, "failed");
    console.error("Sales order email provider rejected the request.", {
      notificationId: notification.id,
      status: response.status,
    });
    return {
      sent: false,
      error: "A notificação interna foi criada, mas o serviço de e-mail recusou o envio.",
    };
  }

  await updateEmailStatus(admin, notification.id, "sent");
  return { sent: true, error: null };
}
