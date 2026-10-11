import UpdatePasswordForm from "./update-password-form";

export default function UpdatePasswordPage() {
  return (
    <main className="page-shell">
      <section aria-labelledby="update-password-title" className="auth-card">
        <p className="brand">SGRC · Wax Brasil</p>
        <h1 className="title" id="update-password-title">
          Criar senha
        </h1>
        <p className="description">
          Escolha uma senha para acessar sua conta.
        </p>
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
