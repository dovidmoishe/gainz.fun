import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { Observable } from 'rxjs';
import { ChatService } from 'src/chat/chat.service';
import { SolanaService } from '../solana/solana.service';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string | any;
  createdAt: Date;
  chatId: string;
};

type StreamSession = {
  streamId: string;
  chatId: string;
  userId: string;
  userMessage: Message;
  userPublicKey?: string;
  walletId?: string;
  createdAt: Date;
};

function generateUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

@Injectable()
export class AiService {
  private readonly genai: GoogleGenAI;
  private readonly streamSessions: Map<string, StreamSession> = new Map();
  
  constructor(
    private readonly chatService: ChatService,
    private readonly solanaService: SolanaService,
  ) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set');
    }
    this.genai = new GoogleGenAI({
      apiKey: apiKey,
    });

    // Cleanup old sessions every 5 minutes
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      for (const [streamId, session] of this.streamSessions.entries()) {
        if (session.createdAt.getTime() < fiveMinutesAgo) {
          this.streamSessions.delete(streamId);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Initialize stream: validate user, create/get chat, save user message, return streamId
   */
  async initializeStream({
    userMessage,
    userId,
    userPublicKey,
    walletId,
  }: {
    userMessage: Message;
    userId: string;
    userPublicKey?: string;
    walletId?: string;
  }): Promise<{ streamId: string; chatId: string }> {
    let chatId = userMessage.chatId;
    let chat;

    // Get or create chat
    if (chatId) {
      chat = await this.chatService.getChatById(chatId);
    }

    if (!chat) {
      const title = userMessage.content.slice(0, 100);
      chat = await this.chatService.createChat({ title, userId });
      chatId = chat.id;
    }

    if (chat.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access this chat');
    }

    // Save user message to database
    await this.chatService.saveMessages({
      messages: [{
        ...userMessage,
        chatId,
        createdAt: userMessage.createdAt || new Date(),
      }],
    });

    // Create stream session
    const streamId = generateUUID();
    this.streamSessions.set(streamId, {
      streamId,
      chatId,
      userId,
      userMessage: { ...userMessage, chatId },
      userPublicKey,
      walletId,
      createdAt: new Date(),
    });

    return { streamId, chatId };
  }

  /**
   * Stream AI response using streamId from initialized session
   */
  generateResponseStream(streamId: string): any {
    return new Observable((subscriber) => {
      (async () => {
        try {
          // Get stream session
          const session = this.streamSessions.get(streamId);
          if (!session) {
            subscriber.error(new BadRequestException('Invalid or expired stream session'));
            return;
          }

          const { chatId, userId, userMessage, userPublicKey, walletId } = session;

          // Get all previous messages for context (excluding the current user message that was already saved)
          const previousMessages = await this.chatService.getMessagesInChat(chatId);
          const allMessages = [...previousMessages];

          const systemInstruction = `you are gainz, the solana-powered trading assistant for gainz.fun.
you speak entirely in lowercase, always.

your personality is:
- smart and sharp
- slightly degen, but still clean
- confident and hype
- fast and energetic
- concise and direct
- supportive during wins, calm during dips
- never cringe, never chaotic

your voice:
- short lines
- punchy delivery
- lowercase always
- light humor

example tone:
- nice move. executing.
- clean entry.
- we're printing.
- pulling up your bags.
- on it.
- solid call.

rules:
- always reply in all lowercase, no exceptions
- never mention "tools" or "functions"
- keep answers tight unless user asks for more
- ask clarifying questions only when necessary
- never give financial advice
- your job is to understand the user, trigger the right tool, and respond in your gainz personality afterward
- you are the user's trading companion — fast, fun, and helpful.`;

          const formattedMessages = allMessages.map((msg: any) => {
            let textContent = '';

            if (typeof msg.content === 'string') {
              textContent = msg.content;
            } else if (msg.content && typeof msg.content.text === 'string') {
              textContent = msg.content.text;
            } else if (msg.content && typeof msg.content === 'object') {
              textContent = JSON.stringify(msg.content);
            } else {
              textContent = String(msg.content || '');
            }

            return {
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: textContent }],
            };
          });

          const stream = await this.genai.models.generateContentStream({
            model: 'gemini-2.5-flash', 
            contents: formattedMessages,
            config: {
              tools: [this.solanaService.getTools()] as any,
              maxOutputTokens: 5000,
              temperature: 1,
              systemInstruction: systemInstruction,
            },
          });

          let fullResponse = '';
          const functionCalls: any[] = [];

          for await (const chunk of stream) {
            const candidate = chunk.candidates?.[0];
            const parts = candidate?.content?.parts || [];
            const text = parts
              .filter((part: any) => typeof part.text === 'string')
              .map((part: any) => part.text)
              .join('');

            if (text) {
              fullResponse += text;
              const words = text.split(/(\s+)/);
              for (const word of words) {
                if (word) {
                  subscriber.next({
                    data: { token: word, type: 'content' },
                  });
                  await new Promise((resolve) => setTimeout(resolve, 15));
                }
              }
            }

            const functionCall = parts.find((part: any) => part.functionCall);
            if (functionCall) {
              functionCalls.push(functionCall);
            }
          }
          
          let functionResults = '';
          for (const funcCall of functionCalls) {
            const functionName = funcCall.functionCall?.name;
            const args = funcCall.functionCall?.args || {};

            try {
              if (functionName === 'searchToken') {
                const searchResult = await this.solanaService.searchToken(args.query);
                if (searchResult.found && searchResult.token) {
                  functionResults += `\nfound ${searchResult.token.symbol} (${searchResult.token.name}):\n`;
                  functionResults += `address: ${searchResult.token.address}\n`;
                  functionResults += `price: $${searchResult.token.usdPrice?.toFixed(4) || 'N/A'}\n`;
                  functionResults += `decimals: ${searchResult.token.decimals}\n`;
                  if (searchResult.token.isVerified) {
                    functionResults += `verified: yes\n`;
                  }
                  if (searchResult.token.mcap) {
                    functionResults += `mcap: $${(searchResult.token.mcap / 1e9).toFixed(2)}B\n`;
                  }
                  if (searchResult.alternatives && searchResult.alternatives.length > 0) {
                    functionResults += `alternatives: ${searchResult.alternatives.map((a: any) => `${a.symbol} (${a.address.slice(0, 8)}...)`).join(', ')}\n`;
                  }
                } else {
                  functionResults += `\nno token found for "${args.query}"`;
                  if (searchResult.error) {
                    functionResults += `\nerror: ${searchResult.error}`;
                  }
                }
              } else if (functionName === 'swapTokens') {
                const swapUserPublicKey = args.userPublicKey || userPublicKey;
                const swapWalletId = args.walletId || walletId;
                
                if (!swapUserPublicKey || !swapWalletId) {
                  functionResults += `\nerror: wallet information missing. please connect your wallet.`;
                } else {
                  const result = await this.solanaService.swapTokens(
                    args.fromToken,
                    args.toToken,
                    args.amount,
                    swapUserPublicKey,
                    swapWalletId,
                  );
                  functionResults += `\nswap executed. transaction signed and ready.`;
                }
                
              } else if (functionName === 'getPortfolioOverview') {
                const portfolioAddress = args.userAddress || userPublicKey;
                
                if (!portfolioAddress) {
                  functionResults += `\nerror: wallet address missing. please connect your wallet.`;
                } else {
                  const portfolio = await this.solanaService.getPortfolioOverview(
                    portfolioAddress,
                  );
                  functionResults += `\nportfolio overview:\n`;
                  functionResults += `total value: $${portfolio.totalWorth.toFixed(2)}\n`;
                  functionResults += `tokens: ${portfolio.tokenCount}\n`;
                  if (portfolio.summary.topHoldings.length > 0) {
                    functionResults += `top holdings:\n`;
                    portfolio.summary.topHoldings.forEach((holding, idx) => {
                      functionResults += `${idx + 1}. ${holding.mintAddress.slice(0, 8)}... - $${holding.worth.toFixed(2)}\n`;
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Error executing function ${functionName}:`, error);
              functionResults += `\nerror executing ${functionName}: ${error.message}`;
            }
          }

          if (functionResults.trim()) {
            subscriber.next({
              data: {
                token: '\n\n' + functionResults,
                type: 'function_result',
              },
            });
            fullResponse = functionResults + '\n\n' + fullResponse;
          }
          
          const assistantMessage = {
            id: generateUUID(),
            role: 'assistant',
            content: { text: fullResponse },
            createdAt: new Date(),
            chatId,
          };

          // Save assistant message to database
          await this.chatService.saveMessages({ messages: [assistantMessage] });

          // Send completion signal
          subscriber.next({
            data: '[DONE]',
          });

          subscriber.complete();
          
          // Cleanup session
          this.streamSessions.delete(streamId);
        } catch (error) {
          console.error('Error in stream:', error);
          subscriber.error(error);
        }
      })();
    });
  }
}
