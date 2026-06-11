-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 5: Calendar exceptions for one-off and cancelled Masses
-- Run this in the Supabase SQL Editor for project yznxovrzaztqxdacqvop.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Status, Mass type, and notes live on each calendar occurrence.
ALTER TABLE mass_time
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS mass_type text NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS notes text;

DO $$ BEGIN
  ALTER TABLE mass_time
    ADD CONSTRAINT mass_time_status_check
    CHECK (status IN ('SCHEDULED', 'CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mass_time
    ADD CONSTRAINT mass_time_type_check
    CHECK (mass_type IN (
      'REGULAR',
      'FUNERAL',
      'WEDDING',
      'HOLY_DAY',
      'HOLY_DAY_OF_OBLIGATION',
      'SCHOOL_MASS',
      'ADORATION',
      'OTHER'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Keep template_id nullable for true one-off Masses and unlinked exceptions.
ALTER TABLE mass_time
  ALTER COLUMN template_id DROP NOT NULL;

-- 3. Allow multiple Masses on the same date/time while preserving one generated
--    occurrence per recurring template/date.
DO $$ BEGIN
  ALTER TABLE mass_time
    DROP CONSTRAINT IF EXISTS mass_time_lit_date_time_unique;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS mass_time_lit_date_template_unique
  ON mass_time (liturgical_date_id, template_id)
  WHERE template_id IS NOT NULL;

-- 4. Per-occurrence role requirements. Recurring Masses can still use
--    mass_template_role; one-off and modified occurrences use this table.
CREATE TABLE IF NOT EXISTS mass_time_role (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mass_time_id uuid REFERENCES mass_time(id) ON DELETE CASCADE NOT NULL,
  role         text NOT NULL,
  min_count    int NOT NULL DEFAULT 0,
  max_count    int NOT NULL DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (mass_time_id, role)
);

ALTER TABLE mass_time_role ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on mass_time_role" ON mass_time_role;
CREATE POLICY "Allow all on mass_time_role"
  ON mass_time_role FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON mass_time_role TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON mass_time_role TO service_role;
