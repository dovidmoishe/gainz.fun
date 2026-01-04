'use client'

import { ChatSidebar } from '@/components/Chat/ChatSidebar'
import { ChatInterface } from '@/components/Chat/ChatInterface'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useChat } from '@/hooks/useChat'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect } from 'react'

export default function ChatIdPage() {
  const { authenticated, ready } = usePrivy()
  const router = useRouter()
  const params = useParams()
  const chatId = params.id as string
  
  const {
    chats,
    currentChatId,
    messages,
    isLoading,
    isLoadingChats,
    streamingMessageId,
    createNewChat,
    selectChat,
    deleteChat,
    sendMessage,
  } = useChat()

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/')
    }
  }, [ready, authenticated, router])

  useEffect(() => {
    // Select the chat from URL when chats are loaded
    if (chatId && !isLoadingChats && chats.length > 0) {
      const chatExists = chats.find(c => c.id === chatId)
      if (chatExists && currentChatId !== chatId) {
        selectChat(chatId)
      } else if (!chatExists && currentChatId !== chatId) {
        // Chat doesn't exist, redirect to chat list
        router.push('/chat')
      }
    }
  }, [chatId, chats, isLoadingChats, currentChatId, selectChat, router])

  if (!ready || !authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-linear-to-r from-solana-purple to-solana-green animate-pulse">
            <span className="text-2xl font-bold text-white">G</span>
          </div>
          <p className="text-foreground/60">loading...</p>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background">
        <ChatSidebar
          chats={chats}
          currentChatId={currentChatId}
          onNewChat={async () => {
            const newChatId = await createNewChat()
            if (newChatId) {
              router.push(`/chat/${newChatId}`)
            }
          }}
          onSelectChat={(id) => router.push(`/chat/${id}`)}
          onDeleteChat={async (id) => {
            await deleteChat(id)
            if (currentChatId === id) {
              router.push('/chat')
            }
          }}
        />
        <SidebarInset className="flex-1">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSendMessage={sendMessage}
            chatId={currentChatId}
            streamingMessageId={streamingMessageId}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
