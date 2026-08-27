-- HomeReel: fix what signup provisions, and give the Stripe webhook a way to
-- grant credits into the right bucket.
--
-- The inherited signup trigger did two wrong things once the wallet existed:
--
--   1. It granted 100 credits into `user_credits.balance` — the pre-wallet
--      column. `spendable_credits()` reads the two buckets, so a brand new
--      member saw 100 credits written somewhere and 0 they could actually
--      spend. They'd sign up and be unable to generate anything.
--   2. It attached every new user to the "Free" plan, which HomeReel retired.
--      With that row gone the lookup returns NULL and the subscription row is
--      meaningless.
--
-- HomeReel has no free tier: credits arrive when Stripe confirms the
-- membership, and not before.

-- ------------------------------------------------------------ signup ------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- An empty wallet. No free tier, no misleading number in a dead column.
  INSERT INTO public.user_credits (user_id, balance, monthly_balance, topup_balance, reserved)
  VALUES (NEW.id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Anyone already carrying the old welcome grant: move it to nothing spendable,
-- since it was never spendable anyway.
UPDATE user_credits
SET balance = 0
WHERE balance = 100 AND monthly_balance = 0 AND topup_balance = 0;

-- ------------------------------------------------------------- grants -----

-- Called by the Stripe webhook when a membership is paid. Replaces (does not
-- add to) the monthly allowance and restarts its clock — the whole point of
-- the monthly bucket is that it doesn't accumulate.
CREATE OR REPLACE FUNCTION grant_monthly_credits(
  p_user    UUID,
  p_credits INT,
  p_days    INT DEFAULT 31
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user IS NULL OR p_credits IS NULL OR p_credits < 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid arguments');
  END IF;

  INSERT INTO user_credits (user_id, balance, monthly_balance, monthly_expires_at, topup_balance, reserved)
  VALUES (p_user, 0, p_credits, NOW() + make_interval(days => p_days), 0, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET monthly_balance    = p_credits,
        monthly_expires_at = NOW() + make_interval(days => p_days),
        updated_at         = NOW();

  INSERT INTO credit_transactions (user_id, amount, description)
  VALUES (p_user, p_credits, 'Monthly membership credits');

  RETURN jsonb_build_object('success', true, 'granted', p_credits,
                            'available', spendable_credits(p_user));
END;
$$;

-- Called by the Stripe webhook on a top-up purchase. These are the credits the
-- member paid cash for, so they get their own lot with its own 12-month expiry
-- and are spent only after the perishable monthly allowance is gone.
CREATE OR REPLACE FUNCTION grant_topup_credits(
  p_user    UUID,
  p_credits INT,
  p_months  INT DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user IS NULL OR p_credits IS NULL OR p_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid arguments');
  END IF;

  INSERT INTO credit_lots (user_id, credits, remaining, expires_at)
  VALUES (p_user, p_credits, p_credits, NOW() + make_interval(months => p_months));

  INSERT INTO user_credits (user_id, balance, monthly_balance, topup_balance, reserved)
  VALUES (p_user, 0, 0, p_credits, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET topup_balance = user_credits.topup_balance + p_credits,
        updated_at    = NOW();

  INSERT INTO credit_transactions (user_id, amount, description)
  VALUES (p_user, p_credits, 'Top-up purchase');

  RETURN jsonb_build_object('success', true, 'granted', p_credits,
                            'available', spendable_credits(p_user));
END;
$$;

-- Both grants are for the server (service key) only. Nobody holding a
-- publishable key should be able to give themselves credits.
REVOKE EXECUTE ON FUNCTION grant_monthly_credits(UUID, INT, INT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION grant_topup_credits(UUID, INT, INT)  FROM anon, authenticated;
