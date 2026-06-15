-- Add access status for app users.
ALTER TABLE public.app_user
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Inactive users should not receive an app role through RLS helpers.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.app_user
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO service_role;
