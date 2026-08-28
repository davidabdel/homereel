import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRouteUser, unauthorized } from "@/lib/api-guard";

export const runtime = "nodejs";

/**
 * Start a Stripe Checkout session for a plan or a top-up.
 *
 * `client_reference_id` carries the Supabase user id through to the webhook,
 * which is what lets credits land on the right account without depending on
 * the email matching between the two systems.
 */
export async function POST(req: Request) {
  try {
    const auth = await getRouteUser();
    if (!auth) return unauthorized();

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Payments aren't configured yet." }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const priceId: string | undefined = body?.priceId;
    if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) {
      return NextResponse.json({ ok: false, error: "Unknown price" }, { status: 400 });
    }

    const stripe = new Stripe(secret);

    // Read the mode off the price itself rather than trusting the client:
    // a recurring price must be a subscription and a one-off must not be.
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      return NextResponse.json({ ok: false, error: "That plan is no longer available" }, { status: 400 });
    }
    const mode: Stripe.Checkout.SessionCreateParams.Mode = price.recurring ? "subscription" : "payment";

    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://homereel.com.au").replace(/\/+$/, "");

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: auth.user.id,
      customer_email: auth.user.email ?? undefined,
      success_url: `${site}/app?paid=1`,
      cancel_url: `${site}/app/subscription?cancelled=1`,
      allow_promotion_codes: true,
      metadata: { supabase_user_id: auth.user.id },
      ...(mode === "subscription"
        ? { subscription_data: { metadata: { supabase_user_id: auth.user.id } } }
        : {}),
    });

    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[checkout]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
