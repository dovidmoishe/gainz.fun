'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import ChatService, { Chat, Message } from '../../services/chat.service'
import AIService, { AIMessage } from '../../services/ai.service'
import { v4 as uuidv4 } from 'uuid'

const chatService = new ChatService()

export function useChat() {
  const { user, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingChats, setIsLoadingChats] = useState(true)

  const loadChats = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoadingChats(true)
      const userChats = await chatService.getAllChatsForUser(user.id)
      setChats(userChats)
    } catch (error) {
      console.error('Failed to load chats:', error)
    } finally {
      setIsLoadingChats(false)
    }
  }, [user?.id])

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const chatMessages = await chatService.getMessagesInChat(chatId)
      setMessages(chatMessages)
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    }
  }, [])

  useEffect(() => {
    if (authenticated && user?.id) {
      loadChats()
    }
  }, [authenticated, user?.id, loadChats])

  useEffect(() => {
    if (currentChatId) {
      loadMessages(currentChatId)
    } else {
      setMessages([])
    }
  }, [currentChatId, loadMessages])

  const createNewChat = useCallback(async () => {
    if (!user?.id) return

    try {
      const newChatId = uuidv4()
      const newChat = await chatService.createChat({
        title: 'new chat',
        userId: user.id,
        chatId: newChatId,
      })
      
      setChats((prev) => [...prev, newChat])
      setCurrentChatId(newChat.id)
      setMessages([])
    } catch (error) {
      console.error('Failed to create chat:', error)
    }
  }, [user?.id])

  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
  }, [])

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      await chatService.deleteChat(chatId)
      setChats((prev) => prev.filter((chat) => chat.id !== chatId))
      
      if (currentChatId === chatId) {
        setCurrentChatId(undefined)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to delete chat:', error)
    }
  }, [currentChatId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentChatId || !user?.id) return

      const userMessage: Message = {
        id: uuidv4(),
        chatId: currentChatId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      let assistantMessageContent = ''
      const assistantMessageId = uuidv4()

      try {
        // Get wallet info from Privy
        const solanaWallet = wallets.find(w => w.walletClientType === 'privy')
        const userPublicKey = solanaWallet?.address
        // For Privy embedded wallets, the wallet ID for API calls is the wallet address
        // The backend Privy API uses the address as the wallet identifier
        const walletId = solanaWallet?.address

        const aiMessages: AIMessage[] = [...messages, userMessage].map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        }))

        await AIService.streamResponse(
          aiMessages,
          currentChatId,
          user.id,
          (token: string) => {
            assistantMessageContent += token
            
            setMessages((prev) => {
              const existingIndex = prev.findIndex((m) => m.id === assistantMessageId)
              const assistantMessage: Message = {
                id: assistantMessageId,
                chatId: currentChatId,
                role: 'assistant',
                content: assistantMessageContent,
                createdAt: new Date().toISOString(),
              }

              if (existingIndex >= 0) {
                const updated = [...prev]
                updated[existingIndex] = assistantMessage
                return updated
              } else {
                return [...prev, assistantMessage]
              }
            })
          },
          async () => {
            setIsLoading(false)

            const finalAssistantMessage: Message = {
              id: assistantMessageId,
              chatId: currentChatId,
              role: 'assistant',
              content: assistantMessageContent,
              createdAt: new Date().toISOString(),
            }

            try {
              await chatService.saveMessages([finalAssistantMessage])
            } catch (error) {
              console.error('Failed to save assistant message:', error)
            }

            if (messages.length === 0) {
              const firstWords = content.split(' ').slice(0, 5).join(' ')
              const newTitle = firstWords.length < content.length ? `${firstWords}...` : firstWords
              
              try {
                await chatService.createChat({
                  title: newTitle,
                  userId: user.id,
                  chatId: currentChatId,
                })
                
                setChats((prev) =>
                  prev.map((chat) =>
                    chat.id === currentChatId ? { ...chat, title: newTitle } : chat
                  )
                )
              } catch (error) {
                console.error('Failed to update chat title:', error)
              }
            }
          },
          (error: Error) => {
            console.error('AI stream error:', error)
            setIsLoading(false)
            
            const errorMessage: Message = {
              id: uuidv4(),
              chatId: currentChatId,
              role: 'assistant',
              content: 'sorry, something went wrong. please try again.',
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, errorMessage])
          },
          userPublicKey,
          walletId
        )
      } catch (error) {
        console.error('Failed to send message:', error)
        setIsLoading(false)
      }
    },
    [currentChatId, user?.id, messages, wallets]
  )

  return {
    chats,
    currentChatId,
    messages,
    isLoading,
    isLoadingChats,
    createNewChat,
    selectChat,
    deleteChat,
    sendMessage,
  }
}


