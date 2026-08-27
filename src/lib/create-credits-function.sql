-- Create a function to set up user credits with SECURITY DEFINER
-- This will bypass RLS policies and allow the function to create credits for any user
CREATE OR REPLACE FUNCTION setup_user_credits(user_id UUID, initial_amount INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
SET search_path = public
AS $$
DECLARE
  credits_exist BOOLEAN;
  result JSONB;
BEGIN
  -- Check if credits already exist
  SELECT EXISTS (
    SELECT 1 FROM user_credits WHERE user_id = $1
  ) INTO credits_exist;
  
  -- If credits already exist, return early
  IF credits_exist THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Credits already exist for this user'
    );
  END IF;
  
  -- Create credits
  INSERT INTO user_credits (
    user_id,
    balance,
    last_refill_date
  ) VALUES (
    $1,
    $2,
    NOW()
  );
  
  -- Record the transaction
  INSERT INTO credit_transactions (
    user_id,
    amount,
    description
  ) VALUES (
    $1,
    $2,
    'Initial free credits'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Credits created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;
