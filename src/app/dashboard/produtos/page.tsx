import Link from "next/link";
import { redirect } from "next/navigation";
import ProductForm from "./product-form";
import ProductRow, { type ProductListItem } from "./product-row";
import { hasCrmRole } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("Product catalog session validation failed.", {
      name: claimsError.name,
      code: "code" in claimsError ? claimsError.code : undefined,
    });
    throw new Error("Não foi possível validar a sessão atual.");
  }
  if (!claimsData?.claims) redirect("/login");

  const userId = claimsData.claims.sub;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) {
    console.error("Product catalog role lookup failed.", {
      code: rolesError.code,
    });
    throw new Error("Não foi possível validar as permissões.");
  }
  if (!roles.some(({ role }) => hasCrmRole(role))) redirect("/dashboard");

  const canManageProducts = roles.some(
    ({ role }) => role === "super_admin" || role === "director",
  );
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, sku, name, price, is_active")
    .order("name")
    .limit(1000);

  if (productsError) {
    console.error("Product catalog loading failed.", {
      code: productsError.code,
    });
    if (
      productsError.code === "PGRST205" ||
      productsError.code === "42P01"
    ) {
      return (
        <>
          <header className="app-topbar">
            <p className="topbar-context">Comercial / Produtos</p>
            <Link className="text-link" href="/dashboard">
              Voltar ao painel
            </Link>
          </header>
          <section aria-labelledby="products-title" className="workspace">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">SGRC · Gestão comercial</p>
                <h1 className="workspace-title" id="products-title">
                  Catálogo de produtos
                </h1>
              </div>
            </div>
            <p className="notice" role="alert">
              A estrutura do catálogo ainda não está instalada neste banco.
              Aplique a migration{" "}
              <code>20261011233000_product_catalog.sql</code> no projeto
              Supabase e atualize esta página.
            </p>
          </section>
        </>
      );
    }
    throw new Error("Não foi possível carregar o catálogo de produtos.");
  }

  return (
    <>
      <header className="app-topbar">
        <p className="topbar-context">Comercial / Produtos</p>
        <Link className="text-link" href="/dashboard">
          Voltar ao painel
        </Link>
      </header>
      <section aria-labelledby="products-title" className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SGRC · Gestão comercial</p>
            <h1 className="workspace-title" id="products-title">
              Catálogo de produtos
            </h1>
            <p className="workspace-description">
              Consulte os itens disponíveis e seus preços de referência.
            </p>
          </div>
        </div>

        {canManageProducts ? (
          <section
            aria-labelledby="new-product-title"
            className="module-section crm-section"
          >
            <div className="section-heading">
              <div>
                <h2 className="section-title" id="new-product-title">
                  Adicionar produto
                </h2>
                <p>
                  O SKU deve ser único. Preços podem ser informados com vírgula
                  ou ponto decimal.
                </p>
              </div>
            </div>
            <ProductForm />
          </section>
        ) : (
          <p className="notice product-readonly-notice" role="status">
            O catálogo está disponível para consulta. Somente administradores e
            diretores podem alterar produtos e preços.
          </p>
        )}

        <section
          aria-labelledby="product-list-title"
          className="module-section crm-section"
        >
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="product-list-title">
                Produtos cadastrados
              </h2>
              <p>
                {products.length === 1000
                  ? "Mostrando até 1.000 produtos."
                  : `${products.length} produto(s) no catálogo.`}
              </p>
            </div>
          </div>
          {products.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table product-table">
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col">Produto</th>
                    <th scope="col">Preço</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product: ProductListItem) => (
                    <ProductRow
                      canManage={canManageProducts}
                      key={product.id}
                      product={product}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">
              Ainda não há produtos cadastrados.
              {canManageProducts
                ? " Use o formulário acima para adicionar o primeiro."
                : ""}
            </p>
          )}
        </section>
      </section>
    </>
  );
}
