-- Three membership tiers instead of one.
--
-- Margin at 100% utilisation, using $0.0076 as the worst-case cost per credit
-- (an HD shot is 100 credits and costs $0.61):
--   Starter  $19  /  1,000 cr  ->  $7.60 cost,  60% margin
--   Pro      $49  /  3,000 cr  -> $22.80 cost,  53% margin
--   Extreme  $199 / 15,000 cr  -> $114.00 cost, 43% margin
-- No tier loses money at any usage pattern. Keep that true.

-- The single "HomeReel" plan becomes the entry tier.
UPDATE subscription_plans
SET name                    = 'HomeReel Starter',
    description             = 'One HD reel a month, or two and a half in Standard.',
    price_monthly           = 1900,
    credits_per_month       = 1000,
    stripe_price_id_monthly = 'price_1U9JMAKCrdctHONDZV5JQfe4',
    is_active               = true,
    updated_at              = NOW()
WHERE name IN ('HomeReel', 'HomeReel Starter');

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('HomeReel Pro',     'Three HD reels a month. For an agent listing every week.',
        4900,  3000, 'price_1U9JMBKCrdctHONDpRdDDpEJ'),
      ('HomeReel Extreme', 'Fifteen HD reels a month. For an office, not a person.',
       19900, 15000, 'price_1U9JMCKCrdctHOND2kH7IlZA')
    ) AS t(name, descr, price, credits, price_id)
  LOOP
    IF EXISTS (SELECT 1 FROM subscription_plans WHERE name = r.name) THEN
      UPDATE subscription_plans
      SET description             = r.descr,
          price_monthly           = r.price,
          credits_per_month       = r.credits,
          stripe_price_id_monthly = r.price_id,
          is_active               = true,
          updated_at              = NOW()
      WHERE name = r.name;
    ELSE
      INSERT INTO subscription_plans
        (name, description, price_monthly, price_yearly, credits_per_month,
         stripe_price_id_monthly, features, is_active)
      VALUES
        (r.name, r.descr, r.price, r.price * 10, r.credits, r.price_id,
         '["Standard or High Definition","Family in the living spaces","Approve every shot before it lands","Reels stored and re-downloadable"]'::jsonb,
         true);
    END IF;
  END LOOP;
END $$;

-- Anything not one of the three is retired.
UPDATE subscription_plans
SET is_active = false
WHERE name NOT IN ('HomeReel Starter', 'HomeReel Pro', 'HomeReel Extreme');
