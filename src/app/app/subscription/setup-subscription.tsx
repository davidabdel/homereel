"use client"

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createSupabaseClient } from '@/lib/supabase'

export default function SetupSubscription() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const setupSubscription = async () => {
    if (!user) return
    
    setIsLoading(true)
    setResult(null)
    
    try {
      const supabase = createSupabaseClient()
      
      // Call a server-side function to set up the subscription
      // This approach bypasses RLS policies since it runs with SECURITY DEFINER
      const { data, error } = await supabase.rpc('setup_user_subscription', {
        user_id: user.id
      })
      
      if (error) {
        // Check if it's a duplicate subscription error
        if (error.message && error.message.includes('already exists')) {
          setResult({ 
            success: true, 
            message: 'Subscription already exists for this user.' 
          })
          return
        }
        
        // Show the detailed error message
        console.error('Setup function error:', error)
        setResult({ 
          success: false, 
          message: `Error: ${error.message || 'Unknown error'}` 
        })
        return
      }
      
      // If we got here, the subscription was created successfully
      setResult({ 
        success: true, 
        message: 'Subscription and credits set up successfully!' 
      })
      
      // Reload the page after 2 seconds to show the new subscription
      setTimeout(() => {
        window.location.reload()
      }, 2000)
      
    } catch (err: any) {
      console.error('Error setting up subscription:', err)
      setResult({ 
        success: false, 
        message: `Error: ${err.message || 'Unknown error'}` 
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="glass-card mb-8">
      <h2 className="text-xl font-semibold mb-4">Subscription Setup</h2>
      <p className="text-[#131118]/70 mb-4">
        It looks like your subscription hasn't been set up yet. Click the button below to set up your free subscription with 100 initial credits.
      </p>
      
      <button
        onClick={setupSubscription}
        disabled={isLoading}
        className="px-4 py-2 bg-[#131118] text-[#F1EEE3] border-[3px] border-[#131118] font-bold uppercase hover:bg-[#6E2CF4] transition"
      >
        {isLoading ? 'Setting up...' : 'Set Up Free Subscription'}
      </button>
      
      {result && (
        <div className={`mt-4 p-3 rounded-lg ${result.success ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
          <p className="text-sm">{result.message}</p>
        </div>
      )}
    </div>
  )
}
