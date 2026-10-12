"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MfaState =
  | { status: "loading" }
  | { status: "setup" }
  | { status: "enrolling" }
  | { status: "enrollment"; factorId: string; qrCode: string; secret: string }
  | { status: "challenge"; factorId: string };

function asQrImageSource(qrCode: string) {
  if (qrCode.startsWith("data:")) return qrCode;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
}

export default function MfaSetup() {
  const router = useRouter();
  const [state, setState] = useState<MfaState>({ status: "loading" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadFactors() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (!isCurrent) return;
      if (error) {
        setErrorMessage(
          "Não foi possível consultar os fatores de autenticação. Tente novamente.",
        );
        setState({ status: "setup" });
        return;
      }

      const verifiedTotp = data.all.find(
        (factor) =>
          factor.factor_type === "totp" && factor.status === "verified",
      );
      setState(
        verifiedTotp
          ? { status: "challenge", factorId: verifiedTotp.id }
          : { status: "setup" },
      );
    }

    void loadFactors();
    return () => {
      isCurrent = false;
    };
  }, []);

  async function startEnrollment() {
    setErrorMessage(null);
    setState({ status: "enrolling" });

    try {
      const supabase = createClient();
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setErrorMessage(
          "Não foi possível consultar os fatores existentes. Tente novamente.",
        );
        setState({ status: "setup" });
        return;
      }

      const pendingFactors = factors.all.filter(
        (factor) =>
          factor.factor_type === "totp" && factor.status === "unverified",
      );
      for (const factor of pendingFactors) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (error) {
          setErrorMessage(
            "Não foi possível reiniciar a configuração pendente. Tente novamente.",
          );
          setState({ status: "setup" });
          return;
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SGRC Authenticator",
        issuer: "Wax Brasil",
      });

      if (error) {
        setErrorMessage(
          "Não foi possível iniciar a configuração do autenticador. Tente novamente.",
        );
        setState({ status: "setup" });
        return;
      }

      setState({
        status: "enrollment",
        factorId: data.id,
        qrCode: asQrImageSource(data.totp.qr_code),
        secret: data.totp.secret,
      });
    } catch {
      setErrorMessage(
        "O serviço de autenticação está indisponível. Tente novamente.",
      );
      setState({ status: "setup" });
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("code") ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("Informe o código de seis dígitos do autenticador.");
      setIsSubmitting(false);
      return;
    }

    if (state.status !== "challenge" && state.status !== "enrollment") {
      setErrorMessage("A configuração do autenticador precisa ser reiniciada.");
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: state.factorId,
        code,
      });

      if (error) {
        setErrorMessage(
          "Código inválido ou expirado. Confira o autenticador e tente novamente.",
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage(
        "O serviço de autenticação está indisponível. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        setErrorMessage("Não foi possível encerrar as sessões da conta.");
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
    <div className="form">
      {state.status === "loading" || state.status === "enrolling" ? (
        <p aria-live="polite" className="description" role="status">
          {state.status === "loading"
            ? "Verificando a configuração..."
            : "Preparando o autenticador..."}
        </p>
      ) : null}

      {state.status === "setup" ? (
        <>
          <p className="description">
            Use um aplicativo autenticador compatível com TOTP, como Microsoft
            Authenticator, Google Authenticator ou 1Password.
          </p>
          <button
            className="button"
            onClick={() => void startEnrollment()}
            type="button"
          >
            Configurar autenticador
          </button>
        </>
      ) : null}

      {state.status === "enrollment" ? (
        <>
          <div className="mfa-qr">
            <Image
              alt="Código QR para adicionar o SGRC ao aplicativo autenticador"
              height={220}
              src={state.qrCode}
              unoptimized
              width={220}
            />
          </div>
          <p className="description">
            Escaneie o código QR. Se não puder escaneá-lo, informe esta chave
            manualmente no aplicativo:
          </p>
          <code className="mfa-secret">{state.secret}</code>
          <p className="description">
            Digite o código exibido no aplicativo para confirmar e ativar o
            segundo fator.
          </p>
          <form className="form" onSubmit={verifyCode}>
            <label className="field" htmlFor="mfa-code">
              Código de autenticação
              <input
                autoComplete="one-time-code"
                autoFocus
                className="input"
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                name="code"
                pattern="[0-9]{6}"
                required
              />
            </label>
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Verificando..." : "Ativar MFA"}
            </button>
          </form>
        </>
      ) : null}

      {state.status === "challenge" ? (
        <form className="form" onSubmit={verifyCode}>
          <label className="field" htmlFor="mfa-code">
            Código de autenticação
            <input
              autoComplete="one-time-code"
              autoFocus
              className="input"
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="code"
              pattern="[0-9]{6}"
              required
            />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Verificando..." : "Confirmar código"}
          </button>
        </form>
      ) : null}

      {errorMessage ? (
        <p aria-live="polite" className="notice" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="secondary-button"
        disabled={isSubmitting}
        onClick={() => void signOut()}
        type="button"
      >
        Sair de todas as sessões
      </button>
    </div>
  );
}
