-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6: Catholic-native Mass taxonomy and template defaults
-- Run this in the Supabase SQL Editor for project yznxovrzaztqxdacqvop.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Templates carry the default label for generated Mass occurrences.
ALTER TABLE mass_template
  ADD COLUMN IF NOT EXISTS mass_type text NOT NULL DEFAULT 'DAILY_MASS';

-- 2. Drop the old mass_time constraint before writing the new values.
DO $$ BEGIN
  ALTER TABLE mass_time DROP CONSTRAINT IF EXISTS mass_time_type_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mass_template DROP CONSTRAINT IF EXISTS mass_template_type_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 3. Normalize legacy one-off labels before tightening constraints.
UPDATE mass_time
SET mass_type = CASE mass_type
  WHEN 'REGULAR' THEN 'DAILY_MASS'
  WHEN 'HOLY_DAY' THEN 'HOLY_DAY_OF_OBLIGATION'
  WHEN 'ADORATION' THEN 'OTHER'
  ELSE mass_type
END
WHERE mass_type IN ('REGULAR', 'HOLY_DAY', 'ADORATION');

-- 4. Classify existing templates by Catholic calendar usage.
UPDATE mass_template
SET mass_type = CASE
  WHEN day_type = 'SUNDAY' THEN 'SUNDAY_MASS'
  WHEN day_type = 'SCHOOL_MASS' THEN 'SCHOOL_MASS'
  WHEN day_type = 'HOLY_DAY' THEN 'HOLY_DAY_OF_OBLIGATION'
  WHEN day_type = 'WEEKDAY'
       AND day_of_week = ARRAY[6]::integer[]
       AND start_time >= '16:00' THEN 'SATURDAY_VIGIL'
  ELSE 'DAILY_MASS'
END;

-- 5. Backfill existing generated Masses from their template defaults.
UPDATE mass_time mt
SET mass_type = t.mass_type,
    is_special = t.mass_type NOT IN ('DAILY_MASS', 'SUNDAY_MASS', 'SATURDAY_VIGIL')
FROM mass_template t
WHERE mt.template_id = t.id;

-- 6. Apply date-based Holy Day of Obligation labels to existing occurrences.
UPDATE mass_time mt
SET mass_type = 'HOLY_DAY_OF_OBLIGATION',
    is_special = true
FROM liturgical_date ld
WHERE mt.liturgical_date_id = ld.id
  AND ld.is_holy_day_of_obligation = true;

-- 7. Refresh display names to use the Catholic-native labels.
UPDATE mass_time
SET display_name = time_label || ' ' || CASE mass_type
  WHEN 'DAILY_MASS' THEN 'Daily Mass'
  WHEN 'SUNDAY_MASS' THEN 'Sunday Mass'
  WHEN 'SATURDAY_VIGIL' THEN 'Saturday Vigil'
  WHEN 'FUNERAL' THEN 'Funeral Mass'
  WHEN 'WEDDING' THEN 'Wedding Mass'
  WHEN 'HOLY_DAY_OF_OBLIGATION' THEN 'Holy Day of Obligation'
  WHEN 'SCHOOL_MASS' THEN 'School Mass'
  WHEN 'BAPTISM_MASS' THEN 'Baptism Mass'
  WHEN 'QUINCEANERA_MASS' THEN 'Quinceanera Mass'
  WHEN 'MEMORIAL_MASS' THEN 'Memorial Mass'
  ELSE 'Other Mass'
END;

-- 8. Add the Catholic-native check constraints.
DO $$ BEGIN
  ALTER TABLE mass_time DROP CONSTRAINT IF EXISTS mass_time_type_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mass_template DROP CONSTRAINT IF EXISTS mass_template_type_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE mass_time
  ADD CONSTRAINT mass_time_type_check
  CHECK (mass_type IN (
    'DAILY_MASS',
    'SUNDAY_MASS',
    'SATURDAY_VIGIL',
    'FUNERAL',
    'WEDDING',
    'HOLY_DAY_OF_OBLIGATION',
    'SCHOOL_MASS',
    'BAPTISM_MASS',
    'QUINCEANERA_MASS',
    'MEMORIAL_MASS',
    'OTHER'
  ));

ALTER TABLE mass_template
  ADD CONSTRAINT mass_template_type_check
  CHECK (mass_type IN (
    'DAILY_MASS',
    'SUNDAY_MASS',
    'SATURDAY_VIGIL',
    'FUNERAL',
    'WEDDING',
    'HOLY_DAY_OF_OBLIGATION',
    'SCHOOL_MASS',
    'BAPTISM_MASS',
    'QUINCEANERA_MASS',
    'MEMORIAL_MASS',
    'OTHER'
  ));
