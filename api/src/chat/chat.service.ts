import { Injectable } from '@nestjs/common';

import { asc, eq, and } from 'drizzle-orm';

import { v4 as uuidv4 } from 'uuid';

import db from '../../drizzle';

import { chat, message, type Chat, type Message } from '../../lib/db/schema';

@Injectable()
export class ChatService {
  async createChat({ title, userId, chatId }: { title: string; userId: string; chatId?: string }): Promise<Chat> {
    const newChatId = chatId || uuidv4();

    const result = await db
      .insert(chat)
      .values({
        id: newChatId,
        createdAt: new Date(),
        title,
        userId,
      })
      .returning();

    return result[0];
  }

  async getAllChatsForUser(userId: string) {
    return await db
      .select()
      .from(chat)
      .where(and(
        eq(chat.userId, userId),
      ))
      .orderBy(asc(chat.createdAt));
  }



  async getChatById(chatId: string): Promise<Chat | null> {
    const result = await db.select().from(chat).where(eq(chat.id, chatId));
    return result.length ? result[0] : null;
  }

  async deleteChat(chatId: string) {
    try {
      console.log(`Starting deletion process for chat: ${chatId}`); 
      
      await db.delete(message).where(eq(message.chatId, chatId));
      console.log(`Deleted all messages for chat ${chatId}`);
      
      await db.delete(chat).where(eq(chat.id, chatId));
      console.log(`Deleted chat ${chatId}`);
      
      return { 
        message: 'Chat and all associated data deleted successfully',
        deleted: true
      };
    } catch (error) {
      console.error(`Error deleting chat ${chatId}:`, error);
      throw error;
    }
  }
  
  async saveMessages({ messages }: { messages: Array<Message> }) {
    if (!messages || !messages.length) {
      throw new Error('No messages to save');
    }
    return await db.insert(message).values(messages);
  }
  
  async getMessagesInChat(chatId: string) {
    
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt));
  }
  
  async deleteMessagesInChat(chatId: string) {
    await db.delete(message).where(eq(message.chatId, chatId));
    return { message: 'All messages in chat deleted' };
  }
}
