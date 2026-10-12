"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function ProductForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: formData.get("sku"),
          name: formData.get("name"),
          price: formData.get("price"),
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) {
        setErrorMessage(result.error ?? "Não foi possível cadastrar o produto.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setErrorMessage(
        "Não foi possível conectar ao serviço. Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form product-form" onSubmit={handleSubmit}>
      <label className="field" htmlFor="product-sku">
        SKU
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="input"
          id="product-sku"
          maxLength={40}
          name="sku"
          placeholder="Ex.: WAX-001"
          required
        />
      </label>
      <label className="field" htmlFor="product-name">
        Nome do produto
        <input
          className="input"
          id="product-name"
          maxLength={160}
          name="name"
          required
        />
      </label>
      <label className="field" htmlFor="product-price">
        Preço (R$)
        <input
          className="input"
          id="product-price"
          inputMode="decimal"
          maxLength={13}
          name="price"
          placeholder="0,00"
          required
        />
      </label>
      {errorMessage ? (
        <p aria-live="polite" className="notice product-field-wide" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button
        className="button product-submit"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Salvando..." : "Adicionar produto"}
      </button>
    </form>
  );
}
