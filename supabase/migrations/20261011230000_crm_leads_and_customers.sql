CREATE TYPE public.crm_record_type AS ENUM ('company', 'person');
CREATE TYPE public.crm_record_status AS ENUM (
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost'
);
CREATE TYPE public.crm_interaction_type AS ENUM (
  'note',
  'call',
  'email',
  'meeting',
  'whatsapp',
  'other'
);

CREATE TABLE public.crm_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type public.crm_record_type NOT NULL,
  name text NOT NULL CHECK (
    name = btrim(name)
    AND char_length(name) BETWEEN 1 AND 160
  ),
  trade_name text CHECK (
    trade_name IS NULL
    OR (
      trade_name = btrim(trade_name)
      AND char_length(trade_name) BETWEEN 1 AND 160
    )
  ),
  CHECK (record_type = 'company' OR trade_name IS NULL),
  document text CHECK (
    document IS NULL
    OR (
      (record_type = 'company' AND document ~ '^[0-9A-Z]{12}[0-9]{2}$')
      OR (
        record_type = 'person'
        AND document ~ '^[0-9]{11}$'
      )
    )
  ),
  email text CHECK (email IS NULL OR char_length(email) <= 254),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 32),
  status public.crm_record_status NOT NULL DEFAULT 'new',
  territory_id uuid REFERENCES public.territories (id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crm_records_type_document_uidx
  ON public.crm_records (record_type, document)
  WHERE document IS NOT NULL;
CREATE INDEX crm_records_owner_updated_at_idx
  ON public.crm_records (owner_user_id, updated_at DESC);
CREATE INDEX crm_records_territory_id_idx
  ON public.crm_records (territory_id);
CREATE INDEX crm_records_status_updated_at_idx
  ON public.crm_records (status, updated_at DESC);

CREATE TABLE public.crm_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.crm_records (id) ON DELETE CASCADE,
  interaction_type public.crm_interaction_type NOT NULL,
  summary text NOT NULL CHECK (
    summary = btrim(summary)
    AND char_length(summary) BETWEEN 1 AND 160
  ),
  details text CHECK (details IS NULL OR char_length(details) <= 4000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_interactions_record_occurred_at_idx
  ON public.crm_interactions (record_id, occurred_at DESC);

CREATE FUNCTION public.can_access_crm()
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
        'super_admin'::public.app_role,
        'director'::public.app_role,
        'sales_manager'::public.app_role,
        'representative'::public.app_role,
        'promoter'::public.app_role
      )
  );
$$;

CREATE FUNCTION public.can_manage_crm_record(
  target_owner_user_id uuid,
  target_territory_id uuid
)
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
      AND (
        target_territory_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.commercial_team_territory_assignments AS assignment
          WHERE assignment.user_id = target_owner_user_id
            AND assignment.territory_id = target_territory_id
        )
      )
    );
$$;

CREATE FUNCTION public.can_view_crm_record(
  target_owner_user_id uuid,
  target_territory_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.can_manage_crm_record(
    target_owner_user_id,
    target_territory_id
  );
$$;

CREATE FUNCTION public.prevent_crm_record_creator_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by <> OLD.created_by THEN
    RAISE EXCEPTION 'CRM record creator cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_crm()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_crm_record(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_crm_record(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_crm_record_creator_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_crm()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_crm_record(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_crm_record(uuid, uuid)
  TO authenticated;

ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_records, public.crm_interactions
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.crm_records TO authenticated;
GRANT INSERT (
  record_type,
  name,
  trade_name,
  document,
  email,
  phone,
  territory_id,
  owner_user_id,
  notes
) ON TABLE public.crm_records TO authenticated;
GRANT UPDATE (
  name,
  trade_name,
  document,
  email,
  phone,
  status,
  territory_id,
  owner_user_id,
  notes
) ON TABLE public.crm_records TO authenticated;
GRANT SELECT ON TABLE public.crm_interactions TO authenticated;
GRANT INSERT (
  record_id,
  interaction_type,
  summary,
  details
) ON TABLE public.crm_interactions TO authenticated;
GRANT ALL ON TABLE public.crm_records, public.crm_interactions TO service_role;
GRANT USAGE ON TYPE
  public.crm_record_type,
  public.crm_record_status,
  public.crm_interaction_type
TO authenticated, service_role;

CREATE POLICY "CRM users can read permitted records"
  ON public.crm_records
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_crm_record(owner_user_id, territory_id)
  );

CREATE POLICY "CRM users can create permitted records"
  ON public.crm_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.can_manage_crm_record(owner_user_id, territory_id)
  );

CREATE POLICY "CRM users can update permitted records"
  ON public.crm_records
  FOR UPDATE
  TO authenticated
  USING (
    public.can_manage_crm_record(owner_user_id, territory_id)
  )
  WITH CHECK (
    public.can_manage_crm_record(owner_user_id, territory_id)
  );

CREATE POLICY "CRM users can read permitted interactions"
  ON public.crm_interactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crm_records AS record
      WHERE record.id = record_id
        AND public.can_view_crm_record(
          record.owner_user_id,
          record.territory_id
        )
    )
  );

CREATE POLICY "CRM users can create permitted interactions"
  ON public.crm_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.crm_records AS record
      WHERE record.id = record_id
        AND public.can_manage_crm_record(
          record.owner_user_id,
          record.territory_id
        )
    )
  );

CREATE TRIGGER prevent_crm_record_creator_change
  BEFORE UPDATE ON public.crm_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_crm_record_creator_change();

CREATE TRIGGER set_crm_records_updated_at
  BEFORE UPDATE ON public.crm_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
