-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Consolidate LECTOR roles + fix minister table permissions
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add the unified LECTOR value to the minister_role enum.
--    LECTOR_1/LECTOR_2 are kept for the assignment table (slot tracking).
ALTER TYPE minister_role ADD VALUE IF NOT EXISTS 'LECTOR';

-- Commit so the new enum value is visible to subsequent DML in the same session.
-- (In Supabase SQL Editor, run this block first, then the UPDATE below.)

-- 2. Update minister.roles arrays: replace every LECTOR_1 and LECTOR_2 entry
--    with a single LECTOR entry (deduplicated).
UPDATE public.minister
SET roles = ARRAY(
  SELECT DISTINCT
    CASE
      WHEN unnested = 'LECTOR_1' OR unnested = 'LECTOR_2'
        THEN 'LECTOR'::minister_role
      ELSE unnested
    END
  FROM UNNEST(roles) AS unnested
)
WHERE roles && ARRAY['LECTOR_1'::minister_role, 'LECTOR_2'::minister_role];

-- 3. Grant the missing table-level privileges that allow PostgREST to operate.
--    The anon key needs UPDATE for coordinator edits.
--    The service_role key needs full access for server-side admin operations.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minister TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minister TO service_role;

-- 4. Add the missing UPDATE RLS policy to match the existing SELECT/INSERT policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'minister'
      AND cmd        = 'UPDATE'
  ) THEN
    CREATE POLICY "Allow update on minister"
      ON public.minister
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Also add service_role UPDATE policy if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'minister'
      AND cmd        = 'UPDATE'
      AND roles::text LIKE '%service_role%'
  ) THEN
    CREATE POLICY "Allow update on minister (service_role)"
      ON public.minister
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
