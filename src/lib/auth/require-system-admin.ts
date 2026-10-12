import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireSystemAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    console.error("System administrator session validation failed.", {
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

  const { data: adminRole, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError) {
    console.error("System administrator role lookup failed.", {
      code: roleError.code,
    });
    return {
      response: NextResponse.json(
        { error: "Não foi possível validar as permissões." },
        { status: 503 },
      ),
    };
  }

  if (!adminRole) {
    return {
      response: NextResponse.json(
        { error: "Apenas o super administrador pode gerenciar usuários." },
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
