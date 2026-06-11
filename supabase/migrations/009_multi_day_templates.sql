-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4: Multi-day templates + weekday consolidation
-- Run this in the Supabase SQL Editor for project yznxovrzaztqxdacqvop.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Change day_of_week from integer to integer[] to support multi-day templates.
--    Existing single-day values are wrapped in an array.
ALTER TABLE mass_template
  ALTER COLUMN day_of_week TYPE integer[]
  USING CASE WHEN day_of_week IS NULL THEN NULL ELSE ARRAY[day_of_week::integer] END;

-- 2. Remove the check constraint on the old integer column (already dropped by type change,
--    but guard with IF EXISTS in case the DB kept it).
DO $$ BEGIN
  ALTER TABLE mass_template DROP CONSTRAINT IF EXISTS mass_template_day_of_week_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 3. Consolidate Mon/Wed/Fri 8:15 AM into one template.
DO $$
DECLARE
  v_mon_id   uuid;
  v_wed_id   uuid;
  v_fri_id   uuid;
  v_new_id   uuid;
BEGIN
  SELECT id INTO v_mon_id FROM mass_template WHERE name = 'Monday 8:15 AM (English)' LIMIT 1;
  SELECT id INTO v_wed_id FROM mass_template WHERE name = 'Wednesday 8:15 AM (English)' LIMIT 1;
  SELECT id INTO v_fri_id FROM mass_template WHERE name = 'Friday 8:15 AM (English)' LIMIT 1;

  IF v_mon_id IS NULL AND v_wed_id IS NULL AND v_fri_id IS NULL THEN
    RETURN; -- already consolidated
  END IF;

  -- Create the consolidated template (use Monday's settings as base)
  INSERT INTO mass_template (parish_id, name, day_type, day_of_week, start_time, language, notes)
  SELECT parish_id, 'Weekday 8:15 AM (Mon/Wed/Fri)', 'WEEKDAY', ARRAY[1,3,5], '08:15', language, notes
  FROM mass_template WHERE id = COALESCE(v_mon_id, v_wed_id, v_fri_id) LIMIT 1
  RETURNING id INTO v_new_id;

  -- Copy role configs from Monday template
  INSERT INTO mass_template_role (template_id, role, min_count, max_count)
  SELECT v_new_id, role, min_count, max_count
  FROM mass_template_role
  WHERE template_id = COALESCE(v_mon_id, v_wed_id, v_fri_id);

  -- Re-link mass_times
  UPDATE mass_time SET template_id = v_new_id
  WHERE template_id IN (v_mon_id, v_wed_id, v_fri_id);

  -- Delete old templates (role configs cascade via FK or we delete manually first)
  DELETE FROM mass_template_role WHERE template_id IN (v_mon_id, v_wed_id, v_fri_id);
  DELETE FROM mass_template       WHERE id           IN (v_mon_id, v_wed_id, v_fri_id);
END $$;

-- 4. Consolidate Mon/Tue/Wed/Thu/Fri 5:30 PM into one template.
DO $$
DECLARE
  v_ids  uuid[];
  v_base uuid;
  v_new_id uuid;
BEGIN
  SELECT ARRAY_AGG(id) INTO v_ids
  FROM mass_template
  WHERE name IN (
    'Monday 5:30 PM (English)',
    'Tuesday 5:30 PM (English)',
    'Wednesday 5:30 PM (English)',
    'Thursday 5:30 PM (English)',
    'Friday 5:30 PM (English)'
  );

  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN;
  END IF;

  v_base := v_ids[1];

  INSERT INTO mass_template (parish_id, name, day_type, day_of_week, start_time, language, notes)
  SELECT parish_id, 'Weekday 5:30 PM (Mon–Fri)', 'WEEKDAY', ARRAY[1,2,3,4,5], '17:30', language, notes
  FROM mass_template WHERE id = v_base LIMIT 1
  RETURNING id INTO v_new_id;

  INSERT INTO mass_template_role (template_id, role, min_count, max_count)
  SELECT v_new_id, role, min_count, max_count
  FROM mass_template_role WHERE template_id = v_base;

  UPDATE mass_time SET template_id = v_new_id
  WHERE template_id = ANY(v_ids);

  DELETE FROM mass_template_role WHERE template_id = ANY(v_ids);
  DELETE FROM mass_template       WHERE id          = ANY(v_ids);
END $$;

-- 5. Consolidate Tue/Thu 8:00 AM into one template.
DO $$
DECLARE
  v_tue_id uuid;
  v_thu_id uuid;
  v_new_id uuid;
BEGIN
  SELECT id INTO v_tue_id FROM mass_template WHERE name = 'Tuesday 8:00 AM (English)'  LIMIT 1;
  SELECT id INTO v_thu_id FROM mass_template WHERE name = 'Thursday 8:00 AM (English)' LIMIT 1;

  IF v_tue_id IS NULL AND v_thu_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO mass_template (parish_id, name, day_type, day_of_week, start_time, language, notes)
  SELECT parish_id, 'Weekday 8:00 AM (Tue/Thu)', 'WEEKDAY', ARRAY[2,4], '08:00', language, notes
  FROM mass_template WHERE id = COALESCE(v_tue_id, v_thu_id) LIMIT 1
  RETURNING id INTO v_new_id;

  INSERT INTO mass_template_role (template_id, role, min_count, max_count)
  SELECT v_new_id, role, min_count, max_count
  FROM mass_template_role WHERE template_id = COALESCE(v_tue_id, v_thu_id);

  UPDATE mass_time SET template_id = v_new_id
  WHERE template_id IN (v_tue_id, v_thu_id);

  DELETE FROM mass_template_role WHERE template_id IN (v_tue_id, v_thu_id);
  DELETE FROM mass_template       WHERE id          IN (v_tue_id, v_thu_id);
END $$;
