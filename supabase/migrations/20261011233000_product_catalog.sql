CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE CHECK (
    sku = btrim(sku)
    AND sku = upper(sku)
    AND char_length(sku) BETWEEN 1 AND 40
    AND sku ~ '^[A-Z0-9._-]+$'
  ),
  name text NOT NULL CHECK (
    name = btrim(name)
    AND char_length(name) BETWEEN 1 AND 160
  ),
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_active_name_idx
  ON public.products (is_active, name);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.products FROM anon, authenticated;
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT INSERT (sku, name, price) ON TABLE public.products TO authenticated;
GRANT UPDATE (sku, name, price, is_active) ON TABLE public.products
  TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;

CREATE POLICY "Commercial users can read products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.can_access_crm());

CREATE POLICY "Administrators can create products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.can_manage_commercial_structure()
  );

CREATE POLICY "Administrators can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_commercial_structure())
  WITH CHECK (public.can_manage_commercial_structure());

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
