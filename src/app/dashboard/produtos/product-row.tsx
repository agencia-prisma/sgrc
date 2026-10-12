"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  price: number;
  is_active: boolean;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

export default function ProductRow({
  product,
  canManage,
}: {
  product: ProductListItem;
  canManage: boolean;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function updateProduct(
    values: { sku: string; name: string; price: FormDataEntryValue | null } | {
      isActive: boolean;
    },
  ) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Não foi possível atualizar o produto.");
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage(
        "Não foi possível conectar ao serviço. Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void updateProduct({
      sku: String(form.get("sku") ?? ""),
      name: String(form.get("name") ?? ""),
      price: form.get("price"),
    });
  }

  return (
    <tr>
      {canManage ? (
        <td colSpan={4}>
          <form className="product-row-form" onSubmit={handleSubmit}>
            <label>
              <span className="sr-only">SKU</span>
              <input
                aria-label={`SKU de ${product.name}`}
                className="input"
                defaultValue={product.sku}
                maxLength={40}
                name="sku"
                required
              />
            </label>
            <label>
              <span className="sr-only">Nome do produto</span>
              <input
                aria-label={`Nome do produto ${product.name}`}
                className="input"
                defaultValue={product.name}
                maxLength={160}
                name="name"
                required
              />
            </label>
            <label>
              <span className="sr-only">Preço em reais</span>
              <input
                aria-label={`Preço de ${product.name} em reais`}
                className="input"
                defaultValue={product.price.toFixed(2).replace(".", ",")}
                inputMode="decimal"
                maxLength={13}
                name="price"
                required
              />
            </label>
            <span className={`product-status ${product.is_active ? "is-active" : "is-inactive"}`}>
              {product.is_active ? "Ativo" : "Inativo"}
            </span>
            <div className="product-row-actions">
              <button
                className="secondary-button"
                disabled={isSubmitting}
                type="submit"
              >
                Salvar
              </button>
              <button
                className="secondary-button"
                disabled={isSubmitting}
                onClick={() =>
                  void updateProduct({ isActive: !product.is_active })
                }
                type="button"
              >
                {product.is_active ? "Inativar" : "Reativar"}
              </button>
            </div>
          </form>
          {errorMessage ? (
            <p className="notice product-row-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </td>
      ) : (
        <>
          <td>{product.sku}</td>
          <td>{product.name}</td>
          <td>{formatPrice(product.price)}</td>
          <td>
            <span className={`product-status ${product.is_active ? "is-active" : "is-inactive"}`}>
              {product.is_active ? "Ativo" : "Inativo"}
            </span>
          </td>
        </>
      )}
    </tr>
  );
}
