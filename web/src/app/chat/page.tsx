'use client'

import { ChatSidebar } from '@/components/Chat/ChatSidebar'
import { ChatInterface } from '@/components/Chat/ChatInterface'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useChat } from '@/hooks/useChat'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ChatPage() {
  const { authenticated, ready } = usePrivy()
  const router = useRouter()
  const {
    chats,
    currentChatId,
    messages,
    isLoading,
    isLoadingChats,
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
          onNewChat={createNewChat}
          onSelectChat={selectChat}
          onDeleteChat={deleteChat}
        />
        <SidebarInset className="flex-1">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSendMessage={sendMessage}
            chatId={currentChatId}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}