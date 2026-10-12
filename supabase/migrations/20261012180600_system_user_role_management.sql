CREATE FUNCTION public.admin_assign_user_role(
  target_user_id uuid,
  target_role public.app_role,
  target_display_name text,
  assigned_by_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the service role can manage application roles';
  END IF;

  IF target_display_name IS NOT NULL THEN
    IF target_display_name <> pg_catalog.btrim(target_display_name)
      OR pg_catalog.char_length(target_display_name) NOT BETWEEN 1 AND 120
    THEN
      RAISE EXCEPTION 'Display name must contain between 1 and 120 characters';
    END IF;

    UPDATE public.profiles
    SET display_name = target_display_name
    WHERE id = target_user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'User profile does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = assigned_by_user_id
      AND role = 'super_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Role assignment actor is not a system administrator';
  END IF;

  IF target_role = 'representative'::public.app_role THEN
    DELETE FROM public.user_roles
    WHERE user_id = target_user_id
      AND role = 'promoter'::public.app_role;
  ELSIF target_role = 'promoter'::public.app_role THEN
    DELETE FROM public.user_roles
    WHERE user_id = target_user_id
      AND role = 'representative'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, target_role, assigned_by_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF target_role IN (
    'representative'::public.app_role,
    'promoter'::public.app_role
  ) THEN
    INSERT INTO public.commercial_team_members (
      user_id,
      member_type,
      manager_user_id
    )
    VALUES (
      target_user_id,
      CASE target_role
        WHEN 'representative'::public.app_role
          THEN 'representative'::public.commercial_member_type
        ELSE 'promoter'::public.commercial_member_type
      END,
      NULL
    )
    ON CONFLICT (user_id) DO UPDATE
    SET member_type = EXCLUDED.member_type;
  END IF;
END;
$$;

CREATE FUNCTION public.admin_remove_user_role(
  target_user_id uuid,
  target_role public.app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed_count integer;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the service role can manage application roles';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sgrc-super-admin-role-management', 0)
  );

  IF target_role = 'super_admin'::public.app_role
    AND (
      SELECT pg_catalog.count(*)
      FROM public.user_roles
      WHERE role = 'super_admin'::public.app_role
    ) <= 1
  THEN
    RAISE EXCEPTION 'The last system administrator role cannot be removed';
  END IF;

  IF target_role IN (
    'representative'::public.app_role,
    'promoter'::public.app_role
  ) THEN
    DELETE FROM public.commercial_team_members
    WHERE user_id = target_user_id
      AND member_type = CASE target_role
        WHEN 'representative'::public.app_role
          THEN 'representative'::public.commercial_member_type
        ELSE 'promoter'::public.commercial_member_type
      END;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role = target_role;

  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_user_role(
  uuid,
  public.app_role,
  text,
  uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_remove_user_role(
  uuid,
  public.app_role
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_role(
  uuid,
  public.app_role,
  text,
  uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_role(
  uuid,
  public.app_role
) TO service_role;
