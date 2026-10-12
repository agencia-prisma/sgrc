CREATE TYPE public.sales_order_financial_event_type AS ENUM (
  'invoice',
  'payment_received'
);
CREATE TYPE public.sales_order_financial_event_source AS ENUM (
  'manual',
  'erp'
);
CREATE TYPE public.crm_transfer_status AS ENUM (
  'pending_manager',
  'pending_director',
  'approved',
  'rejected'
);
CREATE TYPE public.crm_protection_event_type AS ENUM (
  'purchase',
  'transfer'
);

CREATE TABLE public.sales_order_financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL
    REFERENCES public.sales_orders (id) ON DELETE RESTRICT,
  event_type public.sales_order_financial_event_type NOT NULL,
  source public.sales_order_financial_event_source NOT NULL,
  external_event_id text CHECK (
    external_event_id IS NULL
    OR char_length(external_event_id) BETWEEN 1 AND 200
  ),
  invoice_number text CHECK (
    invoice_number IS NULL
    OR (
      invoice_number = btrim(invoice_number)
      AND char_length(invoice_number) BETWEEN 1 AND 120
    )
  ),
  amount numeric(14, 2) CHECK (amount IS NULL OR amount > 0),
  occurred_on date NOT NULL,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (event_type = 'invoice' AND invoice_number IS NOT NULL AND amount IS NULL)
    OR
    (event_type = 'payment_received' AND invoice_number IS NULL AND amount > 0)
  ),
  CHECK (
    (source = 'manual' AND recorded_by IS NOT NULL)
    OR (source = 'erp' AND external_event_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX sales_order_financial_events_invoice_uidx
  ON public.sales_order_financial_events (sales_order_id)
  WHERE event_type = 'invoice';
CREATE UNIQUE INDEX sales_order_financial_events_source_external_uidx
  ON public.sales_order_financial_events (source, external_event_id)
  WHERE external_event_id IS NOT NULL;
CREATE INDEX sales_order_financial_events_order_occurred_idx
  ON public.sales_order_financial_events (
    sales_order_id,
    event_type,
    occurred_on,
    recorded_at
  );

CREATE TABLE public.crm_customer_protections (
  customer_id uuid PRIMARY KEY
    REFERENCES public.crm_records (id) ON DELETE RESTRICT,
  protected_owner_user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  protected_since date NOT NULL,
  protected_until date NOT NULL,
  source_order_id uuid NOT NULL
    REFERENCES public.sales_orders (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (protected_until >= protected_since)
);
CREATE INDEX crm_customer_protections_owner_until_idx
  ON public.crm_customer_protections (
    protected_owner_user_id,
    protected_until
  );

CREATE TABLE public.crm_customer_protection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL
    REFERENCES public.crm_records (id) ON DELETE RESTRICT,
  event_type public.crm_protection_event_type NOT NULL,
  from_owner_user_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  to_owner_user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  source_order_id uuid REFERENCES public.sales_orders (id) ON DELETE RESTRICT,
  protected_since date NOT NULL,
  protected_until date NOT NULL,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (protected_until >= protected_since),
  CHECK (
    (event_type = 'purchase' AND source_order_id IS NOT NULL)
    OR (event_type = 'transfer' AND from_owner_user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX crm_customer_protection_purchase_order_uidx
  ON public.crm_customer_protection_events (source_order_id)
  WHERE event_type = 'purchase';
CREATE INDEX crm_customer_protection_events_customer_recorded_idx
  ON public.crm_customer_protection_events (customer_id, recorded_at DESC);

CREATE TABLE public.crm_customer_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL
    REFERENCES public.crm_records (id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  source_owner_user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  target_owner_user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  required_manager_user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.crm_transfer_status NOT NULL DEFAULT 'pending_manager',
  reason text NOT NULL CHECK (
    reason = btrim(reason)
    AND char_length(reason) BETWEEN 1 AND 1000
  ),
  manager_decision text CHECK (
    manager_decision IS NULL OR manager_decision IN ('approved', 'rejected')
  ),
  manager_decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  manager_decided_at timestamptz,
  manager_decision_reason text CHECK (
    manager_decision_reason IS NULL
    OR char_length(manager_decision_reason) <= 1000
  ),
  director_decision text CHECK (
    director_decision IS NULL OR director_decision IN ('approved', 'rejected')
  ),
  director_decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  director_decided_at timestamptz,
  director_decision_reason text CHECK (
    director_decision_reason IS NULL
    OR char_length(director_decision_reason) <= 1000
  ),
  transferred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_owner_user_id <> target_owner_user_id),
  CHECK (
    (manager_decision IS NULL AND manager_decided_by IS NULL
      AND manager_decided_at IS NULL)
    OR
    (manager_decision IS NOT NULL AND manager_decided_by IS NOT NULL
      AND manager_decided_at IS NOT NULL)
  ),
  CHECK (
    (director_decision IS NULL AND director_decided_by IS NULL
      AND director_decided_at IS NULL)
    OR
    (director_decision IS NOT NULL AND director_decided_by IS NOT NULL
      AND director_decided_at IS NOT NULL)
  ),
  CHECK (
    (status = 'pending_manager' AND manager_decision IS NULL
      AND director_decision IS NULL AND transferred_at IS NULL)
    OR
    (status = 'pending_director' AND manager_decision = 'approved'
      AND director_decision IS NULL AND transferred_at IS NULL)
    OR
    (status = 'approved' AND manager_decision = 'approved'
      AND director_decision = 'approved' AND transferred_at IS NOT NULL)
    OR
    (status = 'rejected' AND (
      manager_decision = 'rejected'
      OR (
        manager_decision = 'approved'
        AND director_decision = 'rejected'
      )
    ) AND transferred_at IS NULL)
  )
);
CREATE UNIQUE INDEX crm_customer_transfer_requests_open_uidx
  ON public.crm_customer_transfer_requests (customer_id)
  WHERE status IN ('pending_manager', 'pending_director');
CREATE INDEX crm_customer_transfer_requests_manager_idx
  ON public.crm_customer_transfer_requests (
    required_manager_user_id,
    status,
    created_at DESC
  );
CREATE INDEX crm_customer_transfer_requests_director_idx
  ON public.crm_customer_transfer_requests (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_view_sales_order(target_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role IN (
        'finance'::public.app_role,
        'super_admin'::public.app_role
      )
  )
  OR public.can_manage_commercial_structure()
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

CREATE FUNCTION public.prevent_protected_customer_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    AND EXISTS (
      SELECT 1
      FROM public.crm_customer_protections AS protection
      WHERE protection.customer_id = OLD.id
        AND protection.protected_until >= CURRENT_DATE
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.crm_customer_transfer_requests AS transfer
      WHERE transfer.customer_id = OLD.id
        AND transfer.source_owner_user_id = OLD.owner_user_id
        AND transfer.target_owner_user_id = NEW.owner_user_id
        AND transfer.status = 'approved'
        AND transfer.transferred_at IS NOT NULL
    )
  THEN
    RAISE EXCEPTION 'Protected customer ownership can only change through an approved transfer'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_protected_customer_owner_change
  BEFORE UPDATE OF owner_user_id ON public.crm_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_protected_customer_owner_change();

CREATE FUNCTION public.apply_paid_order_customer_protection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_row public.sales_orders%ROWTYPE;
  customer_owner uuid;
  paid_total numeric(14, 2);
  full_payment_date date;
  invoice_date date;
  existing_protection public.crm_customer_protections%ROWTYPE;
  next_protected_until date;
BEGIN
  IF NEW.event_type NOT IN ('invoice', 'payment_received') THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO order_row
  FROM public.sales_orders
  WHERE id = NEW.sales_order_id;

  SELECT COALESCE(pg_catalog.sum(amount), 0)
  INTO paid_total
  FROM public.sales_order_financial_events
  WHERE sales_order_id = NEW.sales_order_id
    AND event_type = 'payment_received';

  IF paid_total < order_row.total OR order_row.total <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT invoice.occurred_on
  INTO invoice_date
  FROM public.sales_order_financial_events AS invoice
  WHERE invoice.sales_order_id = NEW.sales_order_id
    AND invoice.event_type = 'invoice';

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT paid.occurred_on
  INTO full_payment_date
  FROM (
    SELECT occurred_on,
      recorded_at,
      id,
      pg_catalog.sum(amount) OVER (
        ORDER BY occurred_on, recorded_at, id
      ) AS running_total
    FROM public.sales_order_financial_events
    WHERE sales_order_id = NEW.sales_order_id
      AND event_type = 'payment_received'
  ) AS paid
  WHERE paid.running_total >= order_row.total
  ORDER BY paid.occurred_on, paid.recorded_at, paid.id
  LIMIT 1;

  IF invoice_date > full_payment_date THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id
  INTO customer_owner
  FROM public.crm_records
  WHERE id = order_row.customer_id
  FOR UPDATE;

  SELECT *
  INTO existing_protection
  FROM public.crm_customer_protections
  WHERE customer_id = order_row.customer_id
  FOR UPDATE;

  next_protected_until := full_payment_date + INTERVAL '6 months';
  IF FOUND AND existing_protection.protected_until > next_protected_until THEN
    next_protected_until := existing_protection.protected_until;
  END IF;

  INSERT INTO public.crm_customer_protections (
    customer_id,
    protected_owner_user_id,
    protected_since,
    protected_until,
    source_order_id
  )
  VALUES (
    order_row.customer_id,
    customer_owner,
    full_payment_date,
    next_protected_until,
    order_row.id
  )
  ON CONFLICT (customer_id) DO UPDATE
  SET protected_owner_user_id = EXCLUDED.protected_owner_user_id,
      protected_since = EXCLUDED.protected_since,
      protected_until = EXCLUDED.protected_until,
      source_order_id = EXCLUDED.source_order_id,
      updated_at = pg_catalog.now();

  INSERT INTO public.crm_customer_protection_events (
    customer_id,
    event_type,
    from_owner_user_id,
    to_owner_user_id,
    source_order_id,
    protected_since,
    protected_until,
    recorded_by
  )
  VALUES (
    order_row.customer_id,
    'purchase',
    customer_owner,
    customer_owner,
    order_row.id,
    full_payment_date,
    next_protected_until,
    NEW.recorded_by
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_paid_order_customer_protection
  AFTER INSERT ON public.sales_order_financial_events
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_paid_order_customer_protection();

CREATE FUNCTION public.list_crm_transfer_owners(target_customer_id uuid)
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_row public.crm_records%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_crm() THEN
    RAISE EXCEPTION 'CRM access is required to list transfer owners';
  END IF;

  SELECT *
  INTO customer_row
  FROM public.crm_records
  WHERE id = target_customer_id;
  IF NOT FOUND OR NOT public.can_manage_crm_record(
    customer_row.owner_user_id,
    customer_row.territory_id
  ) THEN
    RAISE EXCEPTION 'Customer is not available to this user';
  END IF;

  RETURN QUERY
  SELECT member.user_id, profile.display_name
  FROM public.commercial_team_members AS member
  JOIN public.profiles AS profile ON profile.id = member.user_id
  WHERE member.member_type = 'representative'
    AND member.is_active
    AND (
      customer_row.territory_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.commercial_team_territory_assignments AS assignment
        WHERE assignment.user_id = member.user_id
          AND assignment.territory_id = customer_row.territory_id
      )
    )
  ORDER BY profile.display_name;
END;
$$;

CREATE FUNCTION public.record_sales_order_invoice(
  target_order_id uuid,
  target_invoice_number text,
  target_invoice_date date,
  target_source public.sales_order_financial_event_source DEFAULT 'manual',
  target_external_event_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  order_row public.sales_orders%ROWTYPE;
  normalized_invoice_number text := pg_catalog.btrim(target_invoice_number);
  existing_event public.sales_order_financial_events%ROWTYPE;
  new_event_id uuid;
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    IF target_source <> 'erp'::public.sales_order_financial_event_source
      OR target_external_event_id IS NULL
    THEN
      RAISE EXCEPTION 'Service role financial events must come from ERP';
    END IF;
  ELSIF target_source <> 'manual'::public.sales_order_financial_event_source
    OR target_external_event_id IS NOT NULL
    OR caller_id IS NULL
    OR (SELECT auth.jwt() ->> 'aal') <> 'aal2'
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = caller_id
        AND role IN (
          'finance'::public.app_role,
          'super_admin'::public.app_role
        )
    )
  THEN
    RAISE EXCEPTION 'Only finance users with MFA can record invoices';
  END IF;

  IF target_source = 'erp'::public.sales_order_financial_event_source
    AND (target_external_event_id IS NULL
      OR pg_catalog.char_length(target_external_event_id) NOT BETWEEN 1 AND 200)
  THEN
    RAISE EXCEPTION 'ERP invoice event identifier is invalid';
  END IF;

  IF normalized_invoice_number IS NULL
    OR pg_catalog.char_length(normalized_invoice_number) NOT BETWEEN 1 AND 120
    OR target_invoice_date IS NULL
    OR target_invoice_date > CURRENT_DATE
  THEN
    RAISE EXCEPTION 'Invoice data is invalid';
  END IF;

  IF target_external_event_id IS NOT NULL THEN
    SELECT *
    INTO existing_event
    FROM public.sales_order_financial_events
    WHERE source = target_source
      AND external_event_id = target_external_event_id;
    IF FOUND THEN
      IF existing_event.sales_order_id = target_order_id
        AND existing_event.event_type = 'invoice'
        AND existing_event.invoice_number = normalized_invoice_number
        AND existing_event.occurred_on = target_invoice_date
      THEN
        RETURN existing_event.id;
      END IF;
      RAISE EXCEPTION 'ERP event identifier was already used for another event';
    END IF;
  END IF;

  SELECT *
  INTO order_row
  FROM public.sales_orders
  WHERE id = target_order_id
  FOR UPDATE;
  IF NOT FOUND OR order_row.status <> 'approved' OR order_row.total <= 0 THEN
    RAISE EXCEPTION 'Only approved orders with a positive total can be invoiced';
  END IF;

  INSERT INTO public.sales_order_financial_events (
    sales_order_id,
    event_type,
    source,
    external_event_id,
    invoice_number,
    occurred_on,
    recorded_by
  )
  VALUES (
    target_order_id,
    'invoice',
    target_source,
    target_external_event_id,
    normalized_invoice_number,
    target_invoice_date,
    caller_id
  )
  RETURNING id INTO new_event_id;

  RETURN new_event_id;
END;
$$;

CREATE FUNCTION public.record_sales_order_payment(
  target_order_id uuid,
  target_amount numeric,
  target_payment_date date,
  target_source public.sales_order_financial_event_source DEFAULT 'manual',
  target_external_event_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  order_row public.sales_orders%ROWTYPE;
  paid_total numeric(14, 2);
  existing_event public.sales_order_financial_events%ROWTYPE;
  new_event_id uuid;
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    IF target_source <> 'erp'::public.sales_order_financial_event_source
      OR target_external_event_id IS NULL
    THEN
      RAISE EXCEPTION 'Service role financial events must come from ERP';
    END IF;
  ELSIF target_source <> 'manual'::public.sales_order_financial_event_source
    OR target_external_event_id IS NOT NULL
    OR caller_id IS NULL
    OR (SELECT auth.jwt() ->> 'aal') <> 'aal2'
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = caller_id
        AND role IN (
          'finance'::public.app_role,
          'super_admin'::public.app_role
        )
    )
  THEN
    RAISE EXCEPTION 'Only finance users with MFA can record payments';
  END IF;

  IF target_source = 'erp'::public.sales_order_financial_event_source
    AND (target_external_event_id IS NULL
      OR pg_catalog.char_length(target_external_event_id) NOT BETWEEN 1 AND 200)
  THEN
    RAISE EXCEPTION 'ERP payment event identifier is invalid';
  END IF;

  IF target_amount IS NULL
    OR target_amount <= 0
    OR target_amount <> pg_catalog.round(target_amount, 2)
    OR target_payment_date IS NULL
    OR target_payment_date > CURRENT_DATE
  THEN
    RAISE EXCEPTION 'Payment data is invalid';
  END IF;

  IF target_external_event_id IS NOT NULL THEN
    SELECT *
    INTO existing_event
    FROM public.sales_order_financial_events
    WHERE source = target_source
      AND external_event_id = target_external_event_id;
    IF FOUND THEN
      IF existing_event.sales_order_id = target_order_id
        AND existing_event.event_type = 'payment_received'
        AND existing_event.amount = target_amount
        AND existing_event.occurred_on = target_payment_date
      THEN
        RETURN existing_event.id;
      END IF;
      RAISE EXCEPTION 'ERP event identifier was already used for another event';
    END IF;
  END IF;

  SELECT *
  INTO order_row
  FROM public.sales_orders
  WHERE id = target_order_id
  FOR UPDATE;
  IF NOT FOUND OR order_row.status <> 'approved' OR order_row.total <= 0 THEN
    RAISE EXCEPTION 'Only approved orders with a positive total can receive payments';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_order_financial_events
    WHERE sales_order_id = target_order_id
      AND event_type = 'invoice'
  ) THEN
    RAISE EXCEPTION 'The order must be invoiced before receiving payment';
  END IF;

  SELECT COALESCE(pg_catalog.sum(amount), 0)
  INTO paid_total
  FROM public.sales_order_financial_events
  WHERE sales_order_id = target_order_id
    AND event_type = 'payment_received';
  IF paid_total + target_amount > order_row.total THEN
    RAISE EXCEPTION 'Payment exceeds the outstanding order balance';
  END IF;

  INSERT INTO public.sales_order_financial_events (
    sales_order_id,
    event_type,
    source,
    external_event_id,
    amount,
    occurred_on,
    recorded_by
  )
  VALUES (
    target_order_id,
    'payment_received',
    target_source,
    target_external_event_id,
    target_amount,
    target_payment_date,
    caller_id
  )
  RETURNING id INTO new_event_id;

  RETURN new_event_id;
END;
$$;

CREATE FUNCTION public.create_crm_customer_transfer_request(
  target_customer_id uuid,
  target_owner_user_id uuid,
  transfer_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  customer_row public.crm_records%ROWTYPE;
  protection_row public.crm_customer_protections%ROWTYPE;
  manager_id uuid;
  manager_initiated boolean;
  new_request_id uuid;
BEGIN
  IF caller_id IS NULL OR NOT public.can_access_crm() THEN
    RAISE EXCEPTION 'CRM access is required to request a transfer';
  END IF;
  IF transfer_reason IS NULL
    OR transfer_reason <> pg_catalog.btrim(transfer_reason)
    OR pg_catalog.char_length(transfer_reason) NOT BETWEEN 1 AND 1000
  THEN
    RAISE EXCEPTION 'A transfer reason is required';
  END IF;
  IF target_owner_user_id = caller_id THEN
    RAISE EXCEPTION 'The new owner must differ from the current owner';
  END IF;

  SELECT *
  INTO customer_row
  FROM public.crm_records
  WHERE id = target_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer does not exist';
  END IF;
  IF NOT public.can_manage_crm_record(
    customer_row.owner_user_id,
    customer_row.territory_id
  ) THEN
    RAISE EXCEPTION 'Customer is not available to this user';
  END IF;
  IF target_owner_user_id = customer_row.owner_user_id THEN
    RAISE EXCEPTION 'The new owner must differ from the current owner';
  END IF;

  SELECT manager_user_id
  INTO manager_id
  FROM public.commercial_team_members
  WHERE user_id = customer_row.owner_user_id
    AND is_active;
  manager_initiated := caller_id = manager_id;
  IF caller_id <> customer_row.owner_user_id AND NOT manager_initiated THEN
    RAISE EXCEPTION 'Only the current owner or their manager can request a transfer';
  END IF;
  IF manager_initiated
    AND (
      (SELECT auth.jwt() ->> 'aal') <> 'aal2'
      OR NOT public.has_required_mfa_assurance()
    )
  THEN
    RAISE EXCEPTION 'The manager must confirm MFA before requesting a transfer';
  END IF;
  SELECT *
  INTO protection_row
  FROM public.crm_customer_protections
  WHERE customer_id = target_customer_id
  FOR UPDATE;
  IF NOT FOUND OR protection_row.protected_until < CURRENT_DATE THEN
    RAISE EXCEPTION 'Customer protection is not active';
  END IF;
  IF protection_row.protected_owner_user_id <> customer_row.owner_user_id THEN
    RAISE EXCEPTION 'Protected owner does not match the customer owner';
  END IF;

  IF manager_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = manager_id
      AND role = 'sales_manager'::public.app_role
  ) THEN
    RAISE EXCEPTION 'The current owner must have an active sales manager';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.commercial_team_members AS target_member
    WHERE target_member.user_id = target_owner_user_id
      AND target_member.member_type = 'representative'
      AND target_member.is_active
      AND (
        customer_row.territory_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.commercial_team_territory_assignments AS assignment
          WHERE assignment.user_id = target_owner_user_id
            AND assignment.territory_id = customer_row.territory_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'New owner must be an active representative assigned to the customer territory';
  END IF;

  INSERT INTO public.crm_customer_transfer_requests (
    customer_id,
    requested_by,
    source_owner_user_id,
    target_owner_user_id,
    required_manager_user_id,
    status,
    reason,
    manager_decision,
    manager_decided_by,
    manager_decided_at
  )
  VALUES (
    target_customer_id,
    caller_id,
    customer_row.owner_user_id,
    target_owner_user_id,
    manager_id,
    CASE
      WHEN manager_initiated THEN 'pending_director'::public.crm_transfer_status
      ELSE 'pending_manager'::public.crm_transfer_status
    END,
    transfer_reason,
    CASE WHEN manager_initiated THEN 'approved' ELSE NULL END,
    CASE WHEN manager_initiated THEN caller_id ELSE NULL END,
    CASE WHEN manager_initiated THEN pg_catalog.now() ELSE NULL END
  )
  RETURNING id INTO new_request_id;
  RETURN new_request_id;
END;
$$;

CREATE FUNCTION public.review_crm_customer_transfer_request(
  target_request_id uuid,
  approve boolean,
  decision_reason text DEFAULT NULL
)
RETURNS public.crm_transfer_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  request_row public.crm_customer_transfer_requests%ROWTYPE;
  customer_row public.crm_records%ROWTYPE;
  protection_row public.crm_customer_protections%ROWTYPE;
  director_approver boolean;
  next_status public.crm_transfer_status;
  normalized_reason text := NULLIF(pg_catalog.btrim(decision_reason), '');
BEGIN
  IF caller_id IS NULL OR approve IS NULL
    OR (SELECT auth.jwt() ->> 'aal') <> 'aal2'
    OR NOT public.has_required_mfa_assurance()
  THEN
    RAISE EXCEPTION 'MFA-authenticated access is required to review transfers';
  END IF;
  IF decision_reason IS NOT NULL AND pg_catalog.char_length(decision_reason) > 1000 THEN
    RAISE EXCEPTION 'Decision reason is too long';
  END IF;
  IF NOT approve AND normalized_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required to reject the transfer';
  END IF;

  SELECT *
  INTO request_row
  FROM public.crm_customer_transfer_requests
  WHERE id = target_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer request does not exist';
  END IF;

  IF request_row.status = 'pending_manager' THEN
    IF caller_id <> request_row.required_manager_user_id
      OR caller_id = request_row.requested_by
      OR NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = caller_id
          AND role = 'sales_manager'::public.app_role
      )
    THEN
      RAISE EXCEPTION 'Only the current owner manager can review this transfer stage';
    END IF;

    next_status := CASE
      WHEN approve THEN 'pending_director'::public.crm_transfer_status
      ELSE 'rejected'::public.crm_transfer_status
    END;
    UPDATE public.crm_customer_transfer_requests
    SET status = next_status,
        manager_decision = CASE WHEN approve THEN 'approved' ELSE 'rejected' END,
        manager_decided_by = caller_id,
        manager_decided_at = pg_catalog.now(),
        manager_decision_reason = normalized_reason,
        updated_at = pg_catalog.now()
    WHERE id = target_request_id;
    RETURN next_status;
  END IF;

  IF request_row.status <> 'pending_director' THEN
    RAISE EXCEPTION 'Transfer request is not awaiting this approval stage';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = caller_id
      AND role IN (
        'super_admin'::public.app_role,
        'director'::public.app_role
      )
  )
  INTO director_approver;
  IF NOT director_approver
    OR caller_id IN (
      request_row.requested_by,
      request_row.manager_decided_by
    )
  THEN
    RAISE EXCEPTION 'An independent director or system administrator must review this stage';
  END IF;

  IF NOT approve THEN
    UPDATE public.crm_customer_transfer_requests
    SET status = 'rejected',
        director_decision = 'rejected',
        director_decided_by = caller_id,
        director_decided_at = pg_catalog.now(),
        director_decision_reason = normalized_reason,
        updated_at = pg_catalog.now()
    WHERE id = target_request_id;
    RETURN 'rejected'::public.crm_transfer_status;
  END IF;

  SELECT *
  INTO customer_row
  FROM public.crm_records
  WHERE id = request_row.customer_id
  FOR UPDATE;
  SELECT *
  INTO protection_row
  FROM public.crm_customer_protections
  WHERE customer_id = request_row.customer_id
  FOR UPDATE;
  IF NOT FOUND
    OR protection_row.protected_until < CURRENT_DATE
    OR customer_row.owner_user_id <> request_row.source_owner_user_id
    OR protection_row.protected_owner_user_id <> request_row.source_owner_user_id
  THEN
    RAISE EXCEPTION 'Customer ownership or protection changed while transfer was pending';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.commercial_team_members AS target_member
    WHERE target_member.user_id = request_row.target_owner_user_id
      AND target_member.member_type = 'representative'
      AND target_member.is_active
      AND (
        customer_row.territory_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.commercial_team_territory_assignments AS assignment
          WHERE assignment.user_id = request_row.target_owner_user_id
            AND assignment.territory_id = customer_row.territory_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'The transfer target is no longer eligible for this customer';
  END IF;

  UPDATE public.crm_customer_transfer_requests
  SET status = 'approved',
      director_decision = 'approved',
      director_decided_by = caller_id,
      director_decided_at = pg_catalog.now(),
      director_decision_reason = normalized_reason,
      transferred_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = target_request_id;

  UPDATE public.crm_records
  SET owner_user_id = request_row.target_owner_user_id
  WHERE id = request_row.customer_id;

  UPDATE public.crm_customer_protections
  SET protected_owner_user_id = request_row.target_owner_user_id,
      updated_at = pg_catalog.now()
  WHERE customer_id = request_row.customer_id;

  INSERT INTO public.crm_customer_protection_events (
    customer_id,
    event_type,
    from_owner_user_id,
    to_owner_user_id,
    source_order_id,
    protected_since,
    protected_until,
    recorded_by
  )
  VALUES (
    request_row.customer_id,
    'transfer',
    request_row.source_owner_user_id,
    request_row.target_owner_user_id,
    protection_row.source_order_id,
    protection_row.protected_since,
    protection_row.protected_until,
    caller_id
  );

  RETURN 'approved'::public.crm_transfer_status;
END;
$$;

CREATE FUNCTION public.set_customer_transfer_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_customer_transfer_request_updated_at
  BEFORE UPDATE ON public.crm_customer_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_transfer_request_updated_at();

REVOKE ALL ON FUNCTION public.apply_paid_order_customer_protection()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_protected_customer_owner_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_customer_transfer_request_updated_at()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.record_sales_order_invoice(
  uuid, text, date, public.sales_order_financial_event_source, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sales_order_invoice(
  uuid, text, date, public.sales_order_financial_event_source, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_sales_order_payment(
  uuid, numeric, date, public.sales_order_financial_event_source, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sales_order_payment(
  uuid, numeric, date, public.sales_order_financial_event_source, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_crm_transfer_owners(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_crm_transfer_owners(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.create_crm_customer_transfer_request(
  uuid, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_crm_customer_transfer_request(
  uuid, uuid, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.review_crm_customer_transfer_request(
  uuid, boolean, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_crm_customer_transfer_request(
  uuid, boolean, text
) TO authenticated;

REVOKE ALL ON TABLE
  public.sales_order_financial_events,
  public.crm_customer_protections,
  public.crm_customer_protection_events,
  public.crm_customer_transfer_requests
FROM anon, authenticated;
GRANT SELECT ON TABLE
  public.sales_order_financial_events,
  public.crm_customer_protections,
  public.crm_customer_protection_events,
  public.crm_customer_transfer_requests
TO authenticated;
GRANT ALL ON TABLE
  public.sales_order_financial_events,
  public.crm_customer_protections,
  public.crm_customer_protection_events,
  public.crm_customer_transfer_requests
TO service_role;
GRANT USAGE ON TYPE
  public.sales_order_financial_event_type,
  public.sales_order_financial_event_source,
  public.crm_transfer_status,
  public.crm_protection_event_type
TO authenticated, service_role;

ALTER TABLE public.sales_order_financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_protections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_protection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and system administrators can read financial events"
  ON public.sales_order_financial_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN (
          'finance'::public.app_role,
          'super_admin'::public.app_role
        )
    )
  );

CREATE POLICY "Commercial users can read customer protections"
  ON public.crm_customer_protections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crm_records AS customer
      WHERE customer.id = customer_id
        AND public.can_view_crm_record(
          customer.owner_user_id,
          customer.territory_id
        )
    )
  );

CREATE POLICY "Commercial users can read customer protection history"
  ON public.crm_customer_protection_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crm_records AS customer
      WHERE customer.id = customer_id
        AND public.can_view_crm_record(
          customer.owner_user_id,
          customer.territory_id
        )
    )
  );

CREATE POLICY "Transfer participants can read customer transfer requests"
  ON public.crm_customer_transfer_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by = (SELECT auth.uid())
    OR public.can_manage_commercial_structure()
    OR public.can_view_commercial_member(source_owner_user_id)
    OR public.can_view_commercial_member(target_owner_user_id)
    OR required_manager_user_id = (SELECT auth.uid())
  );

CREATE POLICY "Privileged users require MFA assurance"
  ON public.sales_order_financial_events
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.crm_customer_protections
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.crm_customer_protection_events
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.crm_customer_transfer_requests
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Finance and system administrators can view orders"
  ON public.sales_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN (
          'finance'::public.app_role,
          'super_admin'::public.app_role
        )
    )
  );
