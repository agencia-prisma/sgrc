CREATE FUNCTION public.create_commercial_team_member(
  target_user_id uuid,
  target_member_type public.commercial_member_type,
  target_display_name text,
  target_manager_user_id uuid,
  target_territory_ids uuid[],
  assigned_by_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  member_role public.app_role;
BEGIN
  IF target_display_name IS NULL
    OR target_display_name <> btrim(target_display_name)
    OR char_length(target_display_name) NOT BETWEEN 1 AND 120
  THEN
    RAISE EXCEPTION 'Display name must contain between 1 and 120 characters';
  END IF;

  member_role := CASE target_member_type
    WHEN 'representative' THEN 'representative'::public.app_role
    WHEN 'promoter' THEN 'promoter'::public.app_role
  END;

  UPDATE public.profiles
  SET display_name = target_display_name
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile does not exist for the invited user';
  END IF;

  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, member_role, assigned_by_user_id);

  INSERT INTO public.commercial_team_members (
    user_id,
    member_type,
    manager_user_id
  )
  VALUES (
    target_user_id,
    target_member_type,
    target_manager_user_id
  );

  INSERT INTO public.commercial_team_territory_assignments (
    user_id,
    territory_id,
    assigned_by
  )
  SELECT target_user_id, territory.territory_id, assigned_by_user_id
  FROM pg_catalog.unnest(
    COALESCE(target_territory_ids, ARRAY[]::uuid[])
  ) AS territory(territory_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_commercial_team_member(
  uuid,
  public.commercial_member_type,
  text,
  uuid,
  uuid[],
  uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_commercial_team_member(
  uuid,
  public.commercial_member_type,
  text,
  uuid,
  uuid[],
  uuid
) TO service_role;
