import { createClient } from "@supabase/supabase-js";

/**
 * Server-side admin client using the service_role key.
 * Bypasses RLS — use only in server actions, never in client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
