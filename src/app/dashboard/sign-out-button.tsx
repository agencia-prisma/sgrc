"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignOut() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("Não foi possível encerrar a sessão. Tente novamente.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("O serviço de autenticação está indisponível.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button
        className="secondary-button"
        disabled={isSubmitting}
        onClick={handleSignOut}
        type="button"
      >
        {isSubmitting ? "Saindo..." : "Sair"}
      </button>
      {errorMessage ? (
        <p aria-live="polite" className="notice" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
