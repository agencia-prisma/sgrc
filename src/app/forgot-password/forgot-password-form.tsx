"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/auth/update-password");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo.toString(),
      });

      if (error) {
        setErrorMessage(
          "Não foi possível solicitar o link. Tente novamente em instantes.",
        );
        return;
      }

      setMessage(
        "Se este e-mail estiver cadastrado, você receberá um link para definir sua senha.",
      );
    } catch {
      setErrorMessage(
        "O serviço de autenticação está indisponível. Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field" htmlFor="email">
        E-mail
        <input
          autoComplete="username"
          className="input"
          id="email"
          name="email"
          required
          type="email"
        />
      </label>

      {message ? (
        <p aria-live="polite" className="notice" role="status">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p aria-live="polite" className="notice" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Enviando..." : "Enviar link"}
      </button>
    </form>
  );
}
