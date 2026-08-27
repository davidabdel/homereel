-- Fix case sensitivity issue in the setup_user_subscription function
CREATE OR REPLACE FUNCTION setup_user_subscription(user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id UUID;
  subscription_exists BOOLEAN;
  credits_exist BOOLEAN;
  result JSONB;
BEGIN
  -- Check if subscription already exists
  SELECT EXISTS (
    SELECT 1 FROM user_subscriptions WHERE user_id = $1
  ) INTO subscription_exists;
  
  -- Check if credits already exist
  SELECT EXISTS (
    SELECT 1 FROM user_credits WHERE user_id = $1
  ) INTO credits_exist;
  
  -- If both already exist, return early
  IF subscription_exists AND credits_exist THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Subscription and credits already exist'
    );
  END IF;
  
  -- Get the free plan ID - CASE INSENSITIVE SEARCH
  SELECT id INTO free_plan_id FROM subscription_plans 
  WHERE LOWER(name) = LOWER('Free') AND is_active = true
  LIMIT 1;
  
  IF free_plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Free plan not found. Available plans: ' || (SELECT string_agg(name, ', ') FROM subscription_plans WHERE is_active = true)
    );
  END IF;
  
  -- Create subscription if it doesn't exist
  IF NOT subscription_exists THEN
    INSERT INTO user_subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    ) VALUES (
      $1,
      free_plan_id,
      'active',
      NOW(),
      NOW() + INTERVAL '1 month'
    );
  END IF;
  
  -- Create credits if they don't exist
  IF NOT credits_exist THEN
    INSERT INTO user_credits (
      user_id,
      balance,
      last_refill_date
    ) VALUES (
      $1,
      100,
      NOW()
    );
    
    -- Record the transaction
    INSERT INTO credit_transactions (
      user_id,
      amount,
      description
    ) VALUES (
      $1,
      100,
      'Initial free credits'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription and credits set up successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;
