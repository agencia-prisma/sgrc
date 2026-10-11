import { NextRequest, NextResponse } from "next/server";
import { requireCommercialAdmin } from "@/lib/auth/require-commercial-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      {
        error:
          "Alterações de territórios estão desabilitadas fora do ambiente de produção.",
      },
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
  if ("response" in authorization) {
    return authorization.response;
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
      { error: "Os dados do território são inválidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (
    input.code !== undefined &&
    input.code !== null &&
    typeof input.code !== "string"
  ) {
    return NextResponse.json(
      { error: "O código do território deve ser um texto." },
      { status: 400 },
    );
  }
  if (
    input.parentId !== undefined &&
    input.parentId !== null &&
    typeof input.parentId !== "string"
  ) {
    return NextResponse.json(
      { error: "Selecione um território superior válido." },
      { status: 400 },
    );
  }
  const code =
    typeof input.code === "string" && input.code.trim()
      ? input.code.trim()
      : null;
  const parentId =
    typeof input.parentId === "string" && input.parentId
      ? input.parentId
      : null;

  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "O nome deve ter entre 1 e 120 caracteres." },
      { status: 400 },
    );
  }

  if (code && code.length > 32) {
    return NextResponse.json(
      { error: "O código deve ter no máximo 32 caracteres." },
      { status: 400 },
    );
  }

  if (parentId && !UUID_PATTERN.test(parentId)) {
    return NextResponse.json(
      { error: "Selecione um território superior válido." },
      { status: 400 },
    );
  }

  if (parentId) {
    const { data: parent, error: parentError } = await authorization.supabase
      .from("territories")
      .select("id")
      .eq("id", parentId)
      .eq("is_active", true)
      .maybeSingle();

    if (parentError) {
      console.error("Commercial parent territory lookup failed.", {
        code: parentError.code,
      });
      return NextResponse.json(
        { error: "Não foi possível validar o território superior." },
        { status: 503 },
      );
    }

    if (!parent) {
      return NextResponse.json(
        { error: "O território superior não existe ou está inativo." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await authorization.supabase
    .from("territories")
    .insert({ name, code, parent_id: parentId })
    .select("id, name")
    .single();

  if (error) {
    console.error("Commercial territory creation failed.", {
      code: error.code,
    });
    const duplicateCode = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicateCode
          ? "Esse código de território já está em uso."
          : "Não foi possível criar o território. Confira o território superior e tente novamente.",
      },
      { status: duplicateCode ? 409 : 400 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
