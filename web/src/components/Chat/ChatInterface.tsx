'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Message } from '../../../services/chat.service'
import { cn } from '@/lib/utils'

interface ChatInterfaceProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (content: string) => void
  chatId?: string
}

export function ChatInterface({
  messages,
  isLoading,
  onSendMessage,
  chatId,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    onSendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {!chatId ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-linear-to-r from-solana-purple to-solana-green">
                <span className="text-2xl font-bold text-white">G</span>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-electric-green">
                gainz.fun
              </h2>
              <p className="text-foreground/60">
                your solana-powered trading assistant
              </p>
              <p className="mt-4 text-sm text-foreground/40">
                start a new chat to begin trading
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground/60">
                ready to trade?
              </h3>
              <p className="mt-2 text-sm text-foreground/40">
                ask me anything about your wallet or trading
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-solana-purple to-solana-green">
                    <span className="text-sm font-bold text-white">G</span>
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-electric-green text-deep-black'
                      : 'bg-background-soft text-foreground border border-electric-green/20'
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm">
                    {typeof message.content === 'string'
                      ? message.content
                      : JSON.stringify(message.content)}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-electric-green/20">
                    <span className="text-sm font-bold text-electric-green">U</span>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-solana-purple to-solana-green">
                  <span className="text-sm font-bold text-white">G</span>
                </div>
                <div className="rounded-2xl border border-electric-green/20 bg-background-soft px-4 py-3">
                  <Loader2 className="size-4 animate-spin text-electric-green" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-electric-green/20 bg-background-soft p-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                chatId
                  ? 'ask about your wallet, trades, or anything...'
                  : 'start a new chat first...'
              }
              disabled={!chatId || isLoading}
              className="flex-1 border-electric-green/20 bg-background text-foreground placeholder:text-foreground/40 focus-visible:border-electric-green focus-visible:ring-electric-green/20"
            />
            <Button
              type="submit"
              disabled={!input.trim() || !chatId || isLoading}
              className="bg-electric-green text-deep-black hover:bg-electric-green/90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

