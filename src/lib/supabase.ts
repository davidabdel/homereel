import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Prefer env config; fall back to the project's public values so existing
// deployments keep working until NEXT_PUBLIC_SUPABASE_* is set everywhere.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkgkuiuycqyzobbiwxpx.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZ2t1aXV5Y3F5em9iYml3eHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMjQyMjYsImV4cCI6MjA3NDgwMDIyNn0.WkwwTwI-S_pmD-8xb2mL8P2-ezMCSSXDtqsipEbwUvQ'

// Create a single supabase client for the entire application
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Create a browser client (for client components)
export const createSupabaseBrowserClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
