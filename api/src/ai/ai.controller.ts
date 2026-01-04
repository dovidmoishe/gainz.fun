import { Controller, Get, Post, Body, Param, Sse, MessageEvent } from '@nestjs/common';
import { AiService } from './ai.service';
import { Observable } from 'rxjs';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | string;
  chatId: string;
};

class InitStreamDto {
  messages: Message[];
  chatId: string;
  userId: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('message-stream/init')
  async initializeStream(@Body() body: InitStreamDto): Promise<{ streamId: string }> {
    console.log(`📨 Received init request for chat: ${body.chatId}, user: ${body.userId}, messages: ${body.messages.length}`);
    const result = await this.aiService.initializeStream({
      messages: body.messages.map(msg => ({
        ...msg,
        createdAt: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt),
      })),
      chatId: body.chatId,
      userId: body.userId,
    });
    console.log(`📤 Returning streamId: ${result.streamId}`);
    return result;
  }

  @Get('message-stream/:streamId')
  @Sse()
  generateResponseStream(@Param('streamId') streamId: string): Observable<MessageEvent> {
    return this.aiService.generateResponseStream(streamId);
  }
}
