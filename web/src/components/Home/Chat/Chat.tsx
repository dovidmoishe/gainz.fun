'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'

export default function Chat() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center">
        <div className="mb-6 inline-flex size-20 items-center justify-center rounded-full bg-linear-to-r from-solana-purple to-solana-green">
          <MessageSquare className="size-10 text-white" />
        </div>
        <h2 className="mb-3 text-3xl font-bold text-electric-green">
          ai trading assistant
        </h2>
        <p className="mb-6 text-foreground/60 max-w-md">
          chat with gainz, your solana-powered trading companion. get insights, execute trades, and manage your wallet—all through conversation.
        </p>
        <Button
          onClick={() => router.push('/chat')}
          className="bg-electric-green text-deep-black hover:bg-electric-green/90 px-8 py-6 text-lg"
        >
          start chatting
        </Button>
      </div>
    </div>
  )
}