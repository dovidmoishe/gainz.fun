import { Module } from '@nestjs/common';
import { SolanaController } from './solana.controller';
import { SolanaService } from './solana.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [SolanaController],
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}
