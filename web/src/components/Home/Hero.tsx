'use client'

import React, { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import ChatService from '../../../services/chat.service'

type Props = {}

const chatService = new ChatService()

function Hero({}: Props) {
  const { login, ready, authenticated, user } = usePrivy()
  const router = useRouter()
  const [isCreatingChat, setIsCreatingChat] = useState(false)

  const handleLoginWithX = () => {
    if (ready && !authenticated) {
      login()
    }
  }

  const handleGoToChat = async () => {
    if (!user?.id) return
    
    try {
      setIsCreatingChat(true)
      // Create a new chat automatically
      const newChat = await chatService.createChat({
        title: 'new chat',
        userId: user.id,
      })
      // Navigate to the chat with UUID in URL
      router.push(`/chat/${newChat.id}`)
    } catch (error) {
      console.error('Failed to create chat:', error)
      // Fallback to chat list page
      router.push('/chat')
    } finally {
      setIsCreatingChat(false)
    }
  }

  return (
    <section className="w-full min-h-screen flex items-center justify-center bg-background px-6 pt-20">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-foreground">
          AI Trading Partner
        </h1>

        <p className="text-lg md:text-xl text-foreground/70 mb-12 max-w-2xl mx-auto">
          Degen your way to the moon with AI-powered trading. Track PNL, trade faster and smarter
        </p>

        {authenticated ? (
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <button
              onClick={handleGoToChat}
              disabled={isCreatingChat}
              className="px-6 py-3 bg-electric-green text-deep-black rounded-full font-semibold text-lg cursor-pointer hover:bg-electric-green/90 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingChat ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>creating...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>start trading</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleLoginWithX}
            disabled={!ready || authenticated}
            className="px-4 py-2 bg-foreground text-deep-black rounded-full font-semibold text-lg cursor-pointer hover:bg-electric-green transition-colors flex items-center gap-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Login with X</span>
          </button>
        )}
      </div>
    </section>
  )
}

export default Hero