"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { 
  getSubscriptionPlans, 
  getUserSubscription, 
  getUserCredits,
  getCreditTransactions,
  changeSubscriptionPlan,
  cancelSubscription,
  createInitialCredits,
  type SubscriptionPlan,
  type UserSubscription,
  type UserCredits,
  type CreditTransaction
} from '@/lib/subscription-service'
// Setup subscription component would go here

export default function SubscriptionPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [credits, setCredits] = useState<UserCredits | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isChangingPlan, setIsChangingPlan] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  
  // Stripe Payment Links (from env). Used to route paid plan selections to Stripe Checkout
  const links = {
    lite: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_LITE_MONTHLY || '#',
      yearly: process.env.NEXT_PUBLIC_STRIPE_LINK_LITE_ANNUAL || '#',
    },
    business: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_BUSINESS_MONTHLY || '#',
      yearly: process.env.NEXT_PUBLIC_STRIPE_LINK_BUSINESS_ANNUAL || '#',
    },
    heavy: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_HEAVY_MONTHLY || '#',
      yearly: process.env.NEXT_PUBLIC_STRIPE_LINK_HEAVY_ANNUAL || '#',
    },
  } as const

  const getStripeLinkForPlan = (planName: string) => {
    const key = planName.toLowerCase()
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly'
    let base = '#'
    if (key === 'lite') base = links.lite[cycle]
    else if (key === 'business') base = links.business[cycle]
    else if (key === 'heavy') base = links.heavy[cycle]
    if (base === '#') return base
    // Tie the Stripe checkout back to this user so the webhook can credit the
    // right account (client_reference_id) and pre-fill their email.
    const sep = base.includes('?') ? '&' : '?'
    const params = new URLSearchParams()
    if (user?.id) params.set('client_reference_id', user.id)
    if (user?.email) params.set('prefilled_email', user.email)
    const qs = params.toString()
    return qs ? `${base}${sep}${qs}` : base
  }
  
  useEffect(() => {
    async function loadSubscriptionData() {
      if (!user) return
      
      setIsLoading(true)
      setError(null)
      
      try {
        // Load all subscription data in parallel
        const [plansResult, subscriptionResult, creditsResult, transactionsResult] = await Promise.all([
          getSubscriptionPlans(),
          getUserSubscription(user.id),
          getUserCredits(user.id),
          getCreditTransactions(user.id, 5)
        ])
        
        if (!plansResult.success || !plansResult.plans || plansResult.plans.length === 0) {
          console.error('No subscription plans found:', plansResult)
          // Instead of throwing an error, we'll just show a message
          setError('Subscription plans not available. Please try again later.')
          setPlans([])
        } else {
          setPlans(plansResult.plans)
          setError(null)
        }
        
        console.log('Subscription result:', JSON.stringify(subscriptionResult, null, 2))
        if (subscriptionResult.success) {
          console.log('Subscription data (raw):', JSON.stringify(subscriptionResult.subscription, null, 2))
          
          // Check if we have a subscription
          if (subscriptionResult.subscription) {
            console.log('Subscription found, setting state')
            setSubscription(subscriptionResult.subscription)
            
            // Check if the plan_id exists
            console.log('Plan ID from subscription:', subscriptionResult.subscription.plan_id)
            
            // Check if the plan exists in the plans array
            const planExists = plans.some(p => p.id === subscriptionResult.subscription?.plan_id)
            console.log('Plan exists in plans array:', planExists)
            
            // Check if the embedded plan exists
            console.log('Embedded plan:', subscriptionResult.subscription.plan)
          } else {
            console.warn('Subscription result success but no subscription data')
            setSubscription(null)
          }
        } else {
          console.warn('Error getting subscription:', subscriptionResult.error)
        }
        
        if (creditsResult.success) {
          if (creditsResult.credits) {
            setCredits(creditsResult.credits)
          } else if (user) {
            // No credits found, create initial credits
            console.log('No credits found, creating initial credits')
            const createCreditsResult = await createInitialCredits(user.id)
            if (createCreditsResult.success) {
              setCredits(createCreditsResult.credits || null)
            }
          } else {
            setCredits(null)
          }
        } else {
          console.warn('Error getting user credits')
        }
        
        if (transactionsResult.success) {
          setTransactions(transactionsResult.transactions || [])
        }
      } catch (err: any) {
        console.error('Error loading subscription data:', err)
        setError(err.message || 'An error occurred while loading subscription data')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSubscriptionData()
  }, [user])
  
  const handleChangePlan = async (planId: string) => {
    if (!user) return
    
    setIsChangingPlan(true)
    setError(null)
    
    try {
      const result = await changeSubscriptionPlan(user.id, planId)
      
      if (!result.success) {
        throw new Error('Failed to change subscription plan')
      }
      
      // Reload subscription data
      const subscriptionResult = await getUserSubscription(user.id)
      
      if (subscriptionResult.success) {
        setSubscription(subscriptionResult.subscription || null)
      }
    } catch (err: any) {
      console.error('Error changing subscription plan:', err)
      setError(err.message || 'An error occurred while changing your subscription plan')
    } finally {
      setIsChangingPlan(false)
    }
  }
  
  const handleCancelSubscription = async () => {
    if (!user || !subscription) return
    
    setIsCanceling(true)
    setError(null)
    
    try {
      const result = await cancelSubscription(user.id)
      
      if (!result.success) {
        throw new Error('Failed to cancel subscription')
      }
      
      // Reload subscription data
      const subscriptionResult = await getUserSubscription(user.id)
      
      if (subscriptionResult.success) {
        setSubscription(subscriptionResult.subscription || null)
      }
    } catch (err: any) {
      console.error('Error canceling subscription:', err)
      setError(err.message || 'An error occurred while canceling your subscription')
    } finally {
      setIsCanceling(false)
    }
  }
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price / 100)
  }
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  
  const getCurrentPlan = () => {
    console.log('getCurrentPlan called with subscription:', subscription)
    console.log('Available plans:', plans)
    
    if (!subscription) {
      console.log('No subscription, returning null')
      return null
    }
    
    // First check if the subscription has an embedded plan
    if (subscription.plan) {
      console.log('Using embedded plan:', subscription.plan)
      return subscription.plan
    }
    
    // Fallback to finding the plan in the plans array
    if (plans.length) {
      console.log('Looking for plan with ID:', subscription.plan_id)
      const foundPlan = plans.find(plan => plan.id === subscription.plan_id)
      console.log('Found plan:', foundPlan)
      
      if (foundPlan) {
        return foundPlan
      }
    }
    
    // Last resort: create a default plan object
    console.log('No plan found, creating default Free plan')
    return {
      id: subscription.plan_id,
      name: 'Free',
      description: 'Basic access with limited features',
      price_monthly: 0,
      price_yearly: 0,
      credits_per_month: 100,
      features: ['Basic features'],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
  
  const currentPlan = getCurrentPlan()
  
  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)
    
    if (user) {
      try {
        // Load all subscription data in parallel
        const [plansResult, subscriptionResult, creditsResult, transactionsResult] = await Promise.all([
          getSubscriptionPlans(),
          getUserSubscription(user.id),
          getUserCredits(user.id),
          getCreditTransactions(user.id, 5)
        ])
        
        console.log('Refresh results:', JSON.stringify({ 
          plansResult, 
          subscriptionResult, 
          creditsResult, 
          transactionsResult 
        }, null, 2))
        
        if (!plansResult.success || !plansResult.plans || plansResult.plans.length === 0) {
          console.error('No subscription plans found:', plansResult)
          setError('Subscription plans not available. Please try again later.')
          setPlans([])
        } else {
          setPlans(plansResult.plans)
          setError(null)
          console.log('Plans loaded:', plansResult.plans.length, 'plans')
        }
        
        if (subscriptionResult.success) {
          console.log('Subscription data (raw):', JSON.stringify(subscriptionResult.subscription, null, 2))
          
          // Check if we have a subscription
          if (subscriptionResult.subscription) {
            console.log('Subscription found, setting state')
            setSubscription(subscriptionResult.subscription)
            
            // Check if the plan_id exists
            console.log('Plan ID from subscription:', subscriptionResult.subscription.plan_id)
            
            // Check if the plan exists in the plans array
            const planExists = plansResult.plans?.some(p => p.id === subscriptionResult.subscription?.plan_id)
            console.log('Plan exists in plans array:', planExists)
            
            // Check if the embedded plan exists
            console.log('Embedded plan:', subscriptionResult.subscription.plan)
          } else {
            console.warn('Subscription result success but no subscription data')
            setSubscription(null)
          }
        } else {
          console.warn('Error getting subscription:', subscriptionResult.error)
        }
        
        if (creditsResult.success) {
          if (creditsResult.credits) {
            setCredits(creditsResult.credits)
          } else {
            // No credits found, create initial credits
            console.log('No credits found, creating initial credits')
            const createCreditsResult = await createInitialCredits(user.id)
            if (createCreditsResult.success) {
              setCredits(createCreditsResult.credits || null)
            }
          }
        } else {
          console.warn('Error getting user credits')
        }
        
        if (transactionsResult.success) {
          setTransactions(transactionsResult.transactions || [])
        }
      } catch (err: any) {
        console.error('Error refreshing subscription data:', err)
        setError(err.message || 'An error occurred while refreshing subscription data')
      }
    } else {
      // Force reload the page if no user
      window.location.reload()
    }
    
    setIsLoading(false)
  }
  
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Subscription</h1>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1 text-sm border-[3px] border-[#131118] bg-transparent hover:bg-[#D8FF3E] transition flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-[#131118]/60 border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="mb-6 border-[3px] border-[#131118] bg-[#FF3E5F] p-4">
          <p className="font-semibold text-[#F1EEE3]">{error}</p>
        </div>
      ) : (
        <>
          {/* Subscription Setup - show only if no subscription exists */}
          {!subscription && !isLoading && (
            <div className="glass-card mb-8 p-6 text-center">
              <h3 className="text-xl font-medium mb-4">Get Started with a Subscription</h3>
              <p className="text-[#131118]/70 mb-6">Choose a plan below to get started with your subscription.</p>
              <button
                onClick={() => window.scrollTo({ top: document.getElementById('available-plans')?.offsetTop || 0, behavior: 'smooth' })}
                className="px-6 py-3 bg-[#131118] text-[#F1EEE3] border-[3px] border-[#131118] font-bold uppercase hover:bg-[#6E2CF4] transition"
              >
                View Plans
              </button>
            </div>
          )}
          
          {/* Current Subscription */}
          <div className="glass-card mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>
            
            {subscription ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">{currentPlan?.name || 'Free'} Plan</h3>
                    <p className="text-[#131118]/70">{currentPlan?.description || 'Basic access with limited features'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium">
                      {formatPrice(billingCycle === 'monthly' ? currentPlan?.price_monthly || 0 : currentPlan?.price_yearly || 0)}
                      <span className="text-sm text-[#131118]/60">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                    </div>
                    <div className="text-sm text-[#131118]/60">
                      {subscription && (subscription.status === 'active' ? 'Active' : subscription.status)}
                    </div>
                  </div>
                </div>
                
                <div className="border-t-[3px] border-[#131118] pt-4 mt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-[#131118]/70">Current period</span>
                    <span>
                      {subscription && formatDate(subscription.current_period_start)} - {subscription && formatDate(subscription.current_period_end)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-[#131118]/70">Credits per month</span>
                    <span>{currentPlan?.credits_per_month || 100}</span>
                  </div>
                </div>
                
                {subscription && subscription.cancel_at_period_end && (
                  <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                    <p className="text-sm">
                      Your subscription will be canceled at the end of the current billing period.
                    </p>
                  </div>
                )}
                
                {subscription && subscription.status === 'active' && !subscription.cancel_at_period_end && (
                  <div className="mt-6 flex gap-4">
                    <button
                      onClick={() => window.scrollTo({ top: document.getElementById('available-plans')?.offsetTop || 0, behavior: 'smooth' })}
                      className="px-4 py-2 text-sm bg-[#131118] text-[#F1EEE3] border-[3px] border-[#131118] font-bold uppercase hover:bg-[#6E2CF4] transition"
                    >
                      Upgrade Plan
                    </button>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={isCanceling}
                      className="px-4 py-2 text-sm border-[3px] border-[#131118] bg-transparent hover:bg-[#D8FF3E] transition"
                    >
                      {isCanceling ? 'Canceling...' : 'Cancel Subscription'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[#131118]/70">You don't have an active subscription.</p>
            )}
          </div>
          
          {/* Credit Balance */}
          <div className="glass-card mb-8">
            <h2 className="text-xl font-semibold mb-4">Credit Balance</h2>
            
            {credits ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[#131118]/70">Available credits</span>
                  <span className="text-2xl font-medium">{credits.balance}</span>
                </div>
                
                <div className="mt-4">
                  <button
                    onClick={() => window.scrollTo({ top: document.getElementById('available-plans')?.offsetTop || 0, behavior: 'smooth' })}
                    className="px-4 py-2 bg-[#131118] text-[#F1EEE3] border-[3px] border-[#131118] font-bold uppercase hover:bg-[#6E2CF4] transition"
                  >
                    Buy More Credits
                  </button>
                </div>
                
                {credits.last_refill_date && (
                  <div className="mt-2 text-sm text-[#131118]/60">
                    Last refill: {formatDate(credits.last_refill_date)}
                  </div>
                )}
                
                {transactions.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-md font-medium mb-2">Recent Transactions</h3>
                    <div className="border-[3px] border-[#131118] overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#131118]/5">
                            <th className="px-4 py-2 text-left text-sm">Date</th>
                            <th className="px-4 py-2 text-left text-sm">Description</th>
                            <th className="px-4 py-2 text-right text-sm">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map(transaction => (
                            <tr key={transaction.id} className="border-t-[3px] border-[#131118]">
                              <td className="px-4 py-2 text-sm">
                                {new Date(transaction.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 text-sm">{transaction.description}</td>
                              <td className={`px-4 py-2 text-sm text-right ${transaction.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[#131118]/70">Credit information not available.</p>
            )}
          </div>
          
          {/* Available Plans */}
          <div id="available-plans">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Available Plans</h2>
              <div className="flex items-center p-1 bg-[#131118]/5 rounded-lg">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    billingCycle === 'monthly' ? 'bg-[#D8FF3E]' : ''
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    billingCycle === 'yearly' ? 'bg-[#D8FF3E]' : ''
                  }`}
                >
                  Yearly (Save 15%)
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map(plan => {
                const isCurrentPlan = currentPlan?.id === plan.id;
                const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
                
                return (
                  <div 
                    key={plan.id} 
                    className={`glass-card relative ${isCurrentPlan ? 'border-[color:var(--brand-2)] border-2' : ''}`}
                  >
                    {isCurrentPlan && (
                      <div className="font-mono-brand absolute -top-3 left-1/2 -translate-x-1/2 transform border-[2px] border-[#131118] bg-[#6E2CF4] px-3 py-1 text-xs font-bold uppercase text-[#F1EEE3]">
                        Current Plan
                      </div>
                    )}
                    
                    <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-2xl font-bold">{formatPrice(price)}</span>
                      <span className="text-[#131118]/60">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                    </div>
                    
                    <p className="text-[#131118]/70 mb-4">{plan.description}</p>
                    
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[#131118]/70">Monthly credits</span>
                        <span className="font-medium">{plan.credits_per_month}</span>
                      </div>
                    </div>
                    
                    <ul className="mb-6 space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-sm">
                          <span className="text-[color:var(--brand-2)] mr-2">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {price === 0 ? (
                      <button
                        onClick={() => handleChangePlan(plan.id)}
                        disabled={isChangingPlan || isCurrentPlan}
                        className={`w-full py-2 rounded-lg transition ${
                          isCurrentPlan
                            ? 'bg-[#131118]/10 text-[#131118]/40 cursor-not-allowed'
                            : 'bg-[#131118] text-[#F1EEE3] border-[3px] border-[#131118] font-bold uppercase hover:bg-[#6E2CF4]'
                        }`}
                      >
                        {isChangingPlan
                          ? 'Processing...'
                          : isCurrentPlan
                          ? 'Current Plan'
                          : 'Start free'}
                      </button>
                    ) : (
                      <a
                        href={getStripeLinkForPlan(plan.name)}
                        target={getStripeLinkForPlan(plan.name) !== '#' ? '_blank' : undefined}
                        rel="noreferrer"
                        className={`block text-center w-full py-2 rounded-lg transition ${
                          isCurrentPlan
                            ? 'bg-[#131118]/10 text-[#131118]/40 cursor-not-allowed pointer-events-none'
                            : 'bg-[#131118] text-[#F1EEE3] border-[3px] border-[#131118] font-bold uppercase hover:bg-[#6E2CF4]'
                        }`}
                      >
                        {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
