import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ROLES = ["super_admin", "director"] as const;

export async function requireCommercialAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    console.error("Commercial administrator session validation failed.", {
      name: error.name,
      code: "code" in error ? error.code : undefined,
      status: "status" in error ? error.status : undefined,
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

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...ADMIN_ROLES]);

  if (rolesError) {
    console.error("Commercial administrator role lookup failed.", {
      code: rolesError.code,
    });
    return {
      response: NextResponse.json(
        { error: "Não foi possível validar as permissões." },
        { status: 503 },
      ),
    };
  }

  if (!roles || roles.length === 0) {
    return {
      response: NextResponse.json(
        { error: "Você não tem permissão para esta operação." },
        { status: 403 },
      ),
    };
  }

  return { supabase, userId };
}
