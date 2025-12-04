'use client'

import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useRef } from 'react'
import { UserService } from '../../services/user.service'

const userService = new UserService()

function SessionSignerSetup({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()
  const userCreatedRef = useRef(false)
  const isCreatingRef = useRef(false)

  useEffect(() => {
    if (!ready) return
    if (!authenticated || !user) return
    if (userCreatedRef.current) return
    if (isCreatingRef.current) return

    const solanaWallet = wallets.find(w => w.walletClientType === 'privy')
    if (!solanaWallet?.address) {
      const timeout = setTimeout(() => {
      }, 1000)
      return () => clearTimeout(timeout)
    }

    const createUserIfNeeded = async () => {
      if (isCreatingRef.current) return
      isCreatingRef.current = true

      try {
        try {
          await userService.getUserById(user.id)
          userCreatedRef.current = true
          isCreatingRef.current = false
          return
        } catch (error: any) {
          console.error('Error checking user by ID:', error)
        }
        try {
          await userService.getUserByPublicKey(solanaWallet.address)
          userCreatedRef.current = true
          isCreatingRef.current = false
          return
        } catch (error: any) {
          console.error('Error checking user by public key:', error)
          if (error.response?.status === 404 || !error.response) {
            const username =
              user.twitter?.username || 
              `user_${user.id.slice(0, 8)}`

            console.log('Creating user in database:', {
              id: user.id,
              name: username,
              publicKey: solanaWallet.address,
            })

            await userService.createUser({
              id: user.id,
              name: username,
              publicKey: solanaWallet.address,
            })
            
            console.log('User created successfully')
            userCreatedRef.current = true
          } else {
            console.error('Error checking user:', error)
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
  }, [ready, authenticated, user, wallets])

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
