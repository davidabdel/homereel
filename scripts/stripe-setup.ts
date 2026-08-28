/**
 * Create the HomeReel products and prices in Stripe, then print the price IDs
 * to paste into .env.local.
 *
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/stripe-setup.ts
 *
 * Idempotent: everything is looked up by `metadata.homereel_key` first, so
 * running it twice reuses what's there rather than creating duplicates. Stripe
 * prices are immutable, so changing an amount creates a new price and leaves
 * the old one in place — existing subscribers keep the price they signed up on,
 * which is what you want.
 *
 * Amounts are in cents, AUD, and GST INCLUSIVE. Turn on Stripe Tax with a
 * GST-inclusive setting if you want the tax broken out on the invoice.
 */

import Stripe from "stripe";
import { PLANS, TOPUPS } from "../src/lib/pricing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}
if (key.startsWith("sk_live_")) {
  console.error(
    "That's a LIVE key. Run this in test mode first — find the webhook bug on a fake card.\n" +
      "If you really mean it, set HOMEREEL_ALLOW_LIVE=1."
  );
  if (process.env.HOMEREEL_ALLOW_LIVE !== "1") process.exit(1);
}

const TAX_CODE = "txcd_10103000"; // SaaS — required by Stripe Managed Payments

const stripe = new Stripe(key, { apiVersion: "2025-10-29.clover" as Stripe.LatestApiVersion });

type Spec = {
  key: string;
  name: string;
  description: string;
  amount: number; // cents, AUD, GST inclusive
  recurring: boolean;
  credits: number;
  envVar: string;
};

const SPECS: Spec[] = [
  ...PLANS.map((p) => ({
    key: p.key,
    name: p.name,
    description: `${p.credits.toLocaleString()} credits every month. GST inclusive.`,
    amount: p.priceAud * 100,
    recurring: true,
    credits: p.credits,
    envVar: `NEXT_PUBLIC_STRIPE_PRICE_${p.key.toUpperCase()}`,
  })),
  ...TOPUPS.map((t) => ({
    key: `topup_${t.priceAud}`,
    name: `HomeReel top-up — ${t.credits.toLocaleString()} credits`,
    description: `${t.credits.toLocaleString()} credits, valid 12 months. GST inclusive.`,
    amount: t.priceAud * 100,
    recurring: false,
    credits: t.credits,
    envVar: `NEXT_PUBLIC_STRIPE_PRICE_TOPUP_${t.priceAud}`,
  })),
];

async function findProduct(homereelKey: string) {
  const found = await stripe.products.search({
    query: `metadata['homereel_key']:'${homereelKey}' AND active:'true'`,
  });
  return found.data[0];
}

async function findPrice(productId: string, amount: number, recurring: boolean) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return prices.data.find(
    (p) =>
      p.unit_amount === amount &&
      p.currency === "aud" &&
      Boolean(p.recurring) === recurring &&
      (!recurring || p.recurring?.interval === "month")
  );
}

async function main() {
  const out: Record<string, string> = {};

  for (const spec of SPECS) {
    let product = await findProduct(spec.key);
    if (product) {
      // Update rather than skip. Pack sizes change, and the webhook reads the
      // credit amount straight off this metadata — a stale value here would
      // silently grant the wrong number of credits.
      product = await stripe.products.update(product.id, {
        name: spec.name,
        description: spec.description,
        tax_code: TAX_CODE,
        metadata: {
          homereel_key: spec.key,
          credits: String(spec.credits),
          bucket: spec.recurring ? "monthly" : "topup",
        },
      });
      console.log(`· product updated  ${spec.name}`);
    } else {
      product = await stripe.products.create({
        name: spec.name,
        description: spec.description,
        // Managed Payments is on by default and refuses to create a checkout
        // session for a product with no tax code — the error surfaces at
        // checkout, not here, so without this every top-up purchase fails.
        // txcd_10103000 = Software as a Service (business use).
        tax_code: TAX_CODE,
        // The webhook reads these to decide how many credits to grant and into
        // which bucket, so the amounts never have to be duplicated in code.
        metadata: {
          homereel_key: spec.key,
          credits: String(spec.credits),
          bucket: spec.recurring ? "monthly" : "topup",
        },
      });
      console.log(`✓ product created  ${spec.name}`);
    }

    let price = await findPrice(product.id, spec.amount, spec.recurring);
    if (price) {
      // The dollar amount is unchanged, so the price object can stay — but its
      // metadata carries the credit count too and has to move with it.
      price = await stripe.prices.update(price.id, {
        metadata: { homereel_key: spec.key, credits: String(spec.credits) },
      });
      console.log(`  price updated    ${price.id}`);
    } else {
      price = await stripe.prices.create({
        product: product.id,
        currency: "aud",
        unit_amount: spec.amount,
        tax_behavior: "inclusive", // GST inclusive
        ...(spec.recurring ? { recurring: { interval: "month" as const } } : {}),
        metadata: { homereel_key: spec.key, credits: String(spec.credits) },
      });
      console.log(`  price created    ${price.id}`);
    }
    out[spec.envVar] = price.id;
  }

  console.log("\nPaste into .env.local:\n");
  for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
  console.log(
    "\nNext: create a webhook endpoint at <site>/api/webhooks/stripe listening for\n" +
      "checkout.session.completed, customer.subscription.created|updated|deleted and\n" +
      "invoice.paid — then put its signing secret in STRIPE_WEBHOOK_SECRET."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
