-- ─────────────────────────────────────────────────────────────────────────────
-- Auth, app roles, and assignment response statuses
-- ─────────────────────────────────────────────────────────────────────────────

-- App-level roles are separate from ministry roles such as LECTOR or EMHC.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_user_role') THEN
    CREATE TYPE public.app_user_role AS ENUM ('ADMIN', 'SCHEDULER', 'MINISTER');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.app_user (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  parish_id uuid NOT NULL REFERENCES public.parish(id) ON DELETE CASCADE,
  minister_id uuid NULL REFERENCES public.minister(id) ON DELETE SET NULL,
  role public.app_user_role NOT NULL DEFAULT 'MINISTER',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_user_parish_id_idx
  ON public.app_user(parish_id);

CREATE INDEX IF NOT EXISTS app_user_minister_id_idx
  ON public.app_user(minister_id)
  WHERE minister_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_user_minister_id_unique
  ON public.app_user(minister_id)
  WHERE minister_id IS NOT NULL;

-- Existing assignment.status values are used for both scheduling/check-in
-- state and, now, minister responses. Preserve the current states and add
-- PENDING/DECLINED for self-service responses.
ALTER TABLE public.assignment
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SCHEDULED';

ALTER TABLE public.assignment
  DROP CONSTRAINT IF EXISTS assignment_status_check;

ALTER TABLE public.assignment
  ADD CONSTRAINT assignment_status_check
  CHECK (status IN ('SCHEDULED', 'PENDING', 'CONFIRMED', 'DECLINED', 'CHECKED_IN', 'ABSENT'));

-- Helpers for app-level authorization policies.
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
  LIMIT 1
$$;

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user TO service_role;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO service_role;

DROP POLICY IF EXISTS "Users can read own app_user" ON public.app_user;
CREATE POLICY "Users can read own app_user"
  ON public.app_user
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.current_app_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can insert app_user" ON public.app_user;
CREATE POLICY "Admins can insert app_user"
  ON public.app_user
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can update app_user" ON public.app_user;
CREATE POLICY "Admins can update app_user"
  ON public.app_user
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'ADMIN')
  WITH CHECK (public.current_app_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can delete app_user" ON public.app_user;
CREATE POLICY "Admins can delete app_user"
  ON public.app_user
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'ADMIN');
