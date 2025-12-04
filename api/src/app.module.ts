import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AlertsModule } from './alerts/alerts.module';
import { SolanaModule } from './solana/solana.module';
import { AiModule } from './ai/ai.module';
import { ChatModule } from './chat/chat.module';
import { WalletModule } from './wallet/wallet.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [AlertsModule, SolanaModule, AiModule, ChatModule, WalletModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
