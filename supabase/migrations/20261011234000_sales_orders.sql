CREATE TYPE public.sales_order_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected'
);

CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL
    REFERENCES public.crm_records (id) ON DELETE RESTRICT,
  customer_name_snapshot text NOT NULL,
  customer_document_snapshot text,
  territory_id uuid REFERENCES public.territories (id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.sales_order_status NOT NULL DEFAULT 'draft',
  total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  rejection_reason text CHECK (
    rejection_reason IS NULL OR char_length(rejection_reason) <= 1000
  ),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'draft' AND submitted_at IS NULL AND reviewed_at IS NULL
      AND reviewed_by IS NULL AND rejection_reason IS NULL)
    OR
    (status = 'pending_approval' AND submitted_at IS NOT NULL
      AND reviewed_at IS NULL AND reviewed_by IS NULL
      AND rejection_reason IS NULL)
    OR
    (status = 'approved' AND submitted_at IS NOT NULL
      AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL
      AND rejection_reason IS NULL)
    OR
    (status = 'rejected' AND submitted_at IS NOT NULL
      AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL
      AND rejection_reason IS NOT NULL
      AND char_length(btrim(rejection_reason)) BETWEEN 1 AND 1000)
  )
);

CREATE INDEX sales_orders_owner_created_at_idx
  ON public.sales_orders (owner_user_id, created_at DESC);
CREATE INDEX sales_orders_status_submitted_at_idx
  ON public.sales_orders (status, submitted_at DESC);
CREATE INDEX sales_orders_customer_created_at_idx
  ON public.sales_orders (customer_id, created_at DESC);

CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.sales_orders (id) ON DELETE CASCADE,
  product_id uuid NOT NULL
    REFERENCES public.products (id) ON DELETE RESTRICT,
  sku_snapshot text NOT NULL,
  name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id)
);

CREATE INDEX sales_order_items_order_id_idx
  ON public.sales_order_items (order_id);

CREATE FUNCTION public.can_view_sales_order(target_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.can_manage_commercial_structure()
    OR (
      public.can_access_crm()
      AND (
        target_owner_user_id = (SELECT auth.uid())
        OR (
          EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = (SELECT auth.uid())
              AND role = 'sales_manager'::public.app_role
          )
          AND EXISTS (
            SELECT 1
            FROM public.commercial_team_members AS member
            WHERE member.user_id = target_owner_user_id
              AND member.manager_user_id = (SELECT auth.uid())
          )
        )
      )
    );
$$;

CREATE FUNCTION public.can_review_sales_order(target_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_owner_user_id <> (SELECT auth.uid())
    AND (
      public.can_manage_commercial_structure()
      OR (
        EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = (SELECT auth.uid())
            AND role = 'sales_manager'::public.app_role
        )
        AND EXISTS (
          SELECT 1
          FROM public.commercial_team_members AS member
          WHERE member.user_id = target_owner_user_id
            AND member.manager_user_id = (SELECT auth.uid())
        )
      )
    );
$$;

CREATE FUNCTION public.set_sales_order_items(
  target_order_id uuid,
  target_items jsonb
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  product_row record;
  item_product_id uuid;
  item_quantity integer;
  order_total numeric(14, 2) := 0;
  items_count integer;
BEGIN
  IF pg_catalog.jsonb_typeof(target_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items must be an array';
  END IF;

  items_count := pg_catalog.jsonb_array_length(target_items);
  IF items_count < 1 OR items_count > 100 THEN
    RAISE EXCEPTION 'An order must contain between 1 and 100 items';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(target_items) AS entry(value)
    WHERE pg_catalog.jsonb_typeof(entry.value) <> 'object'
      OR entry.value ->> 'product_id' IS NULL
      OR entry.value ->> 'quantity' IS NULL
      OR entry.value ->> 'product_id'
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR entry.value ->> 'quantity' !~ '^[0-9]{1,7}$'
  ) THEN
    RAISE EXCEPTION 'Order item data is invalid';
  END IF;

  IF (
    SELECT pg_catalog.count(DISTINCT entry.value ->> 'product_id')
    FROM pg_catalog.jsonb_array_elements(target_items) AS entry(value)
  ) <> items_count THEN
    RAISE EXCEPTION 'An order cannot contain the same product more than once';
  END IF;

  DELETE FROM public.sales_order_items
  WHERE order_id = target_order_id;

  FOR item IN
    SELECT value
    FROM pg_catalog.jsonb_array_elements(target_items)
  LOOP
    item_product_id := (item ->> 'product_id')::uuid;
    item_quantity := (item ->> 'quantity')::integer;
    IF item_quantity < 1 OR item_quantity > 1000000 THEN
      RAISE EXCEPTION 'Order item quantity is invalid';
    END IF;

    SELECT id, sku, name, price
    INTO product_row
    FROM public.products
    WHERE id = item_product_id
      AND is_active
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product does not exist or is inactive';
    END IF;

    INSERT INTO public.sales_order_items (
      order_id,
      product_id,
      sku_snapshot,
      name_snapshot,
      quantity,
      unit_price,
      line_total
    )
    VALUES (
      target_order_id,
      product_row.id,
      product_row.sku,
      product_row.name,
      item_quantity,
      product_row.price,
      product_row.price * item_quantity
    );

    order_total := order_total + product_row.price * item_quantity;
  END LOOP;

  RETURN order_total;
END;
$$;

CREATE FUNCTION public.create_sales_order(
  target_customer_id uuid,
  target_items jsonb,
  target_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  customer_row record;
  new_order_id uuid;
  order_total numeric(14, 2);
BEGIN
  IF caller_id IS NULL OR NOT public.can_access_crm() THEN
    RAISE EXCEPTION 'Not authorized to create sales orders';
  END IF;

  IF target_notes IS NOT NULL AND pg_catalog.char_length(target_notes) > 2000 THEN
    RAISE EXCEPTION 'Order notes are too long';
  END IF;

  SELECT id, owner_user_id, territory_id, name, document
  INTO customer_row
  FROM public.crm_records
  WHERE id = target_customer_id;

  IF NOT FOUND OR NOT public.can_view_crm_record(
    customer_row.owner_user_id,
    customer_row.territory_id
  ) THEN
    RAISE EXCEPTION 'Customer is not available to this user';
  END IF;

  INSERT INTO public.sales_orders (
    customer_id,
    customer_name_snapshot,
    customer_document_snapshot,
    territory_id,
    owner_user_id,
    notes,
    created_by
  )
  VALUES (
    target_customer_id,
    customer_row.name,
    customer_row.document,
    customer_row.territory_id,
    caller_id,
    NULLIF(pg_catalog.btrim(target_notes), ''),
    caller_id
  )
  RETURNING id INTO new_order_id;

  order_total := public.set_sales_order_items(new_order_id, target_items);
  UPDATE public.sales_orders
  SET total = order_total
  WHERE id = new_order_id;

  RETURN new_order_id;
END;
$$;

CREATE FUNCTION public.update_sales_order_draft(
  target_order_id uuid,
  target_customer_id uuid,
  target_items jsonb,
  target_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  order_row public.sales_orders%ROWTYPE;
  customer_row record;
  order_total numeric(14, 2);
BEGIN
  IF caller_id IS NULL OR NOT public.can_access_crm() THEN
    RAISE EXCEPTION 'Not authorized to update sales orders';
  END IF;
  IF target_notes IS NOT NULL AND pg_catalog.char_length(target_notes) > 2000 THEN
    RAISE EXCEPTION 'Order notes are too long';
  END IF;

  SELECT *
  INTO order_row
  FROM public.sales_orders
  WHERE id = target_order_id
  FOR UPDATE;

  IF NOT FOUND
    OR order_row.owner_user_id <> caller_id
    OR order_row.status NOT IN (
      'draft'::public.sales_order_status,
      'rejected'::public.sales_order_status
    )
  THEN
    RAISE EXCEPTION 'Sales order cannot be edited';
  END IF;

  SELECT id, owner_user_id, territory_id, name, document
  INTO customer_row
  FROM public.crm_records
  WHERE id = target_customer_id;

  IF NOT FOUND OR NOT public.can_view_crm_record(
    customer_row.owner_user_id,
    customer_row.territory_id
  ) THEN
    RAISE EXCEPTION 'Customer is not available to this user';
  END IF;

  order_total := public.set_sales_order_items(target_order_id, target_items);
  UPDATE public.sales_orders
  SET customer_id = target_customer_id,
      customer_name_snapshot = customer_row.name,
      customer_document_snapshot = customer_row.document,
      territory_id = customer_row.territory_id,
      notes = NULLIF(pg_catalog.btrim(target_notes), ''),
      total = order_total,
      status = 'draft',
      submitted_at = NULL,
      reviewed_at = NULL,
      reviewed_by = NULL,
      rejection_reason = NULL
  WHERE id = target_order_id;
END;
$$;

CREATE FUNCTION public.submit_sales_order(target_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  order_row public.sales_orders%ROWTYPE;
BEGIN
  SELECT *
  INTO order_row
  FROM public.sales_orders
  WHERE id = target_order_id
  FOR UPDATE;

  IF caller_id IS NULL
    OR NOT public.can_access_crm()
    OR NOT FOUND
    OR order_row.owner_user_id <> caller_id
    OR order_row.status <> 'draft'::public.sales_order_status
    OR NOT EXISTS (
      SELECT 1
      FROM public.sales_order_items
      WHERE order_id = target_order_id
    )
  THEN
    RAISE EXCEPTION 'Sales order cannot be submitted';
  END IF;

  UPDATE public.sales_orders
  SET status = 'pending_approval',
      submitted_at = pg_catalog.now(),
      reviewed_at = NULL,
      reviewed_by = NULL,
      rejection_reason = NULL
  WHERE id = target_order_id;
END;
$$;

CREATE FUNCTION public.review_sales_order(
  target_order_id uuid,
  approve boolean,
  reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  order_row public.sales_orders%ROWTYPE;
BEGIN
  SELECT *
  INTO order_row
  FROM public.sales_orders
  WHERE id = target_order_id
  FOR UPDATE;

  IF caller_id IS NULL
    OR NOT FOUND
    OR order_row.status <> 'pending_approval'::public.sales_order_status
    OR NOT public.can_review_sales_order(order_row.owner_user_id)
  THEN
    RAISE EXCEPTION 'Sales order cannot be reviewed by this user';
  END IF;

  IF approve IS NULL THEN
    RAISE EXCEPTION 'Review decision is required';
  END IF;
  IF NOT approve AND (
    reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(reason)) NOT BETWEEN 1 AND 1000
  ) THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  UPDATE public.sales_orders
  SET status = CASE
        WHEN approve THEN 'approved'::public.sales_order_status
        ELSE 'rejected'::public.sales_order_status
      END,
      reviewed_at = pg_catalog.now(),
      reviewed_by = caller_id,
      rejection_reason = CASE
        WHEN approve THEN NULL
        ELSE pg_catalog.btrim(reason)
      END
  WHERE id = target_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_sales_order(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_review_sales_order(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_sales_order_items(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sales_order(uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_sales_order_draft(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_sales_order(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_sales_order(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_sales_order(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sales_order(uuid, jsonb, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sales_order_draft(uuid, uuid, jsonb, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_sales_order(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_sales_order(uuid, boolean, text)
  TO authenticated;

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sales_orders, public.sales_order_items
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.sales_orders, public.sales_order_items
  TO authenticated;
GRANT ALL ON TABLE public.sales_orders, public.sales_order_items TO service_role;
GRANT USAGE ON TYPE public.sales_order_status TO authenticated, service_role;

CREATE POLICY "Users can read permitted sales orders"
  ON public.sales_orders
  FOR SELECT
  TO authenticated
  USING (public.can_view_sales_order(owner_user_id));

CREATE POLICY "Users can read items from permitted sales orders"
  ON public.sales_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales_orders AS sales_order
      WHERE sales_order.id = order_id
        AND public.can_view_sales_order(sales_order.owner_user_id)
    )
  );

CREATE TRIGGER set_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
