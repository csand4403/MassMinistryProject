GRANT SELECT, INSERT, UPDATE, DELETE ON assignment TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON assignment TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON check_in TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON check_in TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assignment'
    AND policyname = 'Allow all on assignment'
  ) THEN
    CREATE POLICY "Allow all on assignment"
    ON assignment FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'check_in'
    AND policyname = 'Allow all on check_in'
  ) THEN
    CREATE POLICY "Allow all on check_in"
    ON check_in FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;
