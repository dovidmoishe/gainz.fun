import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { Observable } from 'rxjs';
import { ChatService } from 'src/chat/chat.service';
import { SolanaService } from '../solana/solana.service';

type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
  chatId?: string;
};

function generateUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getMostRecentUserMessage(messages: Array<Message>): Message | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i];
    }
  }
  return null;
}

@Injectable()
export class AiService {
    private readonly genai: GoogleGenAI;
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
    }

  generateResponseStream({
    messages,
    chatId,
    userId,
    userPublicKey,
    walletId,
  }: {
    messages: Array<Message>;
    chatId: string;
    userId: string;
    userPublicKey?: string;
    walletId?: string;
  }): any {
    return new Observable((subscriber) => {
      (async () => {
        try {
          const recentUserMessage = getMostRecentUserMessage(messages);
          if (!recentUserMessage) {
            subscriber.error(new NotFoundException('No user message found'));
            return;
          }

          let chat;
            if (chatId) {
            chat = await this.chatService.getChatById(chatId);
          }

          if (!chat) {
            const title = recentUserMessage.content.slice(0, 100);
            chat = await this.chatService.createChat({ title, userId, chatId });
            chatId = chat.id;
          }
          if (chat.userId !== userId) {
              subscriber.error(new ForbiddenException(
                  'You do not have permission to access this chat',
              ));
              return;
          }

          // TODO: Customize user data fetching
          // const user = await this.authService.getUserById(userId);
          // const userRewards = await this.rewardsService.getUserRewards(userId);
          // ... other user-specific data

          // TODO: Customize message limit/credit checks
          // if (!user?.isPremium) {
          //     const existingMessages = await this.chatService.getMessagesInChat(chatId);
          //     const messageCount = existingMessages.length;
          //
          //     if (messageCount >= 30) {
          //         // Handle message limit
          //         subscriber.complete();
          //         return;
          //     }
          // }

          // TODO: Customize credit checks
          // const userCredits = await this.checkUserCredits(userId);
          // if (userCredits < 0.5) {
          //     // Handle out of credits
          //     subscriber.complete();
          //     return;
          // }
          const systemInstruction = `
                    you are gainz, the solana-powered trading assistant for gainz.fun.
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

                    - we’re printing.

                    - pulling up your bags.

                    - on it.

                    - solid call.

rules:

                    - always reply in all lowercase, no exceptions

                    - never mention “tools” or “functions”

                    - keep answers tight unless user asks for more

                    - ask clarifying questions only when necessary

                    - never give financial advice

                    - your job is to understand the user, trigger the right tool, and respond in your gainz personality afterward

                    - you are the user’s trading companion — fast, fun, and helpful.
                    `;

          await this.chatService.saveMessages({
              messages: [
                  {
                      ...recentUserMessage,
                      id: generateUUID(),
                      createdAt: new Date(),
                      chatId,
                      content: recentUserMessage.content,
                  },
              ],
          });

          const formattedMessages = messages.map((msg: any) => {
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

          await this.chatService.saveMessages({ messages: [assistantMessage] });

          subscriber.next({
            event: 'done',
            data: { id: assistantMessage.id, complete: true },
          });

          subscriber.complete();
        } catch (error) {
          console.error('Error in stream:', error);
          subscriber.error(error);
        }
      })();
    });
    }
}
