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
import { UserService } from '../user/user.service';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  chatId: string;
};

type StreamSession = {
  streamId: string;
  chatId: string;
  userId: string;
  messages: Message[];
  userPublicKey?: string;
  walletId?: string;
  createdAt: Date;
};

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

@Injectable()
export class AiService {
  private readonly genai: GoogleGenAI;
  private readonly streamSessions = new Map<string, StreamSession>();
  private readonly SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  
  constructor(
    private readonly chatService: ChatService,
    private readonly solanaService: SolanaService,
    private readonly userService: UserService,
  ) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set');
    }
    this.genai = new GoogleGenAI({
      apiKey: apiKey,
    });
    
    // Clean up expired sessions every 5 minutes (not every minute to avoid premature deletion)
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredSessions() {
    const now = new Date();
    const deletedSessions: string[] = [];
    for (const [streamId, session] of this.streamSessions.entries()) {
      const age = now.getTime() - session.createdAt.getTime();
      if (age > this.SESSION_EXPIRY_MS) {
        this.streamSessions.delete(streamId);
        deletedSessions.push(streamId);
      }
    }
    if (deletedSessions.length > 0) {
      console.log(`🧹 Cleaned up ${deletedSessions.length} expired stream sessions`);
    }
  }

  async initializeStream({
    messages,
    chatId,
    userId,
  }: {
    messages: Message[];
    chatId: string;
    userId: string;
  }): Promise<{ streamId: string }> {
    const streamId = generateUUID();
    
    let userPublicKey: string | undefined;
    let walletId: string | undefined;
    try {
      const userData = await this.userService.getUserById(userId);
      userPublicKey = userData.publicKey;
      walletId = userData.publicKey;
    } catch (error) {
      console.warn('⚠️ Could not fetch user publicKey:', error.message);
    }

    const session: StreamSession = {
      streamId,
      chatId,
      userId,
      messages,
      userPublicKey,
      walletId,
      createdAt: new Date(),
    };

    this.streamSessions.set(streamId, session);
    console.log(`✅ Stream session initialized: ${streamId} (total sessions: ${this.streamSessions.size})`);
    
    return { streamId };
  }

  generateResponseStream(streamId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          console.log(`🔍 Looking up stream session: ${streamId} (available sessions: ${this.streamSessions.size})`);
          const session = this.streamSessions.get(streamId);
          if (!session) {
            console.error(`❌ Stream session not found: ${streamId}`);
            console.error(`Available sessions: ${Array.from(this.streamSessions.keys()).join(', ')}`);
            subscriber.error(new BadRequestException('Invalid or expired stream session'));
            return;
          }

          const { chatId, userId, messages, userPublicKey, walletId } = session;

          console.log('🎬 Starting stream for session:', streamId);

          let chat = await this.chatService.getChatById(chatId);
          
          if (!chat) {
            const firstUserMessage = messages.find(m => m.role === 'user');
            const title = firstUserMessage?.content 
              ? (typeof firstUserMessage.content === 'string' 
                  ? firstUserMessage.content.slice(0, 100)
                  : 'new chat')
              : 'new chat';
            
            chat = await this.chatService.createChat({ 
              title, 
              userId,
              chatId,
            });
            console.log('✅ Chat created:', chat.id);
          }

          if (chat.userId !== userId) {
            throw new ForbiddenException('Access denied');
          }

          const existingMessages = await this.chatService.getMessagesInChat(chatId);
          const existingMessageIds = new Set(existingMessages.map(m => m.id));
          
          const newUserMessages = messages.filter(m => 
            m.role === 'user' && !existingMessageIds.has(m.id)
          );
          
          if (newUserMessages.length > 0) {
            console.log('💾 Saving new user messages:', newUserMessages.length);
            await this.chatService.saveMessages({
              messages: newUserMessages.map(msg => ({
                ...msg,
                createdAt: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt),
              })),
            });
            console.log('✅ User messages saved');
          }

          const allMessages = await this.chatService.getMessagesInChat(chatId);

          const systemInstruction = `
you are gainz, the solana-powered trading assistant for gainz.fun.
you speak entirely in lowercase, always.

your personality:
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
- never give financial advice
- you are the user's trading companion — fast, fun, and helpful

IMPORTANT SWAP HANDLING:
when user wants to swap with percentages or dollar amounts, you MUST use getPortfolioOverview first to get their balance data, then use that data to calculate the exact amount in lamports.

workflow:
1. user says "swap 50% of my sol for edln"
   → call getPortfolioOverview (you'll get balance data with pre-calculated amounts)
   → look for "50% of SOL: X lamports" in the response
   → call searchToken for "edln" to get mint address
   → call swapTokens with fromToken=So11111111111111111111111111111111111112, toToken=EDLN_MINT, amount=X

2. user says "swap $1 worth of sol for edln"
   → call getPortfolioOverview (you'll see "$1 worth: X lamports")
   → use that pre-calculated lamport amount
   → search for token
   → call swapTokens with that amount

3. user says "ape into edln with $10 of sol"
   → call getPortfolioOverview (you'll see "$10 worth: X lamports")
   → use that amount
   → search and swap

CRITICAL RULES:
- MINIMUM SWAP: 0.0001 SOL (100,000 lamports). If calculated amount is less, tell user the amount is too small
- portfolio data shows PRE-CALCULATED lamport amounts for common percentages ($1, $5, $10, 50%)
- DO NOT do your own math - USE the pre-calculated values from portfolio response
- for SOL: 1 SOL = 1,000,000,000 lamports
- SOL mint address: So11111111111111111111111111111111111112
- ONLY show fancy portfolio display when user explicitly asks (e.g., "show my portfolio")
- when swapping, portfolio data is hidden - only swap confirmation shown
- always search for token tickers before swapping
                    `;

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

          let chatHistory = [...formattedMessages];
          let fullResponse = '';
          let maxRounds = 5;
          let currentRound = 0;

          while (currentRound < maxRounds) {
            currentRound++;
            console.log(`🔄 Function calling round ${currentRound}`);

            const stream = await this.genai.models.generateContentStream({
              model: 'gemini-2.5-flash', 
              contents: chatHistory,
              config: {
                tools: [this.solanaService.getTools()] as any,
                maxOutputTokens: 5000,
                temperature: 1,
                systemInstruction: systemInstruction,
              },
            });

            const functionCalls: any[] = [];
            let roundResponse = '';

            for await (const chunk of stream) {
              const candidate = chunk.candidates?.[0];
              const parts = candidate?.content?.parts || [];
              
              if (parts.length > 0) {
                console.log(`📦 Received parts:`, JSON.stringify(parts, null, 2));
              }
              
              const text = parts
                .filter((part: any) => typeof part.text === 'string')
                .map((part: any) => part.text)
                .join('');

              if (text) {
                roundResponse += text;
              }

              const functionCall = parts.find((part: any) => part.functionCall);
              if (functionCall) {
                console.log(`🔧 Function call detected: ${functionCall.functionCall?.name}`);
                functionCalls.push(functionCall);
              }
            }

            if (functionCalls.length === 0 && roundResponse) {
              console.log(`💬 AI generated text response: ${roundResponse.substring(0, 100)}...`);
              fullResponse += roundResponse;
              const words = roundResponse.split(/(\s+)/);
              for (const word of words) {
                if (word) {
                  subscriber.next({
                    data: JSON.stringify({ token: word, type: 'content' }),
                  } as MessageEvent);
                  await new Promise((resolve) => setTimeout(resolve, 15));
                }
              }
              break;
            }

            if (functionCalls.length === 0 && !roundResponse) {
              console.log(`⚠️ No function calls and no text response in round ${currentRound}`);
              if (currentRound === 1) {
                fullResponse = "sorry, i couldn't process that. please try again.";
                const words = fullResponse.split(/(\s+)/);
                for (const word of words) {
                  if (word) {
                    subscriber.next({
                      data: JSON.stringify({ token: word, type: 'content' }),
                    } as MessageEvent);
                    await new Promise((resolve) => setTimeout(resolve, 15));
                  }
                }
              }
              break;
            }

            console.log(`📞 Executing ${functionCalls.length} function calls`);
            
            let functionResults = '';
            const hasSwapFunction = functionCalls.some(fc => fc.functionCall?.name === 'swapTokens');
            let portfolioData: any = null;
          
          for (const funcCall of functionCalls) {
            const functionName = funcCall.functionCall?.name;
            const args = funcCall.functionCall?.args || {};

            try {
              if (functionName === 'searchToken') {
                if (hasSwapFunction) {
                  await this.solanaService.searchToken(args.query);
                } else {
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
                }
              } else if (functionName === 'swapTokens') {
                if (!userPublicKey || !walletId) {
                  functionResults += `\nerror: wallet information missing. please connect your wallet.`;
                } else {
                  const result = await this.solanaService.swapTokens(
                    args.fromToken,
                    args.toToken,
                    args.amount,
                    userPublicKey,
                    walletId,
                  );
                  functionResults += `\nswap executed. transaction signed and ready.`;
                }
                
              } else if (functionName === 'getPortfolioOverview') {
                if (!userPublicKey) {
                  functionResults += `\nerror: wallet address missing. please connect your wallet.`;
                } else {
                  const portfolio = await this.solanaService.getPortfolioOverview(
                    userPublicKey,
                  );
                  portfolioData = portfolio;
                  
                  if (hasSwapFunction) {
                    const solToken = portfolio.tokens.find(t => 
                      t.mintAddress === 'So11111111111111111111111111111111111112'
                    );
                    
                    if (solToken) {
                      functionResults += `\n[BALANCE DATA]\n`;
                      functionResults += `SOL Balance: ${solToken.balance || 0} SOL\n`;
                      functionResults += `SOL Price: $${solToken.price}\n`;
                      functionResults += `SOL in Lamports: ${Math.floor((solToken.balance || 0) * 1000000000)}\n`;
                      functionResults += `\nQuick calculations:\n`;
                      functionResults += `- 50% of SOL: ${Math.floor((solToken.balance || 0) * 0.5 * 1000000000)} lamports\n`;
                      functionResults += `- $1 worth: ${Math.floor((1 / solToken.price) * 1000000000)} lamports\n`;
                      functionResults += `- $5 worth: ${Math.floor((5 / solToken.price) * 1000000000)} lamports\n`;
                      functionResults += `- $10 worth: ${Math.floor((10 / solToken.price) * 1000000000)} lamports\n`;
                    } else {
                      functionResults += `\n[ERROR] No SOL found in wallet\n`;
                    }
                  } else {
                    functionResults += `\n╔═══════════════════════════════════╗\n`;
                    functionResults += `║     💼 portfolio snapshot         ║\n`;
                    functionResults += `╚═══════════════════════════════════╝\n\n`;
                    
                    functionResults += `💰 total value: $${portfolio.totalWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                    functionResults += `🪙 tokens held: ${portfolio.tokenCount}\n\n`;
                    
                    if (portfolio.summary.topHoldings.length > 0) {
                      functionResults += `🏆 top holdings:\n`;
                      functionResults += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                      portfolio.summary.topHoldings.forEach((holding, idx) => {
                        const percentage = portfolio.totalWorth > 0 
                          ? (holding.worth / portfolio.totalWorth * 100).toFixed(1)
                          : '0.0';
                        
                        const bars = Math.round((holding.worth / portfolio.totalWorth) * 20);
                        const progressBar = '█'.repeat(bars) + '░'.repeat(20 - bars);
                        
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
                        
                        functionResults += `${medal} ${holding.mintAddress.slice(0, 6)}...${holding.mintAddress.slice(-4)}\n`;
                        functionResults += `   ${progressBar} ${percentage}%\n`;
                        functionResults += `   $${holding.worth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
                      });
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`Error executing function ${functionName}:`, error);
              functionResults += `\nerror executing ${functionName}: ${error.message}`;
            }
          }

            const functionResponseParts = functionCalls.map(fc => ({
              functionResponse: {
                name: fc.functionCall.name,
                response: { result: 'success' }
              }
            }));

            chatHistory.push({
              role: 'model',
              parts: functionCalls.map(fc => fc)
            });

            chatHistory.push({
              role: 'user',
              parts: [{ text: functionResults || 'Function executed successfully' }]
            });

            console.log(`✅ Functions executed, continuing loop...`);
          }

          if (!fullResponse || fullResponse.trim().length === 0) {
            console.log('⚠️ No response generated, using fallback message');
            fullResponse = "sorry, something went wrong. please try again.";
            const words = fullResponse.split(/(\s+)/);
            for (const word of words) {
              if (word) {
                subscriber.next({
                  data: JSON.stringify({ token: word, type: 'content' }),
                } as MessageEvent);
                await new Promise((resolve) => setTimeout(resolve, 15));
              }
            }
          }
          
          const assistantMessageId = generateUUID();
          
          console.log(`💾 Saving assistant message: ${fullResponse.substring(0, 100)}...`);
          await this.chatService.saveMessages({ 
            messages: [{
              id: assistantMessageId,
              role: 'assistant',
              content: fullResponse,
              createdAt: new Date(),
              chatId,
            }] 
          });

          console.log('📤 Sending done event');
          subscriber.next({
            event: 'done',
            data: JSON.stringify({ id: assistantMessageId, complete: true }),
          } as unknown as MessageEvent);

          // Clean up session
          this.streamSessions.delete(streamId);
          
          subscriber.complete();
          console.log('✅ Stream completed');
        } catch (error) {
          console.error('❌ Error in stream:', error);
          console.error('Error details:', error.message);
          console.error('Stack:', error.stack);
          subscriber.error(error);
        }
      })();
    });
  }
}
