-- Ensure active administrators can read every shop, including inactive/closed shops.
-- Public/anonymous access remains restricted by the existing active-shop policy.
DROP POLICY IF EXISTS lojas_admin_select_all ON public.lojas;
CREATE POLICY lojas_admin_select_all
  ON public.lojas
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
