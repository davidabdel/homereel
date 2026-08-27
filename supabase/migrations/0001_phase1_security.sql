-- Phase 1 security hardening for UnrealAdz
-- Run this in the Supabase SQL editor (or via supabase db push).
-- Idempotent: safe to run more than once.

-- ============================================================
-- 1. Lock down the legacy client-callable RPCs.
--    These accepted arbitrary user_id / amount from the browser.
-- ============================================================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('setup_user_credits', 'spend_user_credits', 'setup_user_subscription')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- ============================================================
-- 2. user_credits: one row per user, guaranteed.
-- ============================================================
-- Remove any duplicate rows before adding the unique constraint
delete from public.user_credits a
using public.user_credits b
where a.user_id = b.user_id
  and a.ctid < b.ctid;

do $$
begin
  alter table public.user_credits add constraint user_credits_user_id_key unique (user_id);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

-- ============================================================
-- 3. spend_credits: the ONLY way the app spends credits.
--    Keyed on auth.uid() — callers can never pick the user.
--    Atomic check-and-decrement; logs a transaction row.
-- ============================================================
create or replace function public.spend_credits(p_amount integer, p_description text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'message', 'Not authenticated');
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000 then
    return jsonb_build_object('success', false, 'message', 'Invalid amount');
  end if;

  update public.user_credits
     set balance = balance - p_amount,
         updated_at = now()
   where user_id = v_user
     and balance >= p_amount
  returning balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('success', false, 'message', 'Insufficient credits');
  end if;

  insert into public.credit_transactions (user_id, amount, description)
  values (v_user, -p_amount, coalesce(p_description, 'Spend'));

  return jsonb_build_object('success', true, 'balance', v_balance);
end $$;

revoke all on function public.spend_credits(integer, text) from public, anon;
grant execute on function public.spend_credits(integer, text) to authenticated, service_role;

-- ============================================================
-- 4. admin_add_credits: grants/refunds. Service-role ONLY
--    (used later by the Stripe webhook and refund logic).
-- ============================================================
create or replace function public.admin_add_credits(p_user_id uuid, p_amount integer, p_description text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  insert into public.user_credits (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.user_credits
     set balance = balance + p_amount,
         updated_at = now()
   where user_id = p_user_id
  returning balance into v_balance;

  insert into public.credit_transactions (user_id, amount, description)
  values (p_user_id, p_amount, coalesce(p_description, 'Adjustment'));

  return jsonb_build_object('success', true, 'balance', v_balance);
end $$;

revoke all on function public.admin_add_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.admin_add_credits(uuid, integer, text) to service_role;

-- ============================================================
-- 5. Welcome credits: DB trigger on signup replaces the old
--    client-side setup_user_credits call.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_credits (user_id, balance, last_refill_date)
  values (new.id, 100, now())
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, amount, description)
  values (new.id, 100, 'Welcome credits');

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any existing user without a credits row gets the free 100
insert into public.user_credits (user_id, balance, last_refill_date)
select u.id, 100, now()
from auth.users u
left join public.user_credits c on c.user_id = u.id
where c.user_id is null;

-- ============================================================
-- 6. RLS: clients may READ their own rows; all writes happen
--    through SECURITY DEFINER functions or the service role.
-- ============================================================
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('user_credits', 'user_subscriptions', 'credit_transactions')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.user_credits enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.credit_transactions enable row level security;

create policy "read own credits" on public.user_credits
  for select using (auth.uid() = user_id);
create policy "read own subscription" on public.user_subscriptions
  for select using (auth.uid() = user_id);
create policy "read own transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- Plans stay publicly readable (pricing page)
alter table public.subscription_plans enable row level security;
drop policy if exists "read plans" on public.subscription_plans;
create policy "read plans" on public.subscription_plans
  for select using (true);
