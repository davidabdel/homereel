-- Phase 3: Stripe billing wiring for UnrealAdz
-- Run in the Supabase SQL editor after 0001 and 0002. Idempotent.
--
-- After running, edit section 5 with your real Stripe Price IDs so the
-- webhook can map a paid price to the right plan + monthly credit grant.

-- ============================================================
-- 1. Map Stripe prices → plans
-- ============================================================
alter table public.subscription_plans add column if not exists stripe_price_id_monthly text;
alter table public.subscription_plans add column if not exists stripe_price_id_yearly text;

-- ============================================================
-- 2. Correlate a Stripe customer/subscription with our rows
-- ============================================================
alter table public.user_subscriptions add column if not exists stripe_customer_id text;

-- One row per Stripe subscription so the webhook can upsert safely.
-- (Postgres allows multiple NULLs in a UNIQUE column, so legacy rows are fine.)
do $$
begin
  alter table public.user_subscriptions
    add constraint user_subscriptions_provider_sub_id_key
    unique (payment_provider_subscription_id);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

-- ============================================================
-- 3. Idempotency: never process the same Stripe event twice
--    (Stripe retries deliveries; double-processing = double credits)
-- ============================================================
create table if not exists public.stripe_events (
  id text primary key,          -- Stripe event id (evt_...)
  type text,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- No policies → only the service role (webhook) can read/write it.

-- ============================================================
-- 4. Resolve a Supabase user id from an email (webhook only).
--    Used when a Payment Link checkout has no client_reference_id.
-- ============================================================
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- ============================================================
-- 5. >>> EDIT ME <<< Map your real Stripe Price IDs to plans.
--
-- Find each Price ID in Stripe Dashboard → Products → (a product) →
-- its price → the id that starts with "price_". Set the monthly price id
-- and, if you sell annual, the yearly price id. Make sure credits_per_month
-- on each plan is what you actually want to grant every billing cycle.
--
-- The plan NAMES below must match the rows already in subscription_plans.
-- Uncomment and fill in, then re-run this file (it is safe to re-run).
-- ============================================================

-- update public.subscription_plans set
--   stripe_price_id_monthly = 'price_XXXXXXXXXXXX',   -- Lite monthly
--   stripe_price_id_yearly  = 'price_YYYYYYYYYYYY'    -- Lite yearly
-- where name = 'Lite';

-- update public.subscription_plans set
--   stripe_price_id_monthly = 'price_XXXXXXXXXXXX',
--   stripe_price_id_yearly  = 'price_YYYYYYYYYYYY'
-- where name = 'Business';

-- update public.subscription_plans set
--   stripe_price_id_monthly = 'price_XXXXXXXXXXXX',
--   stripe_price_id_yearly  = 'price_YYYYYYYYYYYY'
-- where name = 'Heavy';
