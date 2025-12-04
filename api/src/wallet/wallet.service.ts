import { Injectable } from '@nestjs/common';
import {PrivyClient} from '@privy-io/server-auth';
import axios from 'axios';

@Injectable()
export class WalletService {
    private readonly privyClient: PrivyClient;
    private readonly privyAppId: string;
    private readonly authorizationPrivateKey: string;
    
    constructor() {
        this.privyClient = new PrivyClient(
            process.env.PRIVY_APP_ID as string,
            process.env.PRIVY_APP_SECRET as string,
            {
                walletApi: {
                    authorizationPrivateKey: process.env.PRIVY_WALLET_API_AUTHORIZATION_PRIVATE_KEY,
                }
            }
        );
        this.privyAppId = process.env.PRIVY_APP_ID as string;
        this.authorizationPrivateKey = process.env.PRIVY_WALLET_API_AUTHORIZATION_PRIVATE_KEY as string;
    }

    async signTransaction(walletId: string, transactionBase64: string): Promise<string> {
        try {
            const response = await axios.post(
                `https://api.privy.io/v1/wallets/${walletId}/rpc`,
                {
                    method: 'signTransaction',
                    params: {
                        transaction: transactionBase64,
                        encoding: 'base64',
                    },
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.authorizationPrivateKey}`,
                        'Content-Type': 'application/json',
                        'privy-app-id': this.privyAppId,
                    },
                }
            );

            if (response.data && response.data.data && response.data.data.signed_transaction) {
                return response.data.data.signed_transaction;
            }
            
            if (response.data && response.data.signed_transaction) {
                return response.data.signed_transaction;
            }

            throw new Error('Unexpected response format from Privy wallet API');
        } catch (error) {
            console.error('Error signing transaction with Privy:', error);
            throw new Error(`Failed to sign transaction: ${error.message}`);
        }
    }
}
