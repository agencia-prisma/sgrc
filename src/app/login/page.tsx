import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section aria-labelledby="login-title" className="auth-card">
        <p className="brand">SGRC · Wax Brasil</p>
        <h1 className="title" id="login-title">
          Entrar
        </h1>
        <p className="description">
          Acesse com a conta criada para você no sistema.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
