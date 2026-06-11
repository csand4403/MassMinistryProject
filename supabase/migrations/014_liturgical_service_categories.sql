-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 8: Celebration categories and non-Mass liturgies
-- Run this in the Supabase SQL Editor for project yznxovrzaztqxdacqvop.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Mass occurrences now distinguish sacramental Masses from other liturgies.
ALTER TABLE mass_time
  ADD COLUMN IF NOT EXISTS celebration_category text NOT NULL DEFAULT 'MASS';

UPDATE mass_time
SET celebration_category = 'MASS'
WHERE celebration_category IS NULL
   OR celebration_category NOT IN ('MASS', 'LITURGICAL_SERVICE');

-- 2. Widen the existing Mass type check to include non-Mass liturgical services.
DO $$ BEGIN
  ALTER TABLE mass_time DROP CONSTRAINT IF EXISTS mass_time_type_check;
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
    'OTHER',
    'COMMUNION_SERVICE',
    'LITURGY_OF_THE_WORD',
    'FUNERAL_VIGIL',
    'GRAVESIDE_SERVICE',
    'WEDDING_CEREMONY_NON_MASS',
    'QUINCEANERA_BLESSING',
    'RECONCILIATION_SERVICE'
  ));

-- 3. Keep category and subtype aligned for future inserts and edits.
DO $$ BEGIN
  ALTER TABLE mass_time DROP CONSTRAINT IF EXISTS mass_time_celebration_category_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE mass_time
  ADD CONSTRAINT mass_time_celebration_category_check
  CHECK (celebration_category IN ('MASS', 'LITURGICAL_SERVICE'));

DO $$ BEGIN
  ALTER TABLE mass_time DROP CONSTRAINT IF EXISTS mass_time_category_type_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE mass_time
  ADD CONSTRAINT mass_time_category_type_check
  CHECK (
    (
      celebration_category = 'MASS'
      AND mass_type IN (
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
      )
    )
    OR
    (
      celebration_category = 'LITURGICAL_SERVICE'
      AND mass_type IN (
        'COMMUNION_SERVICE',
        'LITURGY_OF_THE_WORD',
        'FUNERAL_VIGIL',
        'GRAVESIDE_SERVICE',
        'WEDDING_CEREMONY_NON_MASS',
        'QUINCEANERA_BLESSING',
        'RECONCILIATION_SERVICE'
      )
    )
  );
