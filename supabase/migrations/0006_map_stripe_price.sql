-- Point the HomeReel plan at its Stripe price.
--
-- The webhook resolves an invoice to a plan through stripe_price_id_monthly.
-- Without this every renewal throws, Stripe retries, and nobody gets credits.
UPDATE subscription_plans
SET stripe_price_id_monthly = 'price_1U8vYaKCrdctHOND20AwvkLj',
    updated_at = NOW()
WHERE name = 'HomeReel';
