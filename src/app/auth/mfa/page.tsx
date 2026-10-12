import { redirect } from "next/navigation";
import { hasRequiredMfaRole } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import MfaSetup from "./mfa-setup";

export default async function MfaPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("MFA page session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }

  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesError) {
    console.error("MFA page role lookup failed.", { code: rolesError.code });
    throw new Error("Não foi possível validar as permissões.");
  }

  if (!hasRequiredMfaRole(roles.map(({ role }) => role))) {
    redirect("/dashboard");
  }

  if (claimsData.claims.aal === "aal2") {
    redirect("/dashboard");
  }

  return (
    <main className="page-shell">
      <section aria-labelledby="mfa-title" className="auth-card">
        <p className="brand">SGRC · Wax Brasil</p>
        <h1 className="title" id="mfa-title">
          Proteja sua conta
        </h1>
        <p className="description">
          Seu perfil exige autenticação em dois fatores. Configure um
          autenticador ou informe o código de seis dígitos para continuar.
        </p>
        <MfaSetup />
      </section>
    </main>
  );
}
