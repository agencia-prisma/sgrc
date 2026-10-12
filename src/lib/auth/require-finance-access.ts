import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireFinanceAccess() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    console.error("Finance session validation failed.", {
      name: error.name,
      code: "code" in error ? error.code : undefined,
    });
    return {
      response: NextResponse.json(
        { error: "Não foi possível validar a sessão." },
        { status: 503 },
      ),
    };
  }

  const userId = data?.claims?.sub;
  if (!userId) {
    return {
      response: NextResponse.json(
        { error: "É necessário entrar no sistema." },
        { status: 401 },
      ),
    };
  }

  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["finance", "super_admin"])
    .limit(1)
    .maybeSingle();

  if (roleError) {
    console.error("Finance role lookup failed.", { code: roleError.code });
    return {
      response: NextResponse.json(
        { error: "Não foi possível validar as permissões." },
        { status: 503 },
      ),
    };
  }

  if (!role) {
    return {
      response: NextResponse.json(
        { error: "Esta operação é restrita ao perfil Financeiro." },
        { status: 403 },
      ),
    };
  }

  if (data.claims.aal !== "aal2") {
    return {
      response: NextResponse.json(
        { error: "Confirme o segundo fator para continuar." },
        { status: 403 },
      ),
    };
  }

  return { supabase, userId };
}
