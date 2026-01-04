'use client'

import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useRef, useState } from 'react'
import { UserService } from '../../services/user.service'

const userService = new UserService()

function SessionSignerSetup({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()
  const userCreatedRef = useRef(false)
  const isCreatingRef = useRef(false)
  const [retryTrigger, setRetryTrigger] = useState(0)
  const maxRetries = 20 // Wait up to 20 seconds for wallet to be ready

  useEffect(() => {
    // Wait for Privy to be fully ready (including OAuth callback processing)
    if (!ready) {
      console.log('Waiting for Privy to be ready...', { ready })
      return
    }
    
    if (!authenticated || !user) return
    if (userCreatedRef.current) return
    if (isCreatingRef.current) return

    // Check if we're on an OAuth callback page (has privy_oauth_code in URL)
    const isOAuthCallback = typeof window !== 'undefined' && 
      (window.location.search.includes('privy_oauth_code') || 
       window.location.search.includes('privy_oauth_state'))
    
    // Add a small delay after OAuth callback to ensure Privy has processed everything
    if (isOAuthCallback && retryTrigger === 0) {
      console.log('OAuth callback detected, waiting for Privy to process...')
      const timeout = setTimeout(() => {
        setRetryTrigger(1)
      }, 5000) // Wait 2 seconds for OAuth processing
      return () => clearTimeout(timeout)
    }

    const solanaWallet = user.wallet
    
    // If wallet not ready yet, retry after a delay (OAuth callback might still be processing)
    if (!solanaWallet?.address) {
      if (retryTrigger < maxRetries) {
        console.log(`Wallet not ready yet, retrying... (${retryTrigger + 1}/${maxRetries})`)
        const timeout = setTimeout(() => {
          setRetryTrigger(prev => prev + 1)
        }, 1000)
        return () => clearTimeout(timeout)
      } else {
        console.error('Wallet not ready after max retries')
        return
      }
    }
    
    console.log('Wallet ready, proceeding with user creation check', {
      walletAddress: solanaWallet.address,
      userId: user.id
    })

    const createUserIfNeeded = async () => {
      if (isCreatingRef.current) return
      isCreatingRef.current = true

      try {
        // First check if user exists by ID
        try {
          const existingUser = await userService.getUserById(user.id)
          console.log('User already exists by ID:', existingUser)
          userCreatedRef.current = true
          isCreatingRef.current = false
          return
        } catch (error: any) {
          console.log('User not found by ID (expected if new user):', error.response?.status || error.message)
        }
     
            const username =
              user.twitter?.username || 
              `user_${user.id.slice(0, 8)}`

            console.log('Creating user in database:', {
              id: user.id,
              name: username,
              publicKey: solanaWallet.address,
            })

            try {
              const createdUser = await userService.createUser({
                id: user.id,
                name: username,
                publicKey: solanaWallet.address,
              })
              
              console.log('User created successfully:', createdUser)
              userCreatedRef.current = true
            } catch (createError: any) {
              console.error('Failed to create user:', createError)
              // If it's a duplicate error, mark as created anyway
              if (createError.response?.status === 409 || createError.code === '23505') {
                console.log('User already exists, marking as created')
                userCreatedRef.current = true
              } else {
                throw createError
              }
            }
        
      } catch (error: any) {
        console.error('Error in createUserIfNeeded:', error)  
        setTimeout(() => {
          isCreatingRef.current = false
        }, 2000)
        return
      }

      isCreatingRef.current = false
    }

    createUserIfNeeded()
  }, [ready, authenticated, user, retryTrigger])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        loginMethods: ['twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#22FF88',
        },
        embeddedWallets: {
          solana: {
            createOnLogin: 'all-users',
          },
        },
      }}
    >
      <SessionSignerSetup>{children}</SessionSignerSetup>
    </PrivyProvider>
  )
}
