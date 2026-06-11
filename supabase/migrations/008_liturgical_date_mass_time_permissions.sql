-- Grant full DML access on liturgical_date and mass_time to both roles.
-- These tables were created without explicit grants, blocking service_role
-- INSERT/SELECT used by the scheduling engine and seed scripts.

GRANT SELECT, INSERT, UPDATE, DELETE ON liturgical_date TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON liturgical_date TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON mass_time TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON mass_time TO service_role;

-- Ensure permissive RLS policies exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'liturgical_date' AND policyname = 'Allow all on liturgical_date'
  ) THEN
    CREATE POLICY "Allow all on liturgical_date" ON liturgical_date FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mass_time' AND policyname = 'Allow all on mass_time'
  ) THEN
    CREATE POLICY "Allow all on mass_time" ON mass_time FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
