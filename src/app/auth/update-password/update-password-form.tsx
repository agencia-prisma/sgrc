"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(
      formData.get("password-confirmation") ?? "",
    );

    if (password !== passwordConfirmation) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(
          "Não foi possível definir a senha. Solicite um novo link e tente novamente.",
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
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
      <label className="field" htmlFor="password">
        Nova senha
        <input
          autoComplete="new-password"
          className="input"
          id="password"
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>

      <label className="field" htmlFor="password-confirmation">
        Confirmar senha
        <input
          autoComplete="new-password"
          className="input"
          id="password-confirmation"
          minLength={6}
          name="password-confirmation"
          required
          type="password"
        />
      </label>

      {errorMessage ? (
        <p aria-live="polite" className="notice" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Salvando..." : "Definir senha"}
      </button>
    </form>
  );
}
