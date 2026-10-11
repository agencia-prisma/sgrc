import { NextRequest, NextResponse } from "next/server";
import { requireCommercialAdmin } from "@/lib/auth/require-commercial-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
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

  const admin = createAdminClient();
  const { data, error } = await admin
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
