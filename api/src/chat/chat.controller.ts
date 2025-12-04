import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { type Message, type Chat } from '../../lib/db/schema';

class CreateChatDto {
  title: string;
  userId: string;
  chatId?: string;
}

class SaveMessagesDto {
  messages: Array<Message>;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async createChat(@Body() body: CreateChatDto): Promise<Chat> {
    const { title, userId, chatId } = body;
    return await this.chatService.createChat({ title, userId, chatId });
  }

  @Get('user/:userId')
  async getAllChatsForUser(@Param('userId') userId: string) {
    return await this.chatService.getAllChatsForUser(userId);
  }

  @Get(':chatId')
  async getChatById(@Param('chatId') chatId: string) {
    return await this.chatService.getChatById(chatId);
  }

  @Delete(':chatId')
  async deleteChat(@Param('chatId') chatId: string) {
    return await this.chatService.deleteChat(chatId);
  }

  @Post('messages')
  async saveMessages(@Body() body: SaveMessagesDto) {
    return await this.chatService.saveMessages({ messages: body.messages });
  }

  @Get(':chatId/messages')
  async getMessagesInChat(@Param('chatId') chatId: string) {
    return await this.chatService.getMessagesInChat(chatId);
  }

  @Delete(':chatId/messages')
  async deleteMessagesInChat(@Param('chatId') chatId: string) {
    return await this.chatService.deleteMessagesInChat(chatId);
  }
}
