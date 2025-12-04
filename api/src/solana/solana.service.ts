import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { VersionedTransaction, Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { WalletService } from '../wallet/wallet.service';
import db from "../../drizzle"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { trades, positions } from 'lib/db/schema';
import { eq, and } from 'drizzle-orm';


@Injectable()
export class SolanaService {
  private readonly referralAccount: string;
  private readonly connection: Connection;
  constructor(private readonly walletService: WalletService) {
    this.referralAccount = 'BTxbf6nkRX2wUiNpBVhA5SytPvST7KvEQoBDWVfpcvtv';
  this.connection = new Connection(clusterApiUrl('mainnet-beta'));
  }
  async getPrice(token: string) {
    const endPoint = `https://lite-api.jup.ag/price/v3?ids=${token}`;
    const response = await axios.get(endPoint);
    return response.data[token].price.toFixed(2);
  }

  async searchToken(query: string) {
    try {
      const searchResponse = await (
        await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(query)}`)
      ).json();

      if (!searchResponse || !Array.isArray(searchResponse) || searchResponse.length === 0) {
        return {
          found: false,
          query,
          message: `No tokens found for "${query}"`,
        };
      }

      const token = searchResponse[0];
      return {
        found: true,
        query,
        token: {
          id: token.id,
          address: token.id,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          icon: token.icon,
          usdPrice: token.usdPrice,
          mcap: token.mcap,
          liquidity: token.liquidity,
          isVerified: token.isVerified,
          organicScore: token.organicScore,
          organicScoreLabel: token.organicScoreLabel,
          tags: token.tags,
          cexes: token.cexes,
        },
        alternatives: searchResponse.slice(1, 5).map((t: any) => ({
          id: t.id,
          address: t.id,
          symbol: t.symbol,
          name: t.name,
          usdPrice: t.usdPrice,
          isVerified: t.isVerified,
        })),
      };
    } catch (error: any) {
      console.error(`Error searching for token "${query}":`, error);
      return {
        found: false,
        query,
        error: error?.message || 'Unknown error',
        message: `Failed to search for token "${query}"`,
      };
    }
  }

  async getPort(userAddress: string) {
    const userPublicKey = new PublicKey(userAddress)

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      userPublicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    const tokensAndWorths: { mintAddress: string, worth: number }[] = [];
    
    await Promise.all(
      tokenAccounts.value.map(async (tokenAccount) => {
        const parsedInfo = tokenAccount.account.data.parsed.info;
        const mintAddress = parsedInfo.mint;
        const tokenBalance = parsedInfo.tokenAmount.uiAmount;

        if (tokenBalance > 0) {
          try {
            const price = Number(await this.getPrice(mintAddress) || 0);
            tokensAndWorths.push({
              mintAddress,
              worth: tokenBalance * price,
            });
          } catch (error) {
            console.warn(`Failed to get price for ${mintAddress}:`, error);
            tokensAndWorths.push({
              mintAddress,
              worth: 0,
            });
          }
        }
      })
    );

    return tokensAndWorths;
  }

  async getPortfolioOverview(userAddress: string) {
    const portfolio = await this.getPort(userAddress);
    const totalWorth = portfolio.reduce((sum, token) => sum + token.worth, 0);
    
    const detailedPortfolio = await Promise.all(
      portfolio.map(async (token) => {
        try {
          const price = await this.getPrice(token.mintAddress);
          return {
            mintAddress: token.mintAddress,
            price: Number(price),
            worth: token.worth,
          };
        } catch (error) {
          return {
            mintAddress: token.mintAddress,
            price: 0,
            worth: token.worth,
          };
        }
      })
    );

    return {
      totalWorth,
      tokenCount: portfolio.length,
      tokens: detailedPortfolio,
      summary: {
        totalValue: totalWorth,
        topHoldings: detailedPortfolio
          .sort((a, b) => b.worth - a.worth)
          .slice(0, 5),
      },
    };
  }

  private async updatePosition(
    userId: string,
    token: string,
    amountChange: number,
    entryPrice: string,
  ) {
    const [existingPosition] = await db
      .select()
      .from(positions)
      .where(and(eq(positions.userId, userId), eq(positions.token, token)));

    const amountChangeStr = amountChange.toString();
    const entryPriceNum = parseFloat(entryPrice);

    if (existingPosition) {
      const currentAmount = parseFloat(existingPosition.amount);
      const currentAvgPrice = parseFloat(existingPosition.avgEntryPrice);
      const newAmount = currentAmount + amountChange;

      let newAvgPrice: string;
      if (newAmount <= 0) {
        newAvgPrice = '0';
      } else if (amountChange > 0) {
        const totalCost = currentAmount * currentAvgPrice + amountChange * entryPriceNum;
        newAvgPrice = (totalCost / newAmount).toFixed(8);
      } else {
        newAvgPrice = currentAvgPrice.toFixed(8);
      }

      await db
        .update(positions)
        .set({
          amount: Math.max(0, newAmount).toFixed(8),
          avgEntryPrice: newAvgPrice,
          updatedAt: new Date(),
        })
        .where(and(eq(positions.userId, userId), eq(positions.token, token)));
    } else {
      if (amountChange > 0) {
        await db.insert(positions).values({
          userId,
          token,
          amount: amountChangeStr,
          avgEntryPrice: entryPrice,
          updatedAt: new Date(),
        });
      }
    }
  }

  getSwapTokensTool() {
    return {
      name: 'swapTokens',
      description: 'Swap tokens on Solana using Jupiter aggregator. Creates and signs a swap transaction that the user can execute.',
      parameters: {
        type: 'object' as const,
        properties: {
          fromToken: {
            type: 'string' as const,
            description: 'The mint address of the token to swap from (e.g., So11111111111111111111111111111111111112 for SOL)',
          },
          toToken: {
            type: 'string' as const,
            description: 'The mint address of the token to swap to',
          },
          amount: {
            type: 'number' as const,
            description: 'The amount of tokens to swap (in the smallest unit, e.g., lamports for SOL)',
          },
          userPublicKey: {
            type: 'string' as const,
            description: 'The Solana public key (wallet address) of the user performing the swap',
          },
          walletId: {
            type: 'string' as const,
            description: 'The Privy wallet ID for signing the transaction',
          },
        },
        required: ['fromToken', 'toToken', 'amount', 'userPublicKey', 'walletId'],
      },
    };
  }

  getPortfolioOverviewTool() {
    return {
      name: 'getPortfolioOverview',
      description: 'Get a comprehensive overview of a user\'s Solana portfolio including all tokens, their balances, prices, and total portfolio value. Use this to analyze and provide insights about the user\'s holdings.',
      parameters: {
        type: 'object' as const,
        properties: {
          userAddress: {
            type: 'string' as const,
            description: 'The Solana wallet address (public key) of the user whose portfolio to analyze',
          },
        },
        required: ['userAddress'],
      },
    };
  }

  getSearchTokenTool() {
    return {
      name: 'searchToken',
      description: 'Search for a Solana token by its ticker symbol (e.g., USDC, EDLN, SOL) or name. Returns the token\'s contract address (mint address) and other details. Use this BEFORE swapTokens when the user mentions a token by ticker instead of contract address. Always search for both the "from" and "to" tokens before executing a swap.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string' as const,
            description: 'The token ticker symbol (e.g., USDC, EDLN, SOL) or name to search for',
          },
        },
        required: ['query'],
      },
    };
  }

  getTools() {
    return {
      functionDeclarations: [
        this.getSearchTokenTool(),
        this.getSwapTokensTool(),
        this.getPortfolioOverviewTool(),
      ],
    };
  }

  async swapTokens(
    fromToken: string,
    toToken: string,
    amount: number,
    userPublicKey: string,
    walletId: string,
  ) {
    const jupiterEndpoint = 'https://lite-api.jup.ag/swap/v1';

    const axiosInstance = axios.create({
      timeout: 30000,
    });

    let quoteResponse;

    const quoteUrl = `${jupiterEndpoint}/quote?inputMint=${fromToken}\
&outputMint=${toToken}\
&amount=${amount}\
&slippageBps=50`;

    try {
      console.log(`Requesting quote from: ${quoteUrl}`);
      quoteResponse = await axiosInstance.get(quoteUrl);
      console.log('Quote received successfully');
    } catch (error) {
      console.warn(
        `Failed to get quote from ${jupiterEndpoint}:`,
        error.message,
      );
    }

    let swapResponse;

    const swapUrl = `${jupiterEndpoint}/swap`;

    try {
        console.log(`Requesting swap transaction from: ${swapUrl}`);
        swapResponse = await axiosInstance.post(swapUrl, {
          quoteResponse: quoteResponse.data,
          userPublicKey: userPublicKey,
          
          dynamicComputeUnitLimit: true,
          dynamicSlippage: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1000000,
              priorityLevel: "veryHigh"
            }
          }
        });
        console.log('Swap transaction received with optimization parameters');
        
        if (swapResponse.data.prioritizationFeeLamports) {
          console.log('Prioritization fee lamports:', swapResponse.data.prioritizationFeeLamports);
        }
        if (swapResponse.data.computeUnitLimit) {
          console.log('Compute unit limit:', swapResponse.data.computeUnitLimit);
        }
        if (swapResponse.data.dynamicSlippageReport) {
          console.log('Dynamic slippage report:', swapResponse.data.dynamicSlippageReport);
        }
        
      } catch (error) {
        console.warn(`Failed to get swap transaction from ${jupiterEndpoint}:`, error.message);
      }
      const { 
        swapTransaction, 
        lastValidBlockHeight,
        prioritizationFeeLamports,
        computeUnitLimit,
        prioritizationType,
        dynamicSlippageReport,
        simulationError
      } = swapResponse.data;
      
      console.log('Signing transaction with Privy wallet...');
      const signedTransactionBase64 = await this.walletService.signTransaction(
        walletId,
        swapTransaction
      );
      console.log('Transaction signed successfully');

      let executionPrice: string;
      try {
        executionPrice = await this.getPrice(toToken);
      } catch (error) {
        console.warn('Failed to get execution price for toToken, attempting fallback:', error);
        try {
          const quoteData = quoteResponse.data;
          if (quoteData.outAmount && quoteData.inAmount) {
            const outAmount = parseFloat(quoteData.outAmount);
            const inAmount = parseFloat(quoteData.inAmount);
            const exchangeRate = outAmount / inAmount;
            const fromTokenPrice = await this.getPrice(fromToken);
            executionPrice = (parseFloat(fromTokenPrice) * exchangeRate).toFixed(2);
          } else {
            throw new Error('Quote data not available');
          }
        } catch (fallbackError) {
          console.error('Failed to get execution price from all methods:', fallbackError);
          executionPrice = '0';
        }
      }

      await db.insert(trades).values({
        userId: walletId,
        fromToken,
        toToken,
        amount: amount.toString(),
        execPrice: executionPrice,
        txHash: signedTransactionBase64,
        timestamp: new Date(),
      });

      try {
        const quoteData = quoteResponse?.data;
        let outAmount: number;
      
        const fromTokenPrice = await this.getPrice(fromToken);
      
        if (quoteData?.outAmount) {
          outAmount = parseFloat(quoteData.outAmount);
        } else {
          const executionPriceNum = parseFloat(executionPrice);
          const fromTokenPriceNum = parseFloat(fromTokenPrice);
          outAmount = (amount * fromTokenPriceNum) / executionPriceNum;
        }

        await this.updatePosition(
          walletId,
          fromToken,
          -amount,
          fromTokenPrice,
        );

        await this.updatePosition(
          walletId,
          toToken,
          outAmount,
          executionPrice,
        );
      } catch (error) {
        console.error('Failed to update positions:', error);
      }

      return {
        signedTransaction: signedTransactionBase64,
        lastValidBlockHeight,
        prioritizationFeeLamports,
        computeUnitLimit,
        prioritizationType,
        dynamicSlippageReport,
        simulationError
      };
  }
}
