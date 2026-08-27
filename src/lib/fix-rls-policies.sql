-- Drop existing view-only policies if they exist
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can view their own credit transactions" ON credit_transactions;

-- Check if management policies already exist, and if not, create them
DO $$
BEGIN
  -- For user_subscriptions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'Users can manage their own subscriptions') THEN
    CREATE POLICY "Users can manage their own subscriptions"
      ON user_subscriptions
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
  
  -- For user_credits
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can manage their own credits') THEN
    CREATE POLICY "Users can manage their own credits"
      ON user_credits
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
  
  -- For credit_transactions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can manage their own credit transactions') THEN
    CREATE POLICY "Users can manage their own credit transactions"
      ON credit_transactions
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END
$$;
