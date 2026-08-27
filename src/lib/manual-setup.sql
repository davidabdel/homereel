-- Manual setup for user david@uconnect.com.au
-- Replace USER_ID with the actual user ID from your screenshots
DO $$
DECLARE
  user_id UUID := 'b3c5a3d1-2f0d-49d1-83c8-a0c7e7f0d33';  -- Replace with the actual user ID
  free_plan_id UUID;
BEGIN
  -- Get the Free plan ID
  SELECT id INTO free_plan_id FROM subscription_plans WHERE LOWER(name) = 'free' LIMIT 1;
  
  IF free_plan_id IS NULL THEN
    RAISE EXCEPTION 'Free plan not found';
  END IF;
  
  -- Create subscription
  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    user_id,
    free_plan_id,
    'active',
    NOW(),
    NOW() + INTERVAL '1 month'
  );
  
  -- Create credits
  INSERT INTO user_credits (
    user_id,
    balance,
    last_refill_date
  ) VALUES (
    user_id,
    100,
    NOW()
  );
  
  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    amount,
    description
  ) VALUES (
    user_id,
    100,
    'Initial free credits (manual setup)'
  );
  
  RAISE NOTICE 'Setup completed successfully for user %', user_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error: %', SQLERRM;
END;
$$;
