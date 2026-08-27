import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Fall back to the project's public values so existing deployments keep working
// until NEXT_PUBLIC_SUPABASE_* env vars are set everywhere.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jkgkuiuycqyzobbiwxpx.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZ2t1aXV5Y3F5em9iYml3eHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMjQyMjYsImV4cCI6MjA3NDgwMDIyNn0.WkwwTwI-S_pmD-8xb2mL8P2-ezMCSSXDtqsipEbwUvQ";

export const CREDIT_COSTS = { image: 30, video: 70 } as const;

export type RouteAuth = { user: User; supabase: SupabaseClient };

/**
 * Resolve the logged-in user for an API route from the Supabase auth cookies.
 * Returns null when the request is unauthenticated.
 */
export async function getRouteUser(): Promise<RouteAuth | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers cannot always set cookies; token refresh is handled by middleware.
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { user: data.user, supabase };
}

export function unauthorized() {
  return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 });
}

// Best-effort per-instance rate limiting (serverless instances each keep their own
// window, so this is a backstop against abuse, not an exact quota).
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/**
 * Gate for generation endpoints: requires a session, applies a rate limit and
 * verifies the user can afford the generation. Returns either { error } (a ready
 * NextResponse) or { auth, cost }.
 */
export async function authorizeGeneration(
  kind: keyof typeof CREDIT_COSTS
): Promise<{ error: NextResponse } | { auth: RouteAuth; cost: number }> {
  const auth = await getRouteUser();
  if (!auth) return { error: unauthorized() };

  if (!rateLimit(`${kind}:${auth.user.id}`, 20, 60 * 60 * 1000)) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Rate limit reached. Please try again later." },
        { status: 429 }
      ),
    };
  }

  const cost = CREDIT_COSTS[kind];
  const { data, error } = await auth.supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Could not verify credit balance." },
        { status: 500 }
      ),
    };
  }
  const balance = data?.balance ?? 0;
  if (balance < cost) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Insufficient credits", required: cost, balance },
        { status: 402 }
      ),
    };
  }
  return { auth, cost };
}

/**
 * Atomically deduct credits for the signed-in user via the spend_credits RPC
 * (SECURITY DEFINER, keyed on auth.uid() — the client can never pick the user).
 */
export async function chargeCredits(
  supabase: SupabaseClient,
  amount: number,
  description: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("spend_credits", {
    p_amount: amount,
    p_description: description,
  });
  if (error || !data?.success) {
    console.error("[credits] charge failed:", error?.message || data?.message || "unknown");
    return false;
  }
  return true;
}
