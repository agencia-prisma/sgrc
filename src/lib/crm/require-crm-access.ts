import { NextResponse } from "next/server";
import { hasCrmRole } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

export async function requireCrmAccess() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    console.error("CRM session validation failed.", {
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
    .eq("user_id", userId);

  if (rolesError) {
    console.error("CRM role lookup failed.", { code: rolesError.code });
    return {
      response: NextResponse.json(
        { error: "Não foi possível validar as permissões." },
        { status: 503 },
      ),
    };
  }

  if (!roles.some(({ role }) => hasCrmRole(role))) {
    return {
      response: NextResponse.json(
        { error: "Você não tem permissão para acessar o CRM." },
        { status: 403 },
      ),
    };
  }

  return { supabase, userId };
}
