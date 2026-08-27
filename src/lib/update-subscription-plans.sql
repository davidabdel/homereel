-- Update UnrealAdz subscription plans (idempotent)
-- Prices are stored in cents per the schema (price_monthly/price_yearly)
-- New tiers:
--   Free    $0/mo      100 credits/month
--   Lite    $99/mo     50,000 credits/month
--   Business $299/mo   150,000 credits/month
--   Heavy   $799/mo    400,000 credits/month

-- Safety: wrap each plan in an upsert-style block so re-running is safe

-- Free
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Free') THEN
    UPDATE subscription_plans
    SET description = 'Basic access with limited features',
        price_monthly = 0,
        price_yearly = 0,
        credits_per_month = 100,
        features = '["Basic UGC generation", "Standard quality renders", "Community support"]'::jsonb,
        is_active = true,
        updated_at = NOW()
    WHERE name = 'Free';
  ELSE
    INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, credits_per_month, features, is_active)
    VALUES (
      'Free',
      'Basic access with limited features',
      0,
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Lite') THEN
    UPDATE subscription_plans
    SET description = 'Enhanced features for individual creators',
        price_monthly = 9900,
        price_yearly = 99900,
        credits_per_month = 50000,
        features = '["All Free features", "HD quality renders", "Priority processing", "Advanced tools", "Email support"]'::jsonb,
        is_active = true,
        updated_at = NOW()
    WHERE name = 'Lite';
  ELSE
    INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, credits_per_month, features, is_active)
    VALUES (
      'Lite',
      'Enhanced features for individual creators',
      9900,
      99900,
      50000,
      '["All Free features", "HD quality renders", "Priority processing", "Advanced tools", "Email support"]'::jsonb,
      true
    );
  END IF;
END $$;

-- Business ($299 -> 29900 cents). Yearly is explicitly $2999 -> 299900 cents.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Business') THEN
    UPDATE subscription_plans
    SET description = 'Business grade features for teams',
        price_monthly = 29900,
        price_yearly = 299900,
        credits_per_month = 150000,
        features = '["All Lite features", "Faster queues", "Team collaboration", "API access", "Priority support"]'::jsonb,
        is_active = true,
        updated_at = NOW()
    WHERE name = 'Business';
  ELSE
    INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, credits_per_month, features, is_active)
    VALUES (
      'Business',
      'Business grade features for teams',
      29900,
      299900,
      150000,
      '["All Lite features", "Faster queues", "Team collaboration", "API access", "Priority support"]'::jsonb,
      true
    );
  END IF;
END $$;

-- Heavy ($799 -> 79900 cents). Yearly is explicitly $7999 -> 799900 cents.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Heavy') THEN
    UPDATE subscription_plans
    SET description = 'High-volume tier for large teams and agencies',
        price_monthly = 79900,
        price_yearly = 799900,
        credits_per_month = 400000,
        features = '["All Business features", "Dedicated capacity", "Higher priority", "SLA options"]'::jsonb,
        is_active = true,
        updated_at = NOW()
    WHERE name = 'Heavy';
  ELSE
    INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, credits_per_month, features, is_active)
    VALUES (
      'Heavy',
      'High-volume tier for large teams and agencies',
      79900,
      799900,
      400000,
      '["All Business features", "Dedicated capacity", "Higher priority", "SLA options"]'::jsonb,
      true
    );
  END IF;
END $$;

-- Deactivate any legacy plans not in the new set
UPDATE subscription_plans
SET is_active = false,
    updated_at = NOW()
WHERE name NOT IN ('Free', 'Lite', 'Business', 'Heavy');

-- Preview the final state
SELECT id, name, price_monthly, price_yearly, credits_per_month, is_active
FROM subscription_plans
ORDER BY price_monthly;
