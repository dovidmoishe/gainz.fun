import { Controller, Post, Body, Sse, MessageEvent } from '@nestjs/common';
import { AiService } from './ai.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

class GenerateResponseDto {
  messages: Array<{
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt?: Date;
    chatId?: string;
  }>;
  chatId: string;
  userId: string;
  userPublicKey?: string;
  walletId?: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('stream')
  @Sse('stream')
  streamResponse(@Body() body: GenerateResponseDto): Observable<MessageEvent> {
    return this.aiService.generateResponseStream({
      messages: body.messages,
      chatId: body.chatId,
      userId: body.userId,
      userPublicKey: body.userPublicKey,
      walletId: body.walletId,
    }).pipe(
      map((data) => ({
        data: JSON.stringify(data),
      } as MessageEvent)),
    );
  }
}
