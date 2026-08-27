import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase throws on construction when the URL or key is missing, which took
 * the entire app down — public pages included — rather than just the
 * signed-in parts.
 *
 * When nothing is configured (demo mode, or a fresh checkout) we hand it
 * syntactically valid placeholders instead. Construction succeeds, no session
 * is ever found, and the public site and demo walk-through keep working. The
 * types stay exactly as they were, so nothing downstream has to change.
 */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'public-anon-key-not-configured'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY

/** True once real Supabase credentials are present. */
export const supabaseConfigured =
  supabaseUrl !== PLACEHOLDER_URL && supabaseAnonKey !== PLACEHOLDER_KEY

// Create a single supabase client for the entire application
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Create a browser client (for client components)
export const createSupabaseBrowserClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
