CREATE FUNCTION public.has_required_mfa_assurance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role IN (
        'super_admin'::public.app_role,
        'director'::public.app_role,
        'sales_manager'::public.app_role,
        'finance'::public.app_role
      )
  )
  OR COALESCE((SELECT auth.jwt() ->> 'aal') = 'aal2', false);
$$;

REVOKE ALL ON FUNCTION public.has_required_mfa_assurance()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_required_mfa_assurance()
  TO authenticated, service_role;

CREATE FUNCTION public.enforce_required_mfa_assurance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_required_mfa_assurance() THEN
    RAISE EXCEPTION 'Multi-factor authentication is required'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_required_mfa_assurance()
  FROM PUBLIC, anon, authenticated;

CREATE POLICY "Privileged users require MFA assurance"
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.territories
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.commercial_team_members
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.commercial_team_territory_assignments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.crm_records
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.crm_interactions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.products
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.sales_orders
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.sales_order_items
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE POLICY "Privileged users require MFA assurance"
  ON public.sales_order_notifications
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_required_mfa_assurance()))
  WITH CHECK ((SELECT public.has_required_mfa_assurance()));

CREATE TRIGGER enforce_required_mfa_assurance
  BEFORE INSERT OR UPDATE OR DELETE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_required_mfa_assurance();

CREATE TRIGGER enforce_required_mfa_assurance
  BEFORE INSERT OR UPDATE OR DELETE ON public.sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_required_mfa_assurance();
