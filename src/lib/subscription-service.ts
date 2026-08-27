import { createSupabaseBrowserClient } from './supabase';

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  credits_per_month: number;
  features: string[];
  is_active: boolean;
};

export type UserSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  payment_provider?: string;
  payment_provider_subscription_id?: string;
  plan?: SubscriptionPlan;
};

export type UserCredits = {
  id: string;
  user_id: string;
  balance: number;
  last_refill_date?: string;
};

export type CreditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans() {
  const supabase = createSupabaseBrowserClient();
  
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });
      
    if (error) throw error;
    
    // Log the plans for debugging
    console.log('Available subscription plans:', data.map(p => p.name));
    
    return { 
      success: true, 
      plans: data.map(plan => ({
        ...plan,
        features: plan.features as string[]
      }))
    };
  } catch (error) {
    console.error('Error getting subscription plans:', error);
    return { success: false, error };
  }
}

/**
 * Spend user credits using the SECURITY DEFINER RPC.
 * Returns { success, balance?, message? }.
 */
export async function spendUserCredits(userId: string, amount: number, description = 'Image generation') {
  const supabase = createSupabaseBrowserClient();

  try {
    const { data, error } = await supabase.rpc('spend_user_credits', {
      p_user_id: userId,
      p_spend_amount: amount,
      p_spend_description: description,
    });

    if (error) throw error;

    // data is expected to be JSONB from the function
    const ok = Boolean(data?.success);
    const balance = typeof data?.balance === 'number' ? data.balance : undefined;
    const message = typeof data?.message === 'string' ? data.message : undefined;
    try { console.debug('[credits] spend_user_credits response', { ok, balance, message, raw: data }); } catch {}
    return { success: ok, balance, message };
  } catch (error) {
    console.error('Error spending credits:', error);
    return { success: false, error };
  }
}

/**
 * Get the current user's subscription
 */
export async function getUserSubscription(userId: string) {
  const supabase = createSupabaseBrowserClient();
  
  try {
    console.log('Getting subscription for user:', userId);
    
    // First get the subscription without joins to avoid RLS issues
    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    console.log('Raw subscription query result:', { subData, subError });
      
    if (subError) {
      // This is a real error, not just no rows
      throw subError;
    }
    
    // If no subscription found, return null
    if (!subData) {
      console.log('No subscription found for user');
      return { success: true, subscription: null };
    }
    
    // Now get the plan data separately
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', subData.plan_id)
      .maybeSingle();
    
    console.log('Plan query result:', { planData, planError });
    
    // Create the subscription object
    const subscription: UserSubscription = {
      ...subData,
      plan: planData as unknown as SubscriptionPlan
    };
    
    console.log('Processed subscription:', subscription);
    return { success: true, subscription };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return { success: false, error };
  }
}

/**
 * Get the current user's credit balance
 */
export async function getUserCredits(userId: string) {
  const supabase = createSupabaseBrowserClient();
  
  try {
    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle instead of single to handle no rows
      
    if (error) {
      // This is a real error, not just no rows
      throw error;
    }
    
    // If no credits found, return null instead of throwing an error
    return { success: true, credits: data || null };
  } catch (error) {
    console.error('Error getting user credits:', error);
    return { success: false, error };
  }
}

/**
 * Get the user's credit transaction history
 */
export async function getCreditTransactions(userId: string, limit = 10) {
  const supabase = createSupabaseBrowserClient();
  
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    return { success: true, transactions: data };
  } catch (error) {
    console.error('Error getting credit transactions:', error);
    return { success: false, error };
  }
}

/**
 * Create initial credits for a user if they don't exist
 */
export async function createInitialCredits(userId: string, amount = 100) {
  const supabase = createSupabaseBrowserClient();
  
  try {
    // Use the setup_user_credits function to bypass RLS
    const { data, error } = await supabase.rpc('setup_user_credits', {
      user_id: userId,
      initial_amount: amount
    });
    
    if (error) throw error;
    
    // After creating credits, fetch them
    if (data.success) {
      const { data: credits, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (creditsError) throw creditsError;
      
      return { success: true, credits, message: data.message };
    }
    
    return { success: true, message: data.message };
  } catch (error) {
    console.error('Error creating initial credits:', error);
    return { success: false, error };
  }
}

/**
 * Change the user's subscription plan
 * Note: In a real implementation, this would integrate with a payment provider like Stripe
 */
export async function changeSubscriptionPlan(userId: string, planId: string) {
  const supabase = createSupabaseBrowserClient();
  
  try {
    // Get the current subscription
    const { data: currentSub, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (subError && subError.code !== 'PGRST116') throw subError;
    
    // Get the new plan details (we only need to validate existence)
    const { error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();
      
    if (planError) throw planError;
    
    // In a real implementation, you would:
    // 1. Create or update the subscription in your payment provider (e.g., Stripe)
    // 2. Store the payment provider's subscription ID
    
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    if (currentSub) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: planId,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: nextMonth.toISOString(),
          cancel_at_period_end: false,
          updated_at: now.toISOString()
        })
        .eq('id', currentSub.id);
        
      if (updateError) throw updateError;
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: nextMonth.toISOString()
        });
        
      if (insertError) throw insertError;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    return { success: false, error };
  }
}

/**
 * Cancel the user's subscription
 */
export async function cancelSubscription(userId: string, cancelImmediately = false) {
  const supabase = createSupabaseBrowserClient();
  
  try {
    // Get the current subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
      
    if (subError) throw subError;
    
    if (cancelImmediately) {
      // Cancel immediately
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);
        
      if (updateError) throw updateError;
    } else {
      // Cancel at period end
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);
        
      if (updateError) throw updateError;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return { success: false, error };
  }
}
