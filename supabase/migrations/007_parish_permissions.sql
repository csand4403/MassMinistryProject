GRANT SELECT, INSERT, UPDATE, DELETE ON parish TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON parish TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'parish'
    AND policyname = 'Allow all on parish'
  ) THEN
    CREATE POLICY "Allow all on parish"
    ON parish FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;
