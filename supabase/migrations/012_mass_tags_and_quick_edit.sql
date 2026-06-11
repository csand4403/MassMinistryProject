-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 7: Secondary Mass tags for quick occurrence editing
-- Run this in the Supabase SQL Editor for project yznxovrzaztqxdacqvop.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE mass_time
  ADD COLUMN IF NOT EXISTS mass_tags text[] NOT NULL DEFAULT '{}';

-- Keep legacy rows non-null if the column was added manually without default.
UPDATE mass_time
SET mass_tags = '{}'
WHERE mass_tags IS NULL;
