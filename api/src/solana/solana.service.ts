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
    this.connection = new Connection(
      'https://solana-mainnet.g.alchemy.com/v2/pVe3T4LaDnJDqmmlBrkp_',
    );
  }
  async getPrice(token: string) {
    const endPoint = `https://lite-api.jup.ag/price/v3?ids=${token}`;
    const response = await axios.get(endPoint);
    console.log(response.data);
    const priceData = response.data?.data?.[token] || response.data?.[token];
    console.log(priceData);
    if (!priceData || typeof priceData.usdPrice !== 'number') {
      throw new Error(`Price not found for token ${token}`);
    }
    return priceData.usdPrice.toFixed(2);
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

    const solBalance = await this.connection.getBalance(userPublicKey);
    const solBalanceInSol = solBalance / 1_000_000_000;

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      userPublicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    const tokensAndWorths: { mintAddress: string, worth: number, balance?: number }[] = [];
    
    if (solBalanceInSol > 0) {
      try {
        const solPrice = Number(await this.getPrice('So11111111111111111111111111111111111111112') || 0);
        tokensAndWorths.push({
          mintAddress: 'So11111111111111111111111111111111111111112',
          worth: solBalanceInSol * solPrice,
          balance: solBalanceInSol,
        });
      } catch (error) {
        console.warn('Failed to get SOL price:', error);
        tokensAndWorths.push({
          mintAddress: 'So11111111111111111111111111111111111111112',
          worth: 0,
          balance: solBalanceInSol,
        });
      }
    }
    
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
              balance: tokenBalance,
            });
          } catch (error) {
            console.warn(`Failed to get price for ${mintAddress}:`, error);
            tokensAndWorths.push({
              mintAddress,
              worth: 0,
              balance: tokenBalance,
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
            balance: token.balance,
            worth: token.worth,
          };
        } catch (error) {
          return {
            mintAddress: token.mintAddress,
            price: 0,
            balance: token.balance,
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
      description: 'Swap tokens on Solana using Jupiter aggregator. Creates and signs a swap transaction. IMPORTANT: When user says "swap 50% of my SOL" or "swap $1 worth of SOL", you MUST first call getPortfolioOverview to get their balance, calculate the correct amount in lamports, then call swapTokens. The user\'s wallet is automatically used.',
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
            description: 'The EXACT amount of tokens to swap in the smallest unit (e.g., lamports for SOL). 1 SOL = 1,000,000,000 lamports. You must calculate this from percentages or dollar amounts by checking their portfolio first.',
          },
        },
        required: ['fromToken', 'toToken', 'amount'],
      },
    };
  }

  getPortfolioOverviewTool() {
    return {
      name: 'getPortfolioOverview',
      description: 'Get the user\'s Solana portfolio with all token balances, prices, and total value. REQUIRED before executing percentage-based swaps (e.g., "swap 50% of SOL") or dollar-amount swaps (e.g., "swap $1 worth of SOL") to calculate the correct amount. Also use when user asks to see their portfolio.',
      parameters: {
        type: 'object' as const,
        properties: {},
        required: [],
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

    const minSwapAmount = 100000;
    if (amount < minSwapAmount) {
      throw new Error(`Swap amount too small. Minimum is ${minSwapAmount / 1e9} SOL (${minSwapAmount} lamports). You tried to swap ${amount / 1e9} SOL.`);
    }

    let quoteResponse;
    const quoteUrl = `${jupiterEndpoint}/quote?inputMint=${fromToken}&outputMint=${toToken}&amount=${Math.floor(amount)}&slippageBps=50`;

    try {
      console.log(`Requesting quote from: ${quoteUrl}`);
      quoteResponse = await axiosInstance.get(quoteUrl);
      console.log('Quote received successfully');
    } catch (error) {
      console.error(`Failed to get quote from ${jupiterEndpoint}:`, error.message);
      if (error.response?.data) {
        console.error('Quote error details:', error.response.data);
      }
      throw new Error(`Failed to get swap quote: ${error.response?.data?.error || error.message}. The amount may be too small or the token pair may not be available.`);
    }

    if (!quoteResponse || !quoteResponse.data) {
      throw new Error('No quote response received from Jupiter API');
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
      console.error(`Failed to get swap transaction from ${jupiterEndpoint}:`, error.message);
      if (error.response?.data) {
        console.error('Swap error details:', error.response.data);
      }
      throw new Error(`Failed to create swap transaction: ${error.response?.data?.error || error.message}`);
    }

    if (!swapResponse || !swapResponse.data) {
      throw new Error('No swap response received from Jupiter API');
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

    if (simulationError) {
      console.error('Transaction simulation failed:', JSON.stringify(simulationError, null, 2));
      const errorMsg = simulationError.message || 'Unknown simulation error';
      
      if (errorMsg.includes('insufficient') || errorMsg.includes('Insufficient')) {
        throw new Error(`Insufficient balance. You may not have enough SOL to cover both the swap and transaction fees. Try reducing the amount.`);
      }
      
      if (errorMsg.includes('slippage')) {
        throw new Error(`Price slippage too high. The token price changed too much. Please try again.`);
      }
      
      throw new Error(`Transaction simulation failed: ${errorMsg}`);
    }
      
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
