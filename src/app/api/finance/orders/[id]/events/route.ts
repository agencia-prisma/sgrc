import { NextRequest, NextResponse } from "next/server";
import { requireFinanceAccess } from "@/lib/auth/require-finance-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "O registro financeiro está desabilitado fora da produção." },
      { status: 503 },
    );
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }

  const authorization = await requireFinanceAccess();
  if ("response" in authorization) return authorization.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "O pedido informado é inválido." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "O conteúdo enviado não é um JSON válido." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Os dados financeiros são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  if (input.eventType === "invoice") {
    if (
      typeof input.invoiceNumber !== "string" ||
      !input.invoiceNumber.trim() ||
      input.invoiceNumber.trim().length > 120 ||
      !isValidDate(input.date)
    ) {
      return NextResponse.json(
        { error: "Informe o número e a data válidos da nota fiscal." },
        { status: 400 },
      );
    }

    const { error } = await authorization.supabase.rpc(
      "record_sales_order_invoice",
      {
        target_order_id: id,
        target_invoice_number: input.invoiceNumber.trim(),
        target_invoice_date: input.date,
        target_source: "manual",
        target_external_event_id: null,
      },
    );
    if (error) {
      console.error("Sales order invoice registration failed.", {
        code: error.code,
      });
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "Este pedido já possui uma nota fiscal registrada."
              : "Não foi possível registrar a nota fiscal. Confira o pedido e os dados.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: "Nota fiscal registrada." });
  }

  if (
    input.eventType !== "payment_received" ||
    typeof input.amount !== "number" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    Math.round(input.amount * 100) !== input.amount * 100 ||
    !isValidDate(input.date)
  ) {
    return NextResponse.json(
      { error: "Informe o valor e a data válidos do recebimento." },
      { status: 400 },
    );
  }

  const { error } = await authorization.supabase.rpc(
    "record_sales_order_payment",
    {
      target_order_id: id,
      target_amount: input.amount,
      target_payment_date: input.date,
      target_source: "manual",
      target_external_event_id: null,
    },
  );
  if (error) {
    console.error("Sales order payment registration failed.", {
      code: error.code,
    });
    return NextResponse.json(
      {
        error:
          "Não foi possível registrar o recebimento. Confira o saldo, a data e se o pedido já está faturado.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ message: "Recebimento registrado." });
}
