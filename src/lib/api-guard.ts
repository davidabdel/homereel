import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// No hardcoded fallback to a real project. The old value pointed at a
// different product's Supabase instance — for a separate company that is the
// wrong database, not a convenient default. Placeholders keep the client
// constructible (it throws on empty strings) while resolving to no session.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key-not-configured";

/**
 * Legacy flat per-call costs. HomeReel bills per shot from `pricing.ts`
 * instead — a film is N shots and N billable calls, so a single flat charge
 * would either eat the difference or overcharge a short film.
 */
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

/* ------------------------------------------------------- film reservations */

type RpcResult = { success: boolean; message?: string; available?: number };

/**
 * Hold the credits for a whole film before a single shot is submitted.
 *
 * Every shot bills at KIE the instant its createTask returns 200, and that
 * cannot be recalled. So the sequence is always: reserve everything, submit,
 * then settle the shots that generated and release the ones that didn't.
 */
export async function reserveCredits(
  supabase: SupabaseClient,
  amount: number,
  description: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("reserve_credits", {
    p_amount: amount,
    p_description: description,
  });
  if (error) return { success: false, message: error.message };
  return (data ?? { success: false, message: "No response" }) as RpcResult;
}

/** A shot generated — turn its held credits into spent ones. */
export async function settleCredits(
  supabase: SupabaseClient,
  amount: number,
  description: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("settle_credits", {
    p_amount: amount,
    p_description: description,
  });
  if (error) return { success: false, message: error.message };
  return (data ?? { success: false, message: "No response" }) as RpcResult;
}

/**
 * A shot never generated — give the hold back. A failure costs nothing at KIE,
 * so it must cost the agent nothing.
 */
export async function releaseCredits(
  supabase: SupabaseClient,
  amount: number,
  description: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("release_credits", {
    p_amount: amount,
    p_description: description,
  });
  if (error) return { success: false, message: error.message };
  return (data ?? { success: false, message: "No response" }) as RpcResult;
}
