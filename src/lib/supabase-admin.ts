import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./api-guard";

/**
 * Service-role Supabase client for server-only, no-session contexts
 * (Stripe webhook, cron). Bypasses RLS — NEVER import this into client code
 * or any route reachable without a trusted secret.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
