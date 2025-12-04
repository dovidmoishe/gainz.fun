'use client'

import { usePrivy } from '@privy-io/react-auth'
import { MessageSquarePlus, Trash2, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Chat } from '../../../services/chat.service'

interface ChatSidebarProps {
  chats: Chat[]
  currentChatId?: string
  onNewChat: () => void
  onSelectChat: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
}

export function ChatSidebar({
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const { user, logout } = usePrivy()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  return (
    <Sidebar className="border-r border-electric-green/20 bg-background-soft">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-linear-to-r from-solana-purple to-solana-green">
              <User className="size-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {user?.twitter?.username || 'user'}
              </span>
              <span className="text-xs text-foreground/60">
                {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
              </span>
            </div>
          </div>
        </div>
        
        <Button
          onClick={onNewChat}
          className="mt-4 w-full bg-electric-green text-deep-black hover:bg-electric-green/90"
        >
          <MessageSquarePlus className="size-4" />
          new chat
        </Button>
      </SidebarHeader>

      <SidebarSeparator className="bg-electric-green/20" />

      <SidebarContent className="px-2">
        <div className="py-2">
          <p className="px-3 text-xs font-medium text-foreground/60 mb-2">chat history</p>
          <SidebarMenu>
            {chats.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-foreground/40">
                no chats yet. start a new one!
              </div>
            ) : (
              chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <div className="group relative flex items-center">
                    <SidebarMenuButton
                      onClick={() => onSelectChat(chat.id)}
                      isActive={currentChatId === chat.id}
                      className="w-full text-foreground hover:bg-electric-green/10 data-[active=true]:bg-electric-green/20 data-[active=true]:text-electric-green"
                    >
                      <MessageSquarePlus className="size-4" />
                      <span className="truncate">{chat.title}</span>
                    </SidebarMenuButton>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(chat.id)
                      }}
                      className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarSeparator className="bg-electric-green/20" />

      <SidebarFooter className="p-4">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full border-electric-green/20 text-foreground hover:bg-electric-green/10"
        >
          logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}

