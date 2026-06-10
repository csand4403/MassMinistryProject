-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2A: Templates, Celebrant Flags, Language
-- Run this in the Supabase SQL Editor for the yznxovrzaztqxdacqvop project.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add new role values to the minister_role enum
ALTER TYPE minister_role ADD VALUE IF NOT EXISTS 'ALTAR_SERVER';
ALTER TYPE minister_role ADD VALUE IF NOT EXISTS 'THURIFER';

-- 2. Language enum
DO $$ BEGIN
  CREATE TYPE mass_language AS ENUM (
    'ENGLISH',
    'SPANISH',
    'FRENCH',
    'BILINGUAL_EN_ES',
    'BILINGUAL_EN_FR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Priest type enum
DO $$ BEGIN
  CREATE TYPE priest_type AS ENUM (
    'PASTOR_ON_STAFF',
    'ASSOCIATE_ON_STAFF',
    'VISITING_CELEBRANT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Mass template table
CREATE TABLE IF NOT EXISTS mass_template (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id       uuid REFERENCES parish(id) NOT NULL,
  name            text NOT NULL,
  day_type        text NOT NULL CHECK (day_type IN ('SUNDAY', 'WEEKDAY', 'HOLY_DAY', 'SCHOOL_MASS')),
  start_time      text NOT NULL,
  language        mass_language NOT NULL DEFAULT 'ENGLISH',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 5. Per-role min/max config within a template
CREATE TABLE IF NOT EXISTS mass_template_role (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES mass_template(id) ON DELETE CASCADE NOT NULL,
  role        text NOT NULL,
  min_count   int NOT NULL DEFAULT 0,
  max_count   int NOT NULL DEFAULT 1,
  UNIQUE (template_id, role)
);

-- 6. Link mass_time to a template (optional), and store language per mass
ALTER TABLE mass_time
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES mass_template(id),
  ADD COLUMN IF NOT EXISTS language    mass_language DEFAULT 'ENGLISH';

-- 7. Priest-specific fields on minister
ALTER TABLE minister
  ADD COLUMN IF NOT EXISTS priest_type             priest_type,
  ADD COLUMN IF NOT EXISTS minister_diocese        text DEFAULT 'Diocese of Dallas',
  ADD COLUMN IF NOT EXISTS letter_of_suitability   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS letter_expiration_date  date;

-- 8. RLS for new tables (permissive — no user auth in this app)
ALTER TABLE mass_template      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_template_role ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read mass_template"      ON mass_template;
DROP POLICY IF EXISTS "Admin write mass_template"      ON mass_template;
DROP POLICY IF EXISTS "Public read mass_template_role" ON mass_template_role;
DROP POLICY IF EXISTS "Admin write mass_template_role" ON mass_template_role;

CREATE POLICY "Public read mass_template"
  ON mass_template FOR SELECT USING (true);

CREATE POLICY "Admin write mass_template"
  ON mass_template FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read mass_template_role"
  ON mass_template_role FOR SELECT USING (true);

CREATE POLICY "Admin write mass_template_role"
  ON mass_template_role FOR ALL USING (true) WITH CHECK (true);

-- 9. Grant access to service_role for new tables
GRANT ALL ON mass_template      TO service_role;
GRANT ALL ON mass_template_role TO service_role;
GRANT ALL ON mass_template      TO anon;
GRANT ALL ON mass_template_role TO anon;
