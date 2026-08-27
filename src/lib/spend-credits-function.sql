-- Spend user credits securely with RLS bypass
-- Creates a SECURITY DEFINER function that atomically deducts credits
-- and records a transaction. Returns a JSONB result.

CREATE OR REPLACE FUNCTION spend_user_credits(
  user_id UUID,
  spend_amount INT,
  spend_description TEXT DEFAULT 'Image generation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INT;
BEGIN
  IF spend_amount IS NULL OR spend_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid spend amount'
    );
  END IF;

  -- Lock the row to avoid race conditions
  SELECT balance INTO current_balance
  FROM user_credits
  WHERE user_id = spend_user_credits.user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No credits record found'
    );
  END IF;

  IF current_balance < spend_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient credits',
      'balance', current_balance
    );
  END IF;

  UPDATE user_credits
  SET balance = balance - spend_amount,
      updated_at = NOW()
  WHERE user_id = spend_user_credits.user_id;

  INSERT INTO credit_transactions (user_id, amount, description)
  VALUES (spend_user_credits.user_id, -spend_amount, COALESCE(spend_description, 'Image generation'));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Credits deducted',
    'spent', spend_amount,
    'balance', (SELECT balance FROM user_credits WHERE user_id = spend_user_credits.user_id)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;
