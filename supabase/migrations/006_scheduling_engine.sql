-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3: Scheduling Engine — per-weekday templates, constraints, clergy seed
-- Run this in the Supabase SQL Editor for project yznxovrzaztqxdacqvop.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add day_of_week column to mass_template so templates can target a specific
--    day of the week (0=Sunday … 6=Saturday). NULL means "all days of this type."
ALTER TABLE mass_template
  ADD COLUMN IF NOT EXISTS day_of_week integer
  CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6));

-- 2. Unique constraint on liturgical_date(parish_id, date) — prevents duplicate
--    date rows per parish and enables upsert conflict resolution.
DO $$ BEGIN
  ALTER TABLE liturgical_date
    ADD CONSTRAINT liturgical_date_parish_date_unique UNIQUE (parish_id, date);
EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN duplicate_object THEN NULL; END $$;

-- 3. Unique constraint on mass_time(liturgical_date_id, time_label) — prevents
--    duplicate Mass slots on the same day and enables idempotent generation.
DO $$ BEGIN
  ALTER TABLE mass_time
    ADD CONSTRAINT mass_time_lit_date_time_unique UNIQUE (liturgical_date_id, time_label);
EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN duplicate_object THEN NULL; END $$;

-- 4. Seed MIC clergy (idempotent — skips rows that already exist by email)
DO $$
DECLARE
  v_parish_id uuid;
BEGIN
  SELECT id INTO v_parish_id FROM parish LIMIT 1;

  -- Fr. Alfonse Nazzaro — Pastor on Staff
  INSERT INTO minister (parish_id, first_name, last_name, email, roles,
                        notification_preference, is_active, priest_type, minister_diocese)
  SELECT v_parish_id, 'Alfonse', 'Nazzaro', 'pastor@maryimmaculatechurch.org',
         ARRAY['CELEBRANT']::minister_role[], 'email', true, 'PASTOR_ON_STAFF', 'Diocese of Dallas'
  WHERE NOT EXISTS (
    SELECT 1 FROM minister WHERE email = 'pastor@maryimmaculatechurch.org'
  );

  -- Fr. Juan Torres — Associate on Staff
  INSERT INTO minister (parish_id, first_name, last_name, email, roles,
                        notification_preference, is_active, priest_type, minister_diocese)
  SELECT v_parish_id, 'Juan', 'Torres', 'frjtorres@maryimmaculatechurch.org',
         ARRAY['CELEBRANT']::minister_role[], 'email', true, 'ASSOCIATE_ON_STAFF', 'Diocese of Dallas'
  WHERE NOT EXISTS (
    SELECT 1 FROM minister WHERE email = 'frjtorres@maryimmaculatechurch.org'
  );

  -- Fr. Franck Agbowai — Associate on Staff
  INSERT INTO minister (parish_id, first_name, last_name, email, roles,
                        notification_preference, is_active, priest_type, minister_diocese)
  SELECT v_parish_id, 'Franck', 'Agbowai', 'frfrancka@maryimmaculatechurch.org',
         ARRAY['CELEBRANT']::minister_role[], 'email', true, 'ASSOCIATE_ON_STAFF', 'Diocese of Dallas'
  WHERE NOT EXISTS (
    SELECT 1 FROM minister WHERE email = 'frfrancka@maryimmaculatechurch.org'
  );

  -- Deacon David Dusse
  INSERT INTO minister (parish_id, first_name, last_name, email, roles,
                        notification_preference, is_active, minister_diocese)
  SELECT v_parish_id, 'David', 'Dusse', 'dcndavidd@maryimmaculatechurch.org',
         ARRAY['DEACON']::minister_role[], 'email', true, 'Diocese of Dallas'
  WHERE NOT EXISTS (
    SELECT 1 FROM minister WHERE email = 'dcndavidd@maryimmaculatechurch.org'
  );

  -- Deacon William Mejia
  INSERT INTO minister (parish_id, first_name, last_name, email, roles,
                        notification_preference, is_active, minister_diocese)
  SELECT v_parish_id, 'William', 'Mejia', 'dcnwilliamm@maryimmaculatechurch.org',
         ARRAY['DEACON']::minister_role[], 'email', true, 'Diocese of Dallas'
  WHERE NOT EXISTS (
    SELECT 1 FROM minister WHERE email = 'dcnwilliamm@maryimmaculatechurch.org'
  );
END $$;
