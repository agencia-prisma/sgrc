CREATE TYPE public.commercial_member_type AS ENUM (
  'representative',
  'promoter'
);

CREATE TABLE public.territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (
    name = btrim(name)
    AND char_length(name) BETWEEN 1 AND 120
  ),
  code text UNIQUE CHECK (
    code IS NULL
    OR (
      code = btrim(code)
      AND char_length(code) BETWEEN 1 AND 32
    )
  ),
  parent_id uuid REFERENCES public.territories (id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE public.commercial_team_members (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_type public.commercial_member_type NOT NULL,
  manager_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (manager_user_id IS NULL OR manager_user_id <> user_id)
);

CREATE INDEX commercial_team_members_manager_user_id_idx
  ON public.commercial_team_members (manager_user_id);

CREATE TABLE public.commercial_team_territory_assignments (
  user_id uuid NOT NULL
    REFERENCES public.commercial_team_members (user_id) ON DELETE CASCADE,
  territory_id uuid NOT NULL
    REFERENCES public.territories (id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, territory_id)
);

CREATE INDEX commercial_team_territory_assignments_territory_id_idx
  ON public.commercial_team_territory_assignments (territory_id);

CREATE FUNCTION public.validate_commercial_team_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role = CASE NEW.member_type
        WHEN 'representative' THEN 'representative'::public.app_role
        WHEN 'promoter' THEN 'promoter'::public.app_role
      END
  ) THEN
    RAISE EXCEPTION 'Commercial member must have the matching application role';
  END IF;

  IF NEW.manager_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = NEW.manager_user_id
      AND role = 'sales_manager'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Commercial member manager must have the sales_manager role';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.validate_territory_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  creates_cycle boolean;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH RECURSIVE ancestors(id, parent_id) AS (
    SELECT id, parent_id
    FROM public.territories
    WHERE id = NEW.parent_id
    UNION
    SELECT parent.id, parent.parent_id
    FROM public.territories AS parent
    INNER JOIN ancestors ON parent.id = ancestors.parent_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM ancestors
    WHERE id = NEW.id
  )
  INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION 'Territory hierarchy cannot contain a cycle';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_commercial_team_member()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_territory_parent()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_commercial_team_member
  BEFORE INSERT OR UPDATE ON public.commercial_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commercial_team_member();

CREATE TRIGGER validate_territory_parent
  BEFORE INSERT OR UPDATE OF parent_id ON public.territories
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_territory_parent();

CREATE FUNCTION public.can_manage_commercial_structure()
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
        'director'::public.app_role
      )
  );
$$;

CREATE FUNCTION public.can_view_commercial_member(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_user_id = (SELECT auth.uid())
    OR public.can_manage_commercial_structure()
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
        WHERE member.user_id = target_user_id
          AND member.manager_user_id = (SELECT auth.uid())
      )
    );
$$;

CREATE FUNCTION public.can_view_commercial_territory(target_territory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.can_manage_commercial_structure()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_team_territory_assignments AS assignment
      WHERE assignment.territory_id = target_territory_id
        AND public.can_view_commercial_member(assignment.user_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_commercial_structure()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_commercial_member(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_commercial_territory(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_manage_commercial_structure()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_commercial_member(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_commercial_territory(uuid)
  TO authenticated;

ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_team_territory_assignments
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.territories,
  public.commercial_team_members,
  public.commercial_team_territory_assignments
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.territories,
  public.commercial_team_members,
  public.commercial_team_territory_assignments
TO authenticated;
GRANT ALL ON TABLE
  public.territories,
  public.commercial_team_members,
  public.commercial_team_territory_assignments
TO service_role;
GRANT USAGE ON TYPE public.commercial_member_type TO authenticated, service_role;

CREATE POLICY "Commercial users can read permitted profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.can_manage_commercial_structure()
    OR public.can_view_commercial_member(id)
  );

CREATE POLICY "Users can read permitted commercial team members"
  ON public.commercial_team_members
  FOR SELECT
  TO authenticated
  USING (public.can_view_commercial_member(user_id));

CREATE POLICY "Administrators can manage commercial team members"
  ON public.commercial_team_members
  FOR ALL
  TO authenticated
  USING (public.can_manage_commercial_structure())
  WITH CHECK (public.can_manage_commercial_structure());

CREATE POLICY "Users can read permitted territories"
  ON public.territories
  FOR SELECT
  TO authenticated
  USING (public.can_view_commercial_territory(id));

CREATE POLICY "Administrators can manage territories"
  ON public.territories
  FOR ALL
  TO authenticated
  USING (public.can_manage_commercial_structure())
  WITH CHECK (public.can_manage_commercial_structure());

CREATE POLICY "Users can read permitted territory assignments"
  ON public.commercial_team_territory_assignments
  FOR SELECT
  TO authenticated
  USING (public.can_view_commercial_member(user_id));

CREATE POLICY "Administrators can manage territory assignments"
  ON public.commercial_team_territory_assignments
  FOR ALL
  TO authenticated
  USING (public.can_manage_commercial_structure())
  WITH CHECK (public.can_manage_commercial_structure());

CREATE TRIGGER set_territories_updated_at
  BEFORE UPDATE ON public.territories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_commercial_team_members_updated_at
  BEFORE UPDATE ON public.commercial_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
