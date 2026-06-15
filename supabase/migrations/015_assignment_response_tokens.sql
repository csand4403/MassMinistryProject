-- ─────────────────────────────────────────────────────────────────────────────
-- Assignment response tokens for no-login confirm/decline email links
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assignment_response_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignment(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignment_response_token_assignment_id_idx
  ON public.assignment_response_token(assignment_id);

CREATE INDEX IF NOT EXISTS assignment_response_token_valid_idx
  ON public.assignment_response_token(token_hash, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.assignment_response_token ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_response_token TO service_role;

DROP POLICY IF EXISTS "Service role manages assignment response tokens" ON public.assignment_response_token;
CREATE POLICY "Service role manages assignment response tokens"
  ON public.assignment_response_token
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
