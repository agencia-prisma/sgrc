import { NextRequest, NextResponse } from "next/server";
import { requireCommercialAdmin } from "@/lib/auth/require-commercial-admin";
import { normalizeProductSku, parseProductPrice } from "@/lib/products";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "Alterações no catálogo estão desabilitadas fora do ambiente de produção." },
      { status: 503 },
    );
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "A origem da solicitação não é permitida." },
      { status: 403 },
    );
  }

  const authorization = await requireCommercialAdmin();
  if ("response" in authorization) return authorization.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "O produto solicitado é inválido." },
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
      { error: "Os dados do produto são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const updates: {
    sku?: string;
    name?: string;
    price?: number;
    is_active?: boolean;
  } = {};

  if ("sku" in input) {
    if (typeof input.sku !== "string") {
      return NextResponse.json(
        { error: "O SKU deve ser um texto." },
        { status: 400 },
      );
    }
    const sku = normalizeProductSku(input.sku);
    if (!/^[A-Z0-9._-]{1,40}$/.test(sku)) {
      return NextResponse.json(
        { error: "O SKU deve ter até 40 caracteres: letras, números, ponto, hífen ou sublinhado." },
        { status: 400 },
      );
    }
    updates.sku = sku;
  }
  if ("name" in input) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 160) {
      return NextResponse.json(
        { error: "O nome deve ter entre 1 e 160 caracteres." },
        { status: 400 },
      );
    }
    updates.name = input.name.trim();
  }
  if ("price" in input) {
    const price =
      typeof input.price === "string"
        ? parseProductPrice(input.price)
        : typeof input.price === "number" && Number.isFinite(input.price)
          ? parseProductPrice(String(input.price))
          : null;
    if (price === null || price < 0 || price > 9_999_999_999.99) {
      return NextResponse.json(
        { error: "Informe um preço válido com até duas casas decimais." },
        { status: 400 },
      );
    }
    updates.price = price;
  }
  if ("isActive" in input) {
    if (typeof input.isActive !== "boolean") {
      return NextResponse.json(
        { error: "A situação do produto é inválida." },
        { status: 400 },
      );
    }
    updates.is_active = input.isActive;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Nenhuma alteração válida foi enviada." },
      { status: 400 },
    );
  }

  const { data: product, error } = await authorization.supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Product update failed.", { code: error.code });
    const duplicateSku = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicateSku
          ? "Já existe um produto com esse SKU."
          : "Não foi possível atualizar o produto.",
      },
      { status: duplicateSku ? 409 : 400 },
    );
  }
  if (!product) {
    return NextResponse.json(
      { error: "Produto não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: "Produto atualizado." });
}
