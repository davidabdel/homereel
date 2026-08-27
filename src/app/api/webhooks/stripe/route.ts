import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function env(name: string) {
  return process.env[name];
}

// Map Stripe subscription statuses to our user_subscriptions CHECK values.
function mapStatus(s: string): string {
  switch (s) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
      return s;
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
      return "past_due";
    default:
      return "incomplete";
  }
}

function iso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

type PlanRow = { id: string; name: string; credits_per_month: number };

async function planByPrice(admin: SupabaseClient, priceId: string | undefined): Promise<PlanRow> {
  if (!priceId) throw new Error("Invoice/subscription has no price id");
  const { data, error } = await admin
    .from("subscription_plans")
    .select("id, name, credits_per_month")
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Thrown → 500 → Stripe retries, giving you time to map the price in 0003.
    throw new Error(`No subscription plan mapped to Stripe price ${priceId}. Fill in section 5 of migration 0003.`);
  }
  return data as PlanRow;
}

async function userIdByEmail(admin: SupabaseClient, email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const { data, error } = await admin.rpc("user_id_by_email", { p_email: email });
  if (error) {
    console.error("[stripe] user_id_by_email error:", error.message);
    return null;
  }
  return (data as string) || null;
}

async function upsertSubscription(
  admin: SupabaseClient,
  row: Record<string, unknown>
) {
  const { error } = await admin
    .from("user_subscriptions")
    .upsert(row, { onConflict: "payment_provider_subscription_id" });
  if (error) throw error;
}

export async function POST(req: Request) {
  const secretKey = env("STRIPE_SECRET_KEY");
  const webhookSecret = env("STRIPE_WEBHOOK_SECRET");
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Stripe is not configured" }, { status: 500 });
  }

  const stripe = new Stripe(secretKey);
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Idempotency: skip events we've already fully processed.
  const { data: seen } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const userId =
          session.client_reference_id ||
          (await userIdByEmail(admin, session.customer_details?.email || session.customer_email));
        if (!userId) throw new Error("Could not resolve Supabase user for checkout session");

        const subId = session.subscription as string;
        const customerId = (session.customer as string) || null;
        const sub = (await stripe.subscriptions.retrieve(subId)) as any;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = await planByPrice(admin, priceId);

        // Establish the mapping so renewal invoices resolve the user.
        // Credits are granted on invoice.paid (fires now for the first
        // invoice and on every renewal) to avoid double-granting.
        await upsertSubscription(admin, {
          user_id: userId,
          plan_id: plan.id,
          status: mapStatus(sub.status),
          current_period_start: iso(sub.current_period_start),
          current_period_end: iso(sub.current_period_end),
          cancel_at_period_end: Boolean(sub.cancel_at_period_end),
          payment_provider: "stripe",
          payment_provider_subscription_id: subId,
          stripe_customer_id: customerId,
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const subId: string | null = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null;
        if (!subId) break; // not a subscription invoice
        const customerId: string | null = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;
        const line = invoice.lines?.data?.[0];
        const priceId: string | undefined = line?.price?.id;
        const plan = await planByPrice(admin, priceId);

        // Resolve the user: existing row by sub id, then by customer id, then email.
        let userId: string | null = null;
        const { data: bySub } = await admin
          .from("user_subscriptions")
          .select("user_id")
          .eq("payment_provider_subscription_id", subId)
          .maybeSingle();
        userId = bySub?.user_id || null;
        if (!userId && customerId) {
          const { data: byCust } = await admin
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = byCust?.user_id || null;
        }
        if (!userId) userId = await userIdByEmail(admin, invoice.customer_email);
        if (!userId) throw new Error("Could not resolve Supabase user for paid invoice");

        await upsertSubscription(admin, {
          user_id: userId,
          plan_id: plan.id,
          status: "active",
          current_period_start: iso(line?.period?.start),
          current_period_end: iso(line?.period?.end),
          cancel_at_period_end: false,
          payment_provider: "stripe",
          payment_provider_subscription_id: subId,
          stripe_customer_id: customerId,
        });

        // Grant this cycle's credits.
        const { error: creditErr } = await admin.rpc("admin_add_credits", {
          p_user_id: userId,
          p_amount: plan.credits_per_month,
          p_description: `Stripe: ${plan.name} plan credits`,
        });
        if (creditErr) throw creditErr;
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const priceId = sub.items?.data?.[0]?.price?.id;
        let planId: string | undefined;
        try {
          planId = (await planByPrice(admin, priceId)).id;
        } catch {
          planId = undefined; // keep existing plan if price isn't mapped
        }
        const patch: Record<string, unknown> = {
          status: mapStatus(sub.status),
          current_period_end: iso(sub.current_period_end),
          cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        };
        if (planId) patch.plan_id = planId;
        await admin
          .from("user_subscriptions")
          .update(patch)
          .eq("payment_provider_subscription_id", sub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from("user_subscriptions")
          .update({ status: "canceled", cancel_at_period_end: true })
          .eq("payment_provider_subscription_id", sub.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "handler error";
    console.error(`[stripe] error handling ${event.type}:`, msg);
    // 500 → Stripe retries (transient DB issue or price mapping not set yet).
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // Record only after success so a failed run can be retried by Stripe.
  await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  return NextResponse.json({ ok: true });
}
