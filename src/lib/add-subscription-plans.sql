-- Add Free, Lite, and Pro subscription plans
-- This script checks if plans already exist before inserting them

-- First, check if the Free plan exists, and if not, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Free') THEN
    INSERT INTO subscription_plans (
      name, 
      description, 
      price_monthly, 
      price_yearly, 
      credits_per_month, 
      features,
      is_active
    ) VALUES (
      'Free', 
      'Basic access with limited features', 
      0, 
      0, 
      100, 
      '["Basic UGC generation", "Standard quality renders", "Limited templates"]'::jsonb,
      true
    );
    RAISE NOTICE 'Free plan created';
  ELSE
    RAISE NOTICE 'Free plan already exists';
  END IF;
END $$;

-- Next, check if the Lite plan exists, and if not, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Lite') THEN
    INSERT INTO subscription_plans (
      name, 
      description, 
      price_monthly, 
      price_yearly, 
      credits_per_month, 
      features,
      is_active
    ) VALUES (
      'Lite', 
      'Enhanced features for individual creators', 
      1900, 
      19900, 
      500, 
      '["All Free features", "HD quality renders", "Priority processing", "Advanced editing tools", "Email support"]'::jsonb,
      true
    );
    RAISE NOTICE 'Lite plan created';
  ELSE
    RAISE NOTICE 'Lite plan already exists';
  END IF;
END $$;

-- Finally, check if the Pro plan exists, and if not, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Pro') THEN
    INSERT INTO subscription_plans (
      name, 
      description, 
      price_monthly, 
      price_yearly, 
      credits_per_month, 
      features,
      is_active
    ) VALUES (
      'Pro', 
      'Professional features for serious content creators and teams', 
      4900, 
      49900, 
      2000, 
      '["All Lite features", "4K quality renders", "Team collaboration", "API access", "Custom templates", "Dedicated support", "Analytics dashboard"]'::jsonb,
      true
    );
    RAISE NOTICE 'Pro plan created';
  ELSE
    RAISE NOTICE 'Pro plan already exists';
  END IF;
END $$;

-- Update the Business plan to be inactive if it exists
UPDATE subscription_plans 
SET is_active = false 
WHERE name = 'Business';

-- Verify the plans were created
SELECT id, name, price_monthly, price_yearly, credits_per_month, is_active 
FROM subscription_plans 
ORDER BY price_monthly;
