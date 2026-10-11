import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialMessage =
    error === "auth_link"
      ? "O link expirou ou já foi utilizado. Solicite uma nova definição de senha."
      : undefined;

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
        <LoginForm initialMessage={initialMessage} />
      </section>
    </main>
  );
}
