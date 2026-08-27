-- HomeReel: two-bucket credit wallet, per-shot reservations, and the new plan.
--
-- Why two buckets: the 1,000 credits included with the $19 membership expire
-- monthly, while purchased top-ups last 12 months. Spending has to drain the
-- perishable bucket first or members lose credits they paid cash for.
--
-- Why reservations: a film is N shots = N separate createTask calls, each of
-- which bills at KIE the moment it returns 200 and cannot be recalled. We hold
-- the credits before submitting anything, then settle or release per shot. A
-- shot that fails costs nothing at KIE, so it must cost the agent nothing.

-- ---------------------------------------------------------------- buckets --

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS monthly_balance   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS topup_balance     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved          INT NOT NULL DEFAULT 0;

-- Carry any pre-existing single balance across into the durable bucket once.
UPDATE user_credits
SET topup_balance = topup_balance + COALESCE(balance, 0)
WHERE COALESCE(balance, 0) > 0
  AND topup_balance = 0
  AND monthly_balance = 0;

-- Individual top-up lots, so 12-month expiry is per purchase, not per account.
CREATE TABLE IF NOT EXISTS credit_lots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits     INT  NOT NULL CHECK (credits > 0),
  remaining   INT  NOT NULL CHECK (remaining >= 0),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS credit_lots_user_idx ON credit_lots (user_id, expires_at);
ALTER TABLE credit_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_lots_owner_read ON credit_lots;
CREATE POLICY credit_lots_owner_read ON credit_lots
  FOR SELECT USING (auth.uid() = user_id);

-- --------------------------------------------------------- spendable view --

CREATE OR REPLACE FUNCTION spendable_credits(p_user UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    COALESCE((
      SELECT CASE
               WHEN monthly_expires_at IS NULL OR monthly_expires_at > NOW()
               THEN monthly_balance ELSE 0
             END
             + topup_balance
             - reserved
      FROM user_credits WHERE user_id = p_user
    ), 0)
  );
$$;

-- ----------------------------------------------------------- reservations --

-- Hold credits for a whole film before a single shot is submitted. Returns
-- success=false rather than raising, so the route can answer 402 cleanly.
CREATE OR REPLACE FUNCTION reserve_credits(
  p_amount      INT,
  p_description TEXT DEFAULT 'Film reservation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_available INT;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  PERFORM 1 FROM user_credits WHERE user_id = v_user FOR UPDATE;

  v_available := spendable_credits(v_user);
  IF v_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 'message', 'Insufficient credits',
      'required', p_amount, 'available', v_available
    );
  END IF;

  UPDATE user_credits
  SET reserved = reserved + p_amount, updated_at = NOW()
  WHERE user_id = v_user;

  RETURN jsonb_build_object('success', true, 'reserved', p_amount,
                            'available', spendable_credits(v_user));
END;
$$;

-- Settle part of a reservation: the shot generated, so the credits are spent.
-- Drains the perishable monthly bucket first, then top-up lots oldest-first.
CREATE OR REPLACE FUNCTION settle_credits(
  p_amount      INT,
  p_description TEXT DEFAULT 'Shot generated'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_left  INT  := p_amount;
  v_take  INT;
  v_month INT;
  v_lot   RECORD;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  SELECT CASE WHEN monthly_expires_at IS NULL OR monthly_expires_at > NOW()
              THEN monthly_balance ELSE 0 END
  INTO v_month
  FROM user_credits WHERE user_id = v_user FOR UPDATE;

  -- perishable first
  v_take := LEAST(v_left, COALESCE(v_month, 0));
  IF v_take > 0 THEN
    UPDATE user_credits SET monthly_balance = monthly_balance - v_take WHERE user_id = v_user;
    v_left := v_left - v_take;
  END IF;

  -- then top-up lots, soonest to expire first
  FOR v_lot IN
    SELECT id, remaining FROM credit_lots
    WHERE user_id = v_user AND remaining > 0 AND expires_at > NOW()
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, v_lot.remaining);
    UPDATE credit_lots SET remaining = remaining - v_take WHERE id = v_lot.id;
    v_left := v_left - v_take;
  END LOOP;

  UPDATE user_credits
  SET topup_balance = GREATEST(0, topup_balance - (p_amount - LEAST(p_amount, COALESCE(v_month, 0)))),
      reserved      = GREATEST(0, reserved - p_amount),
      balance       = GREATEST(0, COALESCE(balance, 0) - p_amount),
      updated_at    = NOW()
  WHERE user_id = v_user;

  INSERT INTO credit_transactions (user_id, amount, description)
  VALUES (v_user, -p_amount, COALESCE(p_description, 'Shot generated'));

  RETURN jsonb_build_object('success', true, 'spent', p_amount,
                            'available', spendable_credits(v_user));
END;
$$;

-- Give back a reservation for a shot that never generated. A failure costs
-- nothing at KIE, so it must cost the agent nothing.
CREATE OR REPLACE FUNCTION release_credits(
  p_amount      INT,
  p_description TEXT DEFAULT 'Shot failed - reservation released'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  UPDATE user_credits
  SET reserved = GREATEST(0, reserved - GREATEST(0, COALESCE(p_amount, 0))),
      updated_at = NOW()
  WHERE user_id = v_user;

  RETURN jsonb_build_object('success', true, 'released', p_amount,
                            'available', spendable_credits(v_user));
END;
$$;

-- ---------------------------------------------------------------- shots ----

-- One row per shot so each carries its own task id, source photo and approval.
CREATE TABLE IF NOT EXISTS project_shots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position      INT  NOT NULL,
  source_url    TEXT NOT NULL,
  quality       TEXT NOT NULL CHECK (quality IN ('sd','hd')),
  with_people   BOOLEAN NOT NULL DEFAULT FALSE,
  move          TEXT NOT NULL,
  credits_held  INT  NOT NULL DEFAULT 0,
  task_id       TEXT UNIQUE,            -- unique: a shot can never be submitted twice
  state         TEXT NOT NULL DEFAULT 'pending',
  result_url    TEXT,
  approved      BOOLEAN NOT NULL DEFAULT FALSE,
  fail_msg      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS project_shots_project_idx ON project_shots (project_id, position);
ALTER TABLE project_shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_shots_owner_all ON project_shots;
CREATE POLICY project_shots_owner_all ON project_shots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------- plan ----

UPDATE subscription_plans SET is_active = false
WHERE name IN ('Lite', 'Business', 'Heavy');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'HomeReel') THEN
    UPDATE subscription_plans
    SET description       = 'Listing films from photos you already have',
        price_monthly     = 1900,       -- $19.00 AUD, GST inclusive
        price_yearly      = 19000,
        credits_per_month = 1000,
        features          = '["1,000 credits every month","Standard or High Definition","Family in the living spaces","Approve every shot before it lands","Films stored and re-downloadable"]'::jsonb,
        is_active         = true,
        updated_at        = NOW()
    WHERE name = 'HomeReel';
  ELSE
    INSERT INTO subscription_plans
      (name, description, price_monthly, price_yearly, credits_per_month, features, is_active)
    VALUES
      ('HomeReel', 'Listing films from photos you already have', 1900, 19000, 1000,
       '["1,000 credits every month","Standard or High Definition","Family in the living spaces","Approve every shot before it lands","Films stored and re-downloadable"]'::jsonb,
       true);
  END IF;
END $$;
