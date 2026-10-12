import { NextRequest, NextResponse } from "next/server";
import { requireCommercialAdmin } from "@/lib/auth/require-commercial-admin";
import { normalizeProductSku, parseProductPrice } from "@/lib/products";

function isSameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

function mutationDisabled() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production";
}

export async function POST(request: NextRequest) {
  if (mutationDisabled()) {
    return NextResponse.json(
      { error: "Alterações no catálogo estão desabilitadas fora do ambiente de produção." },
      { status: 503 },
    );
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }

  const authorization = await requireCommercialAdmin();
  if ("response" in authorization) return authorization.response;

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
      { error: "Os dados do produto são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const sku =
    typeof input.sku === "string" ? normalizeProductSku(input.sku) : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const price =
    typeof input.price === "string"
      ? parseProductPrice(input.price)
      : typeof input.price === "number" && Number.isFinite(input.price)
        ? parseProductPrice(String(input.price))
        : null;

  if (!/^[A-Z0-9._-]{1,40}$/.test(sku)) {
    return NextResponse.json(
      { error: "O SKU deve ter até 40 caracteres: letras, números, ponto, hífen ou sublinhado." },
      { status: 400 },
    );
  }
  if (!name || name.length > 160) {
    return NextResponse.json(
      { error: "O nome deve ter entre 1 e 160 caracteres." },
      { status: 400 },
    );
  }
  if (price === null || price < 0 || price > 9_999_999_999.99) {
    return NextResponse.json(
      { error: "Informe um preço válido com até duas casas decimais." },
      { status: 400 },
    );
  }

  const { data, error } = await authorization.supabase
    .from("products")
    .insert({ sku, name, price })
    .select("id")
    .single();
  if (error) {
    console.error("Product creation failed.", { code: error.code });
    const duplicateSku = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicateSku
          ? "Já existe um produto com esse SKU."
          : "Não foi possível cadastrar o produto.",
      },
      { status: duplicateSku ? 409 : 400 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
