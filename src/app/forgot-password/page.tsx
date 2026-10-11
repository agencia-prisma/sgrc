import Link from "next/link";
import ForgotPasswordForm from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="page-shell">
      <section aria-labelledby="forgot-password-title" className="auth-card">
        <p className="brand">SGRC · Wax Brasil</p>
        <h1 className="title" id="forgot-password-title">
          Definir senha
        </h1>
        <p className="description">
          Informe seu e-mail cadastrado. Enviaremos um link para você criar sua
          senha.
        </p>
        <ForgotPasswordForm />
        <Link className="text-link" href="/login">
          Voltar para entrar
        </Link>
      </section>
    </main>
  );
}
