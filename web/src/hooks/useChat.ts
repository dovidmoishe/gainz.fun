'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import ChatService, { Chat, Message } from '../../services/chat.service'
import aiService from '../../services/ai.service'

const chatService = new ChatService()

// Generate UUID v4
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function useChat() {
  const { user, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const messageContentRef = useRef<Map<string, string>>(new Map())
  const streamCleanupRef = useRef<(() => void) | null>(null)

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
      const newChat = await chatService.createChat({
        title: 'new chat',
        userId: user.id,
      })
      
      setChats((prev) => [...prev, newChat])
      setCurrentChatId(newChat.id)
      setMessages([])
      return newChat.id
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

      // Clean up any existing stream
      if (streamCleanupRef.current) {
        streamCleanupRef.current()
        streamCleanupRef.current = null
      }

      // Generate UUID for user message
      const userMessageId = generateUUID()
      const userMessage: Message = {
        id: userMessageId,
        chatId: currentChatId,
        role: 'user',
        content: typeof content === 'string' ? content : JSON.stringify(content),
        createdAt: new Date().toISOString(),
      }

      // Optimistic update: add user message immediately
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      const assistantMessageId = generateUUID()
      setStreamingMessageId(assistantMessageId)
      messageContentRef.current.set(assistantMessageId, '')
      
      // Safety timeout to reset loading state if stream doesn't complete
      const safetyTimeout = setTimeout(() => {
        console.warn('⚠️ Stream timeout - resetting loading state');
        setIsLoading(false)
        setStreamingMessageId(null)
        messageContentRef.current.delete(assistantMessageId)
      }, 120000) // 2 minutes timeout

      try {
        // Prepare all messages for the stream (including the new user message)
        const allMessagesForStream = [...messages, userMessage].map(msg => ({
          ...msg,
          content: typeof msg.content === 'string' 
            ? msg.content 
            : (typeof msg.content === 'object' 
                ? JSON.stringify(msg.content) 
                : String(msg.content)),
        }))

        // Start streaming
        const cleanup = await aiService.generateMessagesStream(
          {
            messages: allMessagesForStream,
            chatId: currentChatId,
            userId: user.id,
          },
          (token: string, type?: string) => {
            // Accumulate tokens in ref
            const currentContent = messageContentRef.current.get(assistantMessageId) || ''
            const newContent = currentContent + token
            messageContentRef.current.set(assistantMessageId, newContent)

            // Update state with accumulated content
            setMessages((prev) => {
              const existingIndex = prev.findIndex((m) => m.id === assistantMessageId)
              const assistantMessage: Message = {
                id: assistantMessageId,
                chatId: currentChatId,
                role: 'assistant',
                content: newContent,
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
          async (fullMessage: Message) => {
            console.log('✅ Stream completed callback fired');
            clearTimeout(safetyTimeout)
            
            // Clean up streaming state
            setStreamingMessageId(null)
            messageContentRef.current.delete(assistantMessageId)

            // Update chat title if it's the first user message
            if (messages.length === 0) {
              const firstWords = content.split(' ').slice(0, 5).join(' ')
              const newTitle = firstWords.length < content.length ? `${firstWords}...` : firstWords
              
              try {
                await chatService.updateChatTitle(currentChatId, newTitle)
                
                setChats((prev) =>
                  prev.map((chat) =>
                    chat.id === currentChatId ? { ...chat, title: newTitle } : chat
                  )
                )
              } catch (error) {
                console.error('Failed to update chat title:', error)
              }
            }

            // Reload messages to ensure sync with backend
            await loadMessages(currentChatId)
            
            // Set loading to false AFTER everything is done
            setIsLoading(false)
          },
          (error: Error) => {
            console.error('AI stream error:', error)
            clearTimeout(safetyTimeout)
            setIsLoading(false)
            setStreamingMessageId(null)
            messageContentRef.current.delete(assistantMessageId)
            
            const errorMessage: Message = {
              id: generateUUID(),
              chatId: currentChatId,
              role: 'assistant',
              content: 'sorry, something went wrong. please try again.',
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, errorMessage])
          }
        )

        streamCleanupRef.current = cleanup
      } catch (error) {
        console.error('Failed to send message:', error)
        const err = error as any
        console.error('Error details:', err.response?.data || err.message)
        clearTimeout(safetyTimeout)
        setIsLoading(false)
        setStreamingMessageId(null)
        messageContentRef.current.delete(assistantMessageId)
        
        const errorMessage: Message = {
          id: generateUUID(),
          chatId: currentChatId,
          role: 'assistant',
          content: `error: ${err.response?.data?.message || err.message || 'failed to send message. please try again.'}`,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    },
    [currentChatId, user?.id, messages, loadMessages]
  )

  return {
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
  }
}


