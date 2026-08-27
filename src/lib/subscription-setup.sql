-- Create subscription plans table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL, -- Price in cents
  price_yearly INTEGER NOT NULL, -- Price in cents
  credits_per_month INTEGER NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  payment_provider VARCHAR, -- e.g., 'stripe', 'paypal'
  payment_provider_subscription_id VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create user credits table to track credit usage
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  last_refill_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit transactions table to track credit history
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for additions, negative for usage
  description VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for subscription_plans
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans
  FOR SELECT
  USING (is_active = true);

-- Create policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policies for user_credits
CREATE POLICY "Users can view their own credits"
  ON user_credits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policies for credit_transactions
CREATE POLICY "Users can view their own credit transactions"
  ON credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, credits_per_month, features)
VALUES 
  ('Free', 'Basic access with limited features', 0, 0, 100, '["Basic UGC generation", "Standard quality renders"]'::jsonb),
  ('Pro', 'Professional features for content creators', 1900, 19000, 500, '["All Free features", "HD quality renders", "Priority processing", "Advanced editing tools"]'::jsonb),
  ('Business', 'Enterprise-grade features for teams', 4900, 49000, 2000, '["All Pro features", "Team collaboration", "API access", "Dedicated support"]'::jsonb);

-- Function to create initial free subscription and credits for new users
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Get the ID of the free plan
  SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'Free' LIMIT 1;
  
  -- Create a subscription for the new user
  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    free_plan_id,
    'active',
    NOW(),
    NOW() + INTERVAL '1 month'
  );
  
  -- Create initial credit balance for the user
  INSERT INTO user_credits (
    user_id,
    balance,
    last_refill_date
  ) VALUES (
    NEW.id,
    100, -- Initial free credits
    NOW()
  );
  
  -- Record the initial credit transaction
  INSERT INTO credit_transactions (
    user_id,
    amount,
    description
  ) VALUES (
    NEW.id,
    100,
    'Initial free credits'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically set up new users with free subscription
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user_subscription();

-- Function to refill credits monthly based on subscription
CREATE OR REPLACE FUNCTION refill_user_credits()
RETURNS VOID AS $$
DECLARE
  subscription_record RECORD;
  credits_to_add INTEGER;
BEGIN
  -- Find active subscriptions that need credit refills
  FOR subscription_record IN
    SELECT 
      us.user_id,
      sp.credits_per_month,
      uc.last_refill_date
    FROM 
      user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      JOIN user_credits uc ON us.user_id = uc.user_id
    WHERE 
      us.status = 'active'
      AND (
        uc.last_refill_date IS NULL
        OR uc.last_refill_date < date_trunc('month', NOW())
      )
  LOOP
    -- Add credits based on subscription plan
    UPDATE user_credits
    SET 
      balance = balance + subscription_record.credits_per_month,
      last_refill_date = NOW(),
      updated_at = NOW()
    WHERE user_id = subscription_record.user_id;
    
    -- Record the transaction
    INSERT INTO credit_transactions (
      user_id,
      amount,
      description
    ) VALUES (
      subscription_record.user_id,
      subscription_record.credits_per_month,
      'Monthly subscription credit refill'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
